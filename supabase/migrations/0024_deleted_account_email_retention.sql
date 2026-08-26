-- ============================================================================
-- 0024 — retain a deleted account's email for law-enforcement handover.
--
-- scrub_account_core() (0022) overwrites profiles.email with a placeholder
-- ('deleted+<uuid>@deleted.invalid') the moment an account is deleted, so
-- once that runs there is no way to tell law enforcement which real person
-- a since-deleted id (still visible on old messages, reports, etc.) belongs
-- to — exactly the gap this migration closes.
--
-- deleted_account_emails is a narrow, deliberately locked-down table:
--   - id is the SAME id as the (now-scrubbed) profiles/auth.users row, so
--     it joins directly against any id still sitting on a message, report,
--     or flagged-message log entry.
--   - RLS is enabled with NO policies at all, and there is no grant to
--     anon/authenticated — unlike is_admin() reads elsewhere, this is not
--     exposed through the app or its admin dashboard in any way. The only
--     way to read it is the Supabase SQL editor / a service-role key, by
--     hand, when an actual request from authorities needs an email tied to
--     an id. Same "no in-app path, on purpose" posture as is_admin (0020).
--   - The capture happens inside scrub_account_core() itself — the single
--     choke point both delete_account() (self-service) and
--     handle_deleted_auth_user() (dashboard/admin-API deletions, 0016)
--     already funnel through — so every deletion path is covered without
--     duplicating logic. It reads the email BEFORE the scrub's UPDATE
--     overwrites it, and is guarded to only fire once per account
--     (account_status <> 'deleted' at read time; on conflict do nothing).
--
-- RETENTION: 90 days. Long enough to be a realistic window for an incident
-- to surface and a law-enforcement request to arrive and be matched to it;
-- short enough that we are not indefinitely warehousing emails for people
-- who asked to be deleted. Purged by the same nightly purge_stale_rows()
-- job (0022) — no new cron schedule needed.
-- ============================================================================

create table public.deleted_account_emails (
  id         uuid primary key,
  email      text not null,
  deleted_at timestamptz not null default now()
);

comment on table public.deleted_account_emails is
  'Email addresses of deleted accounts, kept only long enough to answer a '
  'law-enforcement request tied to an id left on old data (messages, '
  'reports, flagged-message log). Not exposed to the app or admin '
  'dashboard — read via the SQL editor / service role only. Rows older '
  'than 90 days are purged nightly by purge_stale_rows().';
comment on column public.deleted_account_emails.id is
  'Same id as the (now-scrubbed) profiles row / former auth.users row.';
comment on column public.deleted_account_emails.deleted_at is
  'When the account was deleted; purge_stale_rows() removes rows 90 days '
  'past this.';

alter table public.deleted_account_emails enable row level security;
-- No policies, no grants to anon/authenticated: default-deny for every
-- role the API can authenticate as. Intentionally more locked down than
-- is_admin() reads — see the header note above.

-- ── Capture the real email at the one choke point every deletion path
--    already runs through, right before it gets overwritten ──────────────
create or replace function public.scrub_account_core(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group uuid;
begin
  -- Preserve the real email for a possible future law-enforcement
  -- request, before it's overwritten below. Guarded to the not-yet-
  -- deleted case so a stray re-invocation never captures the placeholder.
  insert into public.deleted_account_emails (id, email)
  select p.id, p.email
  from public.profiles p
  where p.id = p_uid and p.account_status <> 'deleted'
  on conflict (id) do nothing;

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
     -- A disbanded group's tombstone still points at its last manager
     -- (manager_id has no CASCADE) for the seven-day grace window.
     and not exists (select 1 from public.study_groups sg where sg.manager_id = p_uid)
  then
    -- Nothing points at this person: no tombstone needed, the row goes.
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

-- ── Extend the existing nightly purge to age out old email retention ───────
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

  -- Disbanded groups past their seven-day grace window. This one DELETE
  -- cascades away the whole group: chat, meetups (and RSVPs), polls
  -- (slots, votes), resources, and request/invitation history.
  -- coalesce() covers rows disbanded before disbanded_at existed —
  -- their updated_at was last touched by the disband itself. Runs
  -- BEFORE the tombstone sweep below on purpose: deleting a group can
  -- free the deleted-user profiles it was the last thing referencing.
  delete from public.study_groups
    where status = 'disbanded'
      and coalesce(disbanded_at, updated_at) < now() - interval '7 days';

  -- Tombstones whose last reference has since disappeared (e.g. the one
  -- group that held a deleted user's messages later disbanded). Same
  -- guards as scrub_account_core — the moment nothing points at a
  -- deleted account, its row can finally go.
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

  -- Retained deleted-account emails past their 90-day law-enforcement
  -- handover window (see migration 0024 header).
  delete from public.deleted_account_emails
    where deleted_at < now() - interval '90 days';
end;
$$;

revoke execute on function public.purge_stale_rows() from public, anon, authenticated;

-- NOTE: this only covers accounts deleted FROM NOW ON. Anyone already
-- deleted under the old rules had profiles.email (and auth.users
-- entirely) overwritten/removed by scrub_account_core before this
-- migration existed — that real email is unrecoverable; there is nothing
-- left anywhere in the database to backfill it from.
