-- ============================================================================
-- 0017 — stricter filter, uncensored originals, "Deleted User" rename.
--
-- 1. censor_profanity() catches spelled-out swears ("f u c k", "f-u-c-k":
--    each letter may be followed by any run of non-alphanumerics) and masks
--    the WHOLE containing word ("fucking" -> "****", not "****ing").
--    Ambiguous words stay exact-whole-word (\y...\y), so "assessment",
--    "cockpit", "Dickson" still pass. Mirror of lib/profanity.ts — keep
--    the two word lists in sync.
-- 2. message_originals: when a chat message is censored, the ORIGINAL
--    text is kept here for the team. RLS is on with NO policies and no
--    grants: unreachable through the API by any user; readable only via
--    the dashboard/service role.
-- 3. Deleted accounts now display as 'Deleted User' (was 'Unknown').
-- ============================================================================

create or replace function public.censor_profanity(p_text text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $fn$
  select regexp_replace(
           regexp_replace(
             coalesce(p_text, ''),
             '[[:alnum:]_]*(f[^[:alnum:]]*u[^[:alnum:]]*c[^[:alnum:]]*k|s[^[:alnum:]]*h[^[:alnum:]]*i[^[:alnum:]]*t|c[^[:alnum:]]*u[^[:alnum:]]*n[^[:alnum:]]*t|b[^[:alnum:]]*i[^[:alnum:]]*t[^[:alnum:]]*c[^[:alnum:]]*h|w[^[:alnum:]]*h[^[:alnum:]]*o[^[:alnum:]]*r[^[:alnum:]]*e|s[^[:alnum:]]*l[^[:alnum:]]*u[^[:alnum:]]*t|f[^[:alnum:]]*a[^[:alnum:]]*g[^[:alnum:]]*g[^[:alnum:]]*o[^[:alnum:]]*t|n[^[:alnum:]]*i[^[:alnum:]]*g[^[:alnum:]]*g[^[:alnum:]]*e[^[:alnum:]]*r|n[^[:alnum:]]*i[^[:alnum:]]*g[^[:alnum:]]*g[^[:alnum:]]*a|a[^[:alnum:]]*s[^[:alnum:]]*s[^[:alnum:]]*h[^[:alnum:]]*o[^[:alnum:]]*l[^[:alnum:]]*e)[[:alnum:]_]*',
             '****', 'gi'
           ),
           '\y(ass|dick|cock|pussy|bastard|tits)\y',
           '****', 'gi'
         );
$fn$;

-- ── The originals log ───────────────────────────────────────────────────────
create table if not exists public.message_originals (
  id               uuid primary key default gen_random_uuid(),
  message_kind     text not null check (message_kind in ('group', 'direct')),
  message_id       uuid not null,
  sender_id        uuid not null,
  original_content text not null,
  created_at       timestamptz not null default now()
);

comment on table public.message_originals is
  'Pre-censorship text of chat messages that got masked. Team-only: no RLS policies, no grants — dashboard/service-role reads only.';

alter table public.message_originals enable row level security;
revoke all on public.message_originals from public, anon, authenticated;

-- ── send_group_message: censor + log the original when it changed ──────────
create or replace function public.send_group_message(p_group_id uuid, p_content text)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid      uuid := public.assert_active_caller();
  v_content  text := coalesce(p_content, '');
  v_original text;
  v_msg_id   uuid;
  v_msg_at   timestamptz;
begin
  if not exists (
    select 1 from public.study_group_members m
    where m.group_id = p_group_id and m.user_id = v_uid
  ) then
    raise exception 'NOT_MEMBER';
  end if;
  if not exists (
    select 1 from public.study_groups g
    where g.id = p_group_id and g.status = 'active'
  ) then
    raise exception 'GROUP_UNAVAILABLE';
  end if;
  if char_length(trim(v_content)) < 1 then
    raise exception 'EMPTY_MESSAGE';
  end if;
  if char_length(v_content) > 2000 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;

  v_original := v_content;
  v_content := public.censor_profanity(v_content);

  update public.study_groups
    set last_activity_at = now()
    where study_groups.id = p_group_id;

  insert into public.group_messages (group_id, sender_id, content)
  values (p_group_id, v_uid, v_content)
  returning group_messages.id, group_messages.created_at into v_msg_id, v_msg_at;

  if v_content <> v_original then
    insert into public.message_originals (message_kind, message_id, sender_id, original_content)
    values ('group', v_msg_id, v_uid, v_original);
  end if;

  return query select v_msg_id, v_msg_at;
end;
$fn$;

-- ── send_direct_message: same treatment ────────────────────────────────────
create or replace function public.send_direct_message(p_recipient uuid, p_content text)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid      uuid := public.assert_active_caller();
  v_content  text := coalesce(p_content, '');
  v_original text;
  v_msg_id   uuid;
  v_msg_at   timestamptz;
begin
  if p_recipient = v_uid then
    raise exception 'SELF_ACTION';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_recipient and p.account_status = 'active' and p.display_name is not null
  ) then
    raise exception 'USER_NOT_FOUND';
  end if;
  if public.are_blocked(v_uid, p_recipient) then
    raise exception 'BLOCKED';
  end if;
  if char_length(trim(v_content)) < 1 then
    raise exception 'EMPTY_MESSAGE';
  end if;
  if char_length(v_content) > 2000 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;

  v_original := v_content;
  v_content := public.censor_profanity(v_content);

  insert into public.direct_messages (sender_id, recipient_id, content)
  values (v_uid, p_recipient, v_content)
  returning direct_messages.id, direct_messages.created_at into v_msg_id, v_msg_at;

  if v_content <> v_original then
    insert into public.message_originals (message_kind, message_id, sender_id, original_content)
    values ('direct', v_msg_id, v_uid, v_original);
  end if;

  return query select v_msg_id, v_msg_at;
end;
$fn$;

-- ── 'Unknown' -> 'Deleted User' ────────────────────────────────────────────
create or replace view public.public_profiles as
  select
    p.id,
    case when p.account_status = 'deleted' then 'Deleted User' else p.display_name end
      as display_name,
    case when p.account_status = 'deleted' then null else p.avatar_url end
      as avatar_url
  from public.profiles p
  where p.account_status in ('active', 'deleted');

-- scrub_account_core: only the display_name literal changes.
create or replace function public.scrub_account_core(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_group uuid;
begin
  for v_group in
    select m.group_id from public.study_group_members m where m.user_id = p_uid
  loop
    perform public.leave_group_core(v_group, p_uid);
  end loop;

  update public.join_requests
    set status = 'withdrawn', resolved_at = now()
    where user_id = p_uid and status = 'pending';
  update public.group_invitations
    set status = 'cancelled', resolved_at = now()
    where (invited_user_id = p_uid or inviter_id = p_uid) and status = 'pending';

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

  delete from public.meetup_attendance where user_id = p_uid;
  delete from public.availability_votes where user_id = p_uid;
  delete from public.notifications where recipient_id = p_uid;

  update public.profiles set
    display_name = 'Deleted User',
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
$fn$;

-- One-time: rename tombstones scrubbed under the old wording.
update public.profiles
  set display_name = 'Deleted User'
  where account_status = 'deleted' and display_name = 'Unknown';
