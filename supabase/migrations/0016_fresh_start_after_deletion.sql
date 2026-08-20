-- ============================================================================
-- 0016 — deleting your account frees your Google identity for a fresh start.
--
-- 0014/0015 kept the auth.users row after deletion, so the same Google
-- account was locked out forever ("account deleted" screen). New rule:
-- deletion also removes the auth.users row, so the next "Sign in with
-- Google" creates a brand-new auth user (new id) and a brand-new profile
-- via the existing signup triggers. The OLD profile row stays behind as a
-- scrubbed tombstone (status 'deleted', name 'Unknown') so old chat
-- messages keep rendering as "Unknown" — the new account is not linked to
-- them in any way.
--
-- To make that possible:
--   1. profiles.id no longer references auth.users — the tombstone must
--      outlive its auth row. (The old FK's ON DELETE CASCADE would have
--      deleted the profile and, transitively, every chat message.)
--   2. An AFTER DELETE trigger on auth.users scrubs the profile whenever
--      an auth user is deleted by ANY path (our function, the Supabase
--      dashboard, the admin API) — without it, a dashboard deletion would
--      now leave a live orphan profile sitting in groups.
--   3. leave_group is split into an auth-free core + the auth.uid()
--      wrapper, because the cleanup must also run from that trigger,
--      where there is no signed-in caller.
--   4. Legacy accounts already deleted under the 0014 rules get their
--      auth rows removed here, one-time, so those people can return too.
-- ============================================================================

alter table public.profiles drop constraint if exists profiles_id_fkey;

-- ── leave_group, split ──────────────────────────────────────────────────────
-- Core: 0004's body, acting on an explicit user. NOT client-callable.
create or replace function public.leave_group_core(p_group_id uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group     public.study_groups%rowtype;
  v_successor uuid;
begin
  select * into v_group from public.study_groups where id = p_group_id for update;
  if not found then
    raise exception 'GROUP_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.study_group_members m
    where m.group_id = p_group_id and m.user_id = p_user
  ) then
    raise exception 'NOT_MEMBER';
  end if;

  delete from public.study_group_members
    where group_id = p_group_id and user_id = p_user;
  update public.study_groups
    set member_count = member_count - 1
    where id = p_group_id;

  if v_group.manager_id = p_user then
    select m.user_id into v_successor
    from public.study_group_members m
    join public.profiles p on p.id = m.user_id
    where m.group_id = p_group_id
    order by m.joined_at asc, p.created_at asc, m.user_id asc
    limit 1;

    if v_successor is null then
      -- Manager was the last one out — turn off the lights.
      v_group.member_count := 0;
      perform public.disband_group_core(v_group, p_user);
    else
      update public.study_groups set manager_id = v_successor where id = p_group_id;
      perform public.app_notify(v_successor, 'manager_transferred',
        jsonb_build_object('group_id', p_group_id, 'group_name', v_group.name));
    end if;
  end if;
end;
$$;

revoke execute on function public.leave_group_core(uuid, uuid) from public, anon, authenticated;

-- Wrapper: same signature, same error behavior as before.
create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  perform public.leave_group_core(p_group_id, v_uid);
end;
$$;

-- ── The full cleanup, auth-free ─────────────────────────────────────────────
-- 0015's delete_account body, acting on an explicit user. NOT client-callable.
create or replace function public.scrub_account_core(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group uuid;
begin
  -- 1. Leave every group; core owns succession and disband.
  for v_group in
    select m.group_id from public.study_group_members m where m.user_id = p_uid
  loop
    perform public.leave_group_core(v_group, p_uid);
  end loop;

  -- 2. Pending group paperwork.
  update public.join_requests
    set status = 'withdrawn', resolved_at = now()
    where user_id = p_uid and status = 'pending';
  update public.group_invitations
    set status = 'cancelled', resolved_at = now()
    where (invited_user_id = p_uid or inviter_id = p_uid) and status = 'pending';

  -- 2b. Social graph: vanish from everyone's lists, both directions.
  delete from public.friends
    where user_id_a = p_uid or user_id_b = p_uid;
  delete from public.study_buddy_connections
    where user_id_a = p_uid or user_id_b = p_uid;
  update public.friend_requests
    set status = 'cancelled', resolved_at = now()
    where (sender_id = p_uid or recipient_id = p_uid) and status = 'pending';
  update public.study_buddy_requests
    set status = 'cancelled', resolved_at = now()
    where (sender_id = p_uid or recipient_id = p_uid) and status = 'pending';
  delete from public.blocks
    where blocker_id = p_uid or blocked_id = p_uid;

  -- 3. Their participation records and inbox.
  delete from public.meetup_attendance where user_id = p_uid;
  delete from public.availability_votes where user_id = p_uid;
  delete from public.notifications where recipient_id = p_uid;

  -- 4. Scrub the profile into the "Unknown" tombstone.
  update public.profiles set
    display_name = 'Unknown',
    avatar_url = null,
    bio = null,
    college = null,
    major = null,
    class_standing = null,
    graduation_month = null,
    graduation_year = null,
    social_links = '[]'::jsonb,
    privacy = '{}'::jsonb,
    is_available_for_buddies = false,
    email_notifications = false,
    email = 'deleted+' || p_uid || '@deleted.invalid',
    account_status = 'deleted'
  where id = p_uid;
end;
$$;

revoke execute on function public.scrub_account_core(uuid) from public, anon, authenticated;

-- ── Self-service deletion: scrub, then free the Google identity ─────────────
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Bare auth check on purpose: a suspended account may still delete
  -- itself (same reasoning as block_user in 0003).
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  perform public.scrub_account_core(v_uid);

  -- Free the Google identity: the auth row (and its sessions/identities)
  -- goes away, so the next sign-in creates a brand-new account. The
  -- scrubbed profile above survives because the FK is gone.
  delete from auth.users where id = v_uid;
end;
$$;

-- ── Safety net: auth deletions from ANY path tombstone the profile ─────────
-- (Dashboard/admin-API deletions used to cascade the profile away, taking
-- every chat message with it. Now they scrub instead.)
create or replace function public.handle_deleted_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.profiles p
    where p.id = old.id and p.account_status <> 'deleted'
  ) then
    perform public.scrub_account_core(old.id);
  end if;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.handle_deleted_auth_user();

-- ── One-time: free identities deleted under the 0014 lockout rules ──────────
-- (Their profiles are already 'deleted', so the trigger above no-ops.)
delete from auth.users u
  using public.profiles p
  where p.id = u.id and p.account_status = 'deleted';
