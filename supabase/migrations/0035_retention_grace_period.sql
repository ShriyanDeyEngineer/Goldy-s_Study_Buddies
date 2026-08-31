-- ============================================================================
-- 0035 — one retention grace period for every kind of stored data.
--
-- WHAT THIS FILE DOES
--   Until now the nightly purge (purge_stale_rows(), 0022/0024) used a
--   scatter of windows — 7 days for disbanded groups, 30 for resolved
--   requests / read notifications, 90 for retained emails — and left the
--   biggest categories (DMs, group chat, past meetups, the flagged-message
--   log, resolved reports, …) with NO expiry at all.
--
--   This migration makes ONE number govern all of it, and wires every
--   remaining category into the nightly purge. Nothing in the database
--   outlives the grace period except the course catalog and the
--   universities allow-list, which are kept forever on purpose.
--
-- ── THE KNOB — how to change the grace period ────────────────────────────────
--
--   public.retention_grace_days()            -> 365   (the one number)
--   public.retention_grace_days_moderation() -> delegates to the base
--
--   To change the period for EVERYTHING:
--       create or replace function public.retention_grace_days()
--         returns int language sql stable
--         set search_path = public, pg_temp
--         as $$ select 730 $$;   -- new value here
--
--   Run that one statement — a tiny migration, or straight into the
--   Supabase SQL editor. It takes effect on the next nightly purge. No
--   application deploy, no code change: the purge is 100% SQL + pg_cron and
--   never reads anything from the Next.js side, so the value lives here and
--   ONLY here (there is deliberately no mirror in lib/constants.ts).
--
--   To keep the flagged-message log (message_originals) and resolved
--   reports for LONGER than everything else — an evidence trail — redefine
--   only retention_grace_days_moderation() the same way. Every other
--   category keeps following the base.
--
--   Kill switch: `create or replace ... as $$ select 100000 $$` on
--   retention_grace_days() effectively disables all time-based deletion
--   with no deploy.
--
--   Rollback: docs/retention-rollback.sql restores the 0024 purge body and
--   the pre-0035 delete_account()/scrub_account_core(), and drops the
--   functions added here. Data already deleted by a purge run is only
--   recoverable from a database backup / PITR — take one before deploying.
--
-- ── THE THREE BUCKETS (what expires, and from when) ──────────────────────────
--
--   1. Erased `grace` days after CREATION, unconditionally:
--        direct_messages, group_messages, group_resources,
--        availability_polls (+ slots + votes by cascade),
--        message_originals (moderation knob),
--        meetups (+ attendance by cascade) — aged off scheduled_at, not
--          created_at, so a meetup booked far ahead is never deleted before
--          it happens.
--
--   2. Erased `grace` days after CREATION — which, with equal windows, is
--      always sooner than "grace days after it resolved", so a still-
--      pending / never-read row is capped too:
--        friend_requests, study_buddy_requests, join_requests,
--        group_invitations, course_requests, notifications.
--        reports are the exception: erased `grace` days after they are
--        marked resolved/dismissed (needs reports.resolved_at, added here);
--        an open/reviewing report is NEVER auto-deleted.
--
--   3. Erased `grace` days after a user's own delete/disband decision:
--        study_groups (status='disbanded', from disbanded_at) — and by
--          cascade every child: members, chat, meetups, polls, resources,
--          that group's request/invitation history;
--        a deleted account's satellite data (user_courses, friends,
--          study_buddy_connections, blocks) and its retained email
--          (deleted_account_emails), from profiles.deleted_at (added here);
--        the scrubbed profiles tombstone itself, once the grace period has
--          passed AND nothing else still points at it.
--
--   Account deletion still does its "affects other people" cleanup
--   IMMEDIATELY (leave groups + run manager succession/disband, cancel
--   pending requests both ways, drop RSVPs/poll votes/inbox, scrub PII,
--   free the Google login). Only the satellite data above waits out the
--   grace period. See scrub_account_core() below.
--
-- Idempotent. Safe on a live database. Does NOT run the purge on apply —
-- use preview_stale_purge() first, then let the nightly job take over.
-- ============================================================================

-- ── The knob ────────────────────────────────────────────────────────────────

-- STABLE, not IMMUTABLE: the return value legitimately changes when an
-- operator redefines the function, and STABLE keeps Postgres from constant-
-- folding the old value into a cached plan — so a redefinition reliably
-- takes effect on the very next purge run.
create or replace function public.retention_grace_days()
returns int
language sql
stable
set search_path = public, pg_temp
as $$ select 365 $$;

comment on function public.retention_grace_days() is
  'The single retention grace period, in days. Every category of stored '
  'data is erased this many days after it expires (see migration 0035). '
  'Change the period by redefining this one function.';

-- Separate seam for the two moderation/evidence tables (message_originals,
-- reports). Returns the base today; redefine it alone to keep those longer.
create or replace function public.retention_grace_days_moderation()
returns int
language sql
stable
set search_path = public, pg_temp
as $$ select public.retention_grace_days() $$;

comment on function public.retention_grace_days_moderation() is
  'Grace period for message_originals and resolved reports. Delegates to '
  'retention_grace_days(); redefine independently to retain the moderation '
  'record longer than everything else.';

-- Cutoff timestamps — one place for the arithmetic, shared by the purge
-- and the preview. STABLE (they read now()), not IMMUTABLE.
create or replace function public.retention_cutoff()
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$ select now() - make_interval(days => public.retention_grace_days()) $$;

create or replace function public.retention_cutoff_moderation()
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$ select now() - make_interval(days => public.retention_grace_days_moderation()) $$;

revoke execute on function public.retention_cutoff() from public, anon;
revoke execute on function public.retention_cutoff_moderation() from public, anon;

-- ── Schema: two "when did this expire?" timestamps we did not record ─────────

-- profiles.deleted_at — times bucket 3 for a deleted account. Existing
-- tombstones get a fresh clock from this migration.
alter table public.profiles add column if not exists deleted_at timestamptz;

comment on column public.profiles.deleted_at is
  'When the account was deleted (self-service or dashboard). The tombstone '
  'row, the account''s social-graph edges, course list, and retained email '
  'are purged retention_grace_days() days after this. NULL for live accounts.';

update public.profiles
  set deleted_at = now()
  where account_status = 'deleted' and deleted_at is null;

create index if not exists profiles_deleted_at_idx
  on public.profiles (deleted_at)
  where account_status = 'deleted';

-- reports.resolved_at — reports (0007) never recorded when they closed.
alter table public.reports add column if not exists resolved_at timestamptz;

comment on column public.reports.resolved_at is
  'When the report was marked resolved/dismissed. Set by a trigger. The '
  'row is purged retention_grace_days_moderation() days after this; an '
  'open/reviewing report (resolved_at NULL) is never auto-deleted.';

update public.reports
  set resolved_at = created_at
  where status in ('resolved', 'dismissed') and resolved_at is null;

create index if not exists reports_resolved_at_idx
  on public.reports (resolved_at)
  where status in ('resolved', 'dismissed');

-- ── Indexes for the nightly purge's own scans ───────────────────────────────
-- Every night the job does `delete ... where created_at < cutoff` (or
-- scheduled_at) on these tables. The high-volume ones had no index that a
-- bare timestamp range could use — a full scan per table per night as they
-- grow. (message_originals already got one in 0033; the low-volume request
-- tables are left to scan — they stay small.)
create index if not exists direct_messages_created_at_idx on public.direct_messages (created_at);
create index if not exists group_messages_created_at_idx  on public.group_messages (created_at);
create index if not exists notifications_created_at_idx    on public.notifications (created_at);
create index if not exists meetups_scheduled_at_idx        on public.meetups (scheduled_at);

-- Stamp resolved_at whenever status crosses into / out of a closed state,
-- by ANY path (admin action, dashboard, SQL editor).
create or replace function public.stamp_report_resolved_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status in ('resolved', 'dismissed')
     and coalesce(old.status, '') not in ('resolved', 'dismissed') then
    new.resolved_at := now();
  elsif new.status in ('open', 'reviewing')
     and old.status in ('resolved', 'dismissed') then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists reports_stamp_resolved_at on public.reports;
create trigger reports_stamp_resolved_at
  before update on public.reports
  for each row execute function public.stamp_report_resolved_at();

-- Comments on the two windows that changed (were 7 / 90 days).
comment on column public.study_groups.disbanded_at is
  'When the group was disbanded. retention_grace_days() days later the '
  'nightly purge deletes the row, cascading away chat, meetups, polls, '
  'resources, and request history. NULL for active groups.';

comment on table public.deleted_account_emails is
  'Email addresses of deleted accounts, kept for a possible '
  'law-enforcement request tied to an id left on old data. Not exposed to '
  'the app or admin dashboard — service-role reads only. Purged '
  'retention_grace_days() days after deleted_at by purge_stale_rows().';

-- ── Account deletion: immediate "affects others" cleanup + PII scrub;
--    everything else waits out the grace period ─────────────────────────────

create or replace function public.scrub_account_core(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group uuid;
begin
  -- Preserve the real email before it is overwritten below. Guarded to the
  -- not-yet-deleted case so a stray re-invocation never captures the
  -- placeholder. Purged retention_grace_days() days after deleted_at.
  insert into public.deleted_account_emails (id, email)
  select p.id, p.email
  from public.profiles p
  where p.id = p_uid and p.account_status <> 'deleted'
  on conflict (id) do nothing;

  -- 1. Leave every group NOW. leave_group_core() owns manager succession
  --    and last-member disband — none of that may wait for the grace
  --    period, or the remaining members are stuck with a dead manager.
  for v_group in
    select m.group_id from public.study_group_members m where m.user_id = p_uid
  loop
    perform public.leave_group_core(v_group, p_uid);
  end loop;

  -- 2. Cancel pending paperwork in BOTH directions NOW — a live request
  --    from a deleted account is nonsense to the person on the other end.
  update public.join_requests
    set status = 'withdrawn', resolved_at = now()
    where user_id = p_uid and status = 'pending';
  update public.group_invitations
    set status = 'cancelled', resolved_at = now()
    where (invited_user_id = p_uid or inviter_id = p_uid) and status = 'pending';
  update public.friend_requests
    set status = 'cancelled', resolved_at = now()
    where (sender_id = p_uid or recipient_id = p_uid) and status = 'pending';
  update public.study_buddy_requests
    set status = 'cancelled', resolved_at = now()
    where (sender_id = p_uid or recipient_id = p_uid) and status = 'pending';

  -- 3. Remove what OTHER users would see change (RSVP counts, poll
  --    tallies), the private inbox, and a pending course request that would
  --    otherwise sit in the admin queue under "Deleted User". All cheaply
  --    gone now rather than lingering the full year.
  delete from public.meetup_attendance where user_id = p_uid;
  delete from public.availability_votes where user_id = p_uid;
  delete from public.notifications where recipient_id = p_uid;
  delete from public.course_requests where requester_id = p_uid and status = 'pending';

  -- 4. Scrub PII immediately — account deletion is irreversible, so nothing
  --    will ever read these fields again — and stamp the tombstone. The row
  --    itself, the social-graph edges (friends / buddy connections /
  --    blocks), the course list, and the retained email all age out
  --    together retention_grace_days() days after deleted_at, in
  --    purge_stale_rows().
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
    account_status = 'deleted',
    deleted_at = now()
  where id = p_uid;
end;
$$;

revoke execute on function public.scrub_account_core(uuid) from public, anon, authenticated;

-- delete_account(): unchanged behaviour — scrub now, then free the Google
-- identity so the person can immediately sign up again with a brand-new id.
-- Restated here so 0035 documents the whole deletion path in one place.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Bare auth check on purpose: a suspended account may still delete itself.
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  perform public.scrub_account_core(v_uid);

  -- The auth row (and its sessions/identities) goes now: the next
  -- "Sign in with Google" creates a fresh account with a new id. The
  -- scrubbed profile tombstone survives (the FK to auth.users is gone —
  -- migration 0016) and is purged after the grace period.
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- ── The nightly purge — every bucket, one grace period ──────────────────────

create or replace function public.purge_stale_rows()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cut     timestamptz := public.retention_cutoff();
  v_cut_mod timestamptz := public.retention_cutoff_moderation();
begin
  -- ── Bucket 1: erased `grace` days after creation, unconditionally ─────────
  delete from public.direct_messages   where created_at < v_cut;
  delete from public.group_messages    where created_at < v_cut;
  delete from public.group_resources   where created_at < v_cut;
  -- meetups age off scheduled_at (a far-future booking is not deleted
  -- before it happens); meetup_attendance cascades.
  delete from public.meetups           where scheduled_at < v_cut;
  -- availability_polls: slots and votes cascade. close_availability_poll()
  -- still deletes a poll the moment it is closed (0022) — this only sweeps
  -- polls nobody ever closed.
  delete from public.availability_polls where created_at < v_cut;
  -- the flagged-message log: its own (moderation) window.
  delete from public.message_originals where created_at < v_cut_mod;

  -- ── Bucket 2: capped at `grace` days after creation ──────────────────────
  -- With equal windows, created_at + grace is always <= resolved_at + grace,
  -- so a single created_at cutoff covers resolved AND still-pending rows.
  -- (If the team ever wants resolved rows gone SOONER than the pending
  --  backstop, add a retention_grace_days_resolved() knob and an
  --  `or (status <> 'pending' and resolved_at < <that cutoff>)` clause.)
  delete from public.friend_requests      where created_at < v_cut;
  delete from public.study_buddy_requests  where created_at < v_cut;
  delete from public.join_requests         where created_at < v_cut;
  delete from public.group_invitations     where created_at < v_cut;
  delete from public.course_requests       where created_at < v_cut;
  delete from public.notifications         where created_at < v_cut;

  -- reports: only after a human closes them (resolved_at set by trigger).
  -- An open/reviewing report is never auto-deleted.
  delete from public.reports
    where status in ('resolved', 'dismissed')
      and resolved_at is not null
      and resolved_at < v_cut_mod;

  -- ── Bucket 3: `grace` days after a delete/disband decision ───────────────
  -- Disbanded groups. This one DELETE cascades away the whole group: chat,
  -- meetups (+ RSVPs), polls (+ slots + votes), resources, members, and
  -- request/invitation history. Runs BEFORE the tombstone sweep so a group
  -- delete can free the deleted-user profile it was the last thing holding.
  -- coalesce() covers rows disbanded before disbanded_at existed.
  delete from public.study_groups
    where status = 'disbanded'
      and coalesce(disbanded_at, updated_at) < v_cut;

  -- A deleted account's satellite data, `grace` days after deleted_at.
  -- (coalesce to updated_at defends against a null deleted_at that the
  --  backfill above somehow missed.)
  delete from public.user_courses uc
    using public.profiles p
    where p.id = uc.user_id
      and p.account_status = 'deleted'
      and coalesce(p.deleted_at, p.updated_at) < v_cut;

  delete from public.friends f
    using public.profiles p
    where p.account_status = 'deleted'
      and coalesce(p.deleted_at, p.updated_at) < v_cut
      and (p.id = f.user_id_a or p.id = f.user_id_b);

  delete from public.study_buddy_connections c
    using public.profiles p
    where p.account_status = 'deleted'
      and coalesce(p.deleted_at, p.updated_at) < v_cut
      and (p.id = c.user_id_a or p.id = c.user_id_b);

  delete from public.blocks b
    using public.profiles p
    where p.account_status = 'deleted'
      and coalesce(p.deleted_at, p.updated_at) < v_cut
      and (p.id = b.blocker_id or p.id = b.blocked_id);

  delete from public.deleted_account_emails
    where deleted_at < v_cut;

  -- The scrubbed tombstone itself: grace period elapsed AND nothing else
  -- still points at it (chat cascades from sender_id; the creator/author/
  -- manager columns below have no cascade and would block or mis-cascade).
  delete from public.profiles p
    where p.account_status = 'deleted'
      and coalesce(p.deleted_at, p.updated_at) < v_cut
      and not exists (select 1 from public.group_messages gm      where gm.sender_id = p.id)
      and not exists (select 1 from public.direct_messages dm      where dm.sender_id = p.id or dm.recipient_id = p.id)
      and not exists (select 1 from public.message_originals mo    where mo.sender_id = p.id)
      and not exists (select 1 from public.reports r               where r.reporter_id = p.id or r.reported_user_id = p.id)
      and not exists (select 1 from public.meetups m               where m.creator_id = p.id)
      and not exists (select 1 from public.availability_polls ap   where ap.creator_id = p.id)
      and not exists (select 1 from public.group_resources gr      where gr.author_id = p.id)
      and not exists (select 1 from public.study_groups sg         where sg.manager_id = p.id);
end;
$$;

revoke execute on function public.purge_stale_rows() from public, anon, authenticated;

-- ── Dry run: what WOULD the next purge delete? ──────────────────────────────
-- Direct row matches only — cascades (attendance from meetups, slots/votes
-- from polls, all group children from a disbanded group) are additional.
-- Service-role / SQL-editor only. Run this and eyeball the counts before
-- trusting the nightly job:  select * from public.preview_stale_purge();
create or replace function public.preview_stale_purge()
returns table (bucket text, target text, rows_matched bigint)
language sql
security definer
set search_path = public, pg_temp
as $$
  with cut as (
    select public.retention_cutoff() as v, public.retention_cutoff_moderation() as v_mod
  )
  select '1 created+grace'::text, 'direct_messages'::text, count(*) from public.direct_messages, cut where created_at < v
  union all
  select '1 created+grace', 'group_messages',    count(*) from public.group_messages,    cut where created_at < v
  union all
  select '1 created+grace', 'group_resources',   count(*) from public.group_resources,   cut where created_at < v
  union all
  select '1 scheduled+grace', 'meetups',         count(*) from public.meetups,           cut where scheduled_at < v
  union all
  select '1 created+grace', 'availability_polls', count(*) from public.availability_polls, cut where created_at < v
  union all
  select '1 created+grace(mod)', 'message_originals', count(*) from public.message_originals, cut where created_at < v_mod
  union all
  select '2 created+grace', 'friend_requests',   count(*) from public.friend_requests,   cut where created_at < v
  union all
  select '2 created+grace', 'study_buddy_requests', count(*) from public.study_buddy_requests, cut where created_at < v
  union all
  select '2 created+grace', 'join_requests',     count(*) from public.join_requests,     cut where created_at < v
  union all
  select '2 created+grace', 'group_invitations', count(*) from public.group_invitations, cut where created_at < v
  union all
  select '2 created+grace', 'course_requests',   count(*) from public.course_requests,   cut where created_at < v
  union all
  select '2 created+grace', 'notifications',     count(*) from public.notifications,     cut where created_at < v
  union all
  select '2 resolved+grace(mod)', 'reports', count(*) from public.reports, cut
    where status in ('resolved','dismissed') and resolved_at is not null and resolved_at < v_mod
  union all
  select '3 disbanded+grace', 'study_groups', count(*) from public.study_groups, cut
    where status = 'disbanded' and coalesce(disbanded_at, updated_at) < v
  union all
  select '3 deleted_at+grace', 'user_courses', count(*) from public.user_courses uc, cut
    where exists (select 1 from public.profiles p where p.id = uc.user_id
      and p.account_status = 'deleted' and coalesce(p.deleted_at, p.updated_at) < v)
  union all
  select '3 deleted_at+grace', 'friends', count(*) from public.friends f, cut
    where exists (select 1 from public.profiles p where p.account_status = 'deleted'
      and coalesce(p.deleted_at, p.updated_at) < v and (p.id = f.user_id_a or p.id = f.user_id_b))
  union all
  select '3 deleted_at+grace', 'study_buddy_connections', count(*) from public.study_buddy_connections c, cut
    where exists (select 1 from public.profiles p where p.account_status = 'deleted'
      and coalesce(p.deleted_at, p.updated_at) < v and (p.id = c.user_id_a or p.id = c.user_id_b))
  union all
  select '3 deleted_at+grace', 'blocks', count(*) from public.blocks b, cut
    where exists (select 1 from public.profiles p where p.account_status = 'deleted'
      and coalesce(p.deleted_at, p.updated_at) < v and (p.id = b.blocker_id or p.id = b.blocked_id))
  union all
  select '3 deleted_at+grace', 'deleted_account_emails', count(*) from public.deleted_account_emails, cut
    where deleted_at < v
  union all
  select '3 tombstone sweep', 'profiles', count(*) from public.profiles p, cut
    where p.account_status = 'deleted'
      and coalesce(p.deleted_at, p.updated_at) < v
      and not exists (select 1 from public.group_messages gm    where gm.sender_id = p.id)
      and not exists (select 1 from public.direct_messages dm    where dm.sender_id = p.id or dm.recipient_id = p.id)
      and not exists (select 1 from public.message_originals mo  where mo.sender_id = p.id)
      and not exists (select 1 from public.reports r             where r.reporter_id = p.id or r.reported_user_id = p.id)
      and not exists (select 1 from public.meetups m             where m.creator_id = p.id)
      and not exists (select 1 from public.availability_polls ap where ap.creator_id = p.id)
      and not exists (select 1 from public.group_resources gr    where gr.author_id = p.id)
      and not exists (select 1 from public.study_groups sg       where sg.manager_id = p.id);
$$;

revoke execute on function public.preview_stale_purge() from public, anon, authenticated;

-- ── Keep the nightly schedule ──────────────────────────────────────────────
-- Same job name and command as 0022, so only the function BODY changed and
-- a rollback needs no cron surgery. cron.schedule() upserts by name, so
-- re-asserting it here is harmless if 0022 already created it.
do $cron$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('purge-stale-rows', '30 3 * * *',
                        'select public.purge_stale_rows()');
exception when others then
  raise notice
    'pg_cron unavailable — run "select public.purge_stale_rows();" on a schedule of your choosing instead.';
end
$cron$;

-- NOT run on apply. Verify first with:  select * from public.preview_stale_purge();
