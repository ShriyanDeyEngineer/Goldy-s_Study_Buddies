-- ============================================================================
-- retention-rollback.sql — undo migration 0035 on the database.
--
-- WHEN TO RUN THIS
--   You reverted the 0035 code (git) and want the database back to its
--   pre-0035 behaviour: the old scattered windows (7 / 30 / 90 days) and
--   the old immediate account-deletion scrub.
--
-- HOW TO RUN
--   Paste the whole file into the Supabase SQL editor (default "postgres"
--   role) and Run. It is one transaction; nothing is dropped that would
--   lose data.
--
-- WHAT IT DOES
--   1. Restores purge_stale_rows(), scrub_account_core(), delete_account()
--      to their migration 0024 / 0016 bodies verbatim.
--   2. Drops the trigger + functions 0035 added.
--   3. Leaves profiles.deleted_at and reports.resolved_at in place — they
--      are additive columns that nothing else depends on and dropping them
--      is the only irreversible step here. Uncomment the block at the end
--      if you want a pristine schema.
--
--   The pg_cron job ('purge-stale-rows', '30 3 * * *',
--   'select public.purge_stale_rows()') is UNCHANGED by 0035 — name and
--   command are identical — so there is nothing to undo there.
--
--   Rows already deleted by a post-0035 purge run are NOT recoverable from
--   this script. Restore them from a database backup / PITR.
-- ============================================================================

begin;

-- ── 1a. scrub_account_core() — migration 0024 body ──────────────────────────
create or replace function public.scrub_account_core(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group uuid;
begin
  insert into public.deleted_account_emails (id, email)
  select p.id, p.email
  from public.profiles p
  where p.id = p_uid and p.account_status <> 'deleted'
  on conflict (id) do nothing;

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
  delete from public.user_courses where user_id = p_uid;
  delete from public.course_requests
    where requester_id = p_uid and status = 'pending';

  if not exists (select 1 from public.group_messages gm where gm.sender_id = p_uid)
     and not exists (select 1 from public.direct_messages dm
                     where dm.sender_id = p_uid or dm.recipient_id = p_uid)
     and not exists (select 1 from public.message_originals mo where mo.sender_id = p_uid)
     and not exists (select 1 from public.reports r
                     where r.reporter_id = p_uid or r.reported_user_id = p_uid)
     and not exists (select 1 from public.meetups m where m.creator_id = p_uid)
     and not exists (select 1 from public.availability_polls ap where ap.creator_id = p_uid)
     and not exists (select 1 from public.group_resources gr where gr.author_id = p_uid)
     and not exists (select 1 from public.study_groups sg where sg.manager_id = p_uid)
  then
    delete from public.profiles where id = p_uid;
  else
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
  end if;
end;
$$;

revoke execute on function public.scrub_account_core(uuid) from public, anon, authenticated;

-- ── 1b. delete_account() — migration 0016 body ─────────────────────────────
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  perform public.scrub_account_core(v_uid);

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- ── 1c. purge_stale_rows() — migration 0024 body ──────────────────────────
create or replace function public.purge_stale_rows()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.friend_requests
    where status <> 'pending' and resolved_at < now() - interval '30 days';
  delete from public.study_buddy_requests
    where status <> 'pending' and resolved_at < now() - interval '30 days';
  delete from public.join_requests
    where status <> 'pending' and resolved_at < now() - interval '30 days';
  delete from public.group_invitations
    where status <> 'pending' and resolved_at < now() - interval '30 days';
  delete from public.notifications
    where read_at is not null and read_at < now() - interval '30 days';

  delete from public.study_groups
    where status = 'disbanded'
      and coalesce(disbanded_at, updated_at) < now() - interval '7 days';

  delete from public.profiles p
    where p.account_status = 'deleted'
      and not exists (select 1 from public.group_messages gm where gm.sender_id = p.id)
      and not exists (select 1 from public.direct_messages dm
                      where dm.sender_id = p.id or dm.recipient_id = p.id)
      and not exists (select 1 from public.message_originals mo where mo.sender_id = p.id)
      and not exists (select 1 from public.reports r
                      where r.reporter_id = p.id or r.reported_user_id = p.id)
      and not exists (select 1 from public.meetups m where m.creator_id = p.id)
      and not exists (select 1 from public.availability_polls ap where ap.creator_id = p.id)
      and not exists (select 1 from public.group_resources gr where gr.author_id = p.id)
      and not exists (select 1 from public.study_groups sg where sg.manager_id = p.id);

  delete from public.deleted_account_emails
    where deleted_at < now() - interval '90 days';
end;
$$;

revoke execute on function public.purge_stale_rows() from public, anon, authenticated;

-- ── 2. Drop what 0035 added ────────────────────────────────────────────────
drop trigger if exists reports_stamp_resolved_at on public.reports;
drop function if exists public.stamp_report_resolved_at();
drop function if exists public.preview_stale_purge();
drop function if exists public.retention_cutoff();
drop function if exists public.retention_cutoff_moderation();
drop function if exists public.retention_grace_days_moderation();
drop function if exists public.retention_grace_days();

drop index if exists public.direct_messages_created_at_idx;
drop index if exists public.group_messages_created_at_idx;
drop index if exists public.notifications_created_at_idx;
drop index if exists public.meetups_scheduled_at_idx;
drop index if exists public.reports_resolved_at_idx;
drop index if exists public.profiles_deleted_at_idx;

commit;

-- ── 3. Optional: also drop the additive columns (IRREVERSIBLE — the
--        deleted_at / resolved_at values are lost). Only if you want the
--        schema exactly as it was pre-0035.
-- alter table public.profiles drop column if exists deleted_at;
-- alter table public.reports  drop column if exists resolved_at;
