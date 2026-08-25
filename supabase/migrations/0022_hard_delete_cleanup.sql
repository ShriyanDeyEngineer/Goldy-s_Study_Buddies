-- ============================================================================
-- 0022 — deleted on the website means deleted in the database.
--
-- Until now several "delete" actions only flipped a status column and the
-- rows stayed forever:
--   - disbanding a group kept the group row (status 'disbanded') AND all
--     of its chat, meetups, polls, resources, and request history — none
--     of it reachable by anyone, since disband removes every member;
--   - closing an availability poll kept the poll plus every slot (up to
--     400) and every vote, though the UI never renders closed polls;
--   - deleting an account always kept a scrubbed profile row, even when
--     nothing referenced it, and never removed the person's course lists
--     or pending course requests.
--
-- WHAT STILL DELIBERATELY SURVIVES, AND WHY (do not "fix" these):
--   - A deleted account's profile row IS kept whenever the person's
--     messages, meetups, polls, resources, flagged-message log entries,
--     or reports still exist. Chat messages cascade from their sender:
--     hard-deleting such a profile would erase OTHER people's chat and DM
--     history (the 0014 product decision is that old chats stay, shown as
--     "Deleted User"). The tombstone goes away only when nothing points
--     at it any more.
--   - Cancelled meetups: rendered struck-through in the UI as history.
--   - message_originals: the moderation log, admin-only by design.
--
-- Idempotent; the pg_cron section degrades to a NOTICE where the
-- extension isn't available.
-- ============================================================================

-- ── Disband now deletes the group outright ──────────────────────────────────
-- Same signature and callers as before (disband_group, leave_group_core);
-- caller still holds the group's row lock. Notifications go out first —
-- their payload carries a COPY of the name, so they outlive the row —
-- then one DELETE cascades members, join requests, invitations, meetups
-- (and their RSVPs), chat messages, polls (slots, votes), and resources.
-- Old links to the group now 404 instead of showing a tombstone page.
create or replace function public.disband_group_core(p_group public.study_groups, p_skip_notify uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  for r in
    select m.user_id from public.study_group_members m where m.group_id = p_group.id
  loop
    if r.user_id <> p_skip_notify then
      perform public.app_notify(r.user_id, 'group_disbanded',
        jsonb_build_object('group_name', p_group.name, 'course_id', p_group.course_id));
    end if;
  end loop;

  for r in
    select jr.user_id from public.join_requests jr
    where jr.group_id = p_group.id and jr.status = 'pending'
  loop
    perform public.app_notify(r.user_id, 'group_disbanded',
      jsonb_build_object('group_name', p_group.name, 'course_id', p_group.course_id));
  end loop;

  for r in
    select gi.invited_user_id from public.group_invitations gi
    where gi.group_id = p_group.id and gi.status = 'pending'
  loop
    perform public.app_notify(r.invited_user_id, 'group_disbanded',
      jsonb_build_object('group_name', p_group.name, 'course_id', p_group.course_id));
  end loop;

  delete from public.study_groups where id = p_group.id;
end;
$$;

-- ── Closing a poll deletes it ───────────────────────────────────────────────
-- Nothing anywhere renders a closed poll — "close" always meant "we're
-- done with this" — so keeping the poll plus its slot grid and votes was
-- pure dead weight. Same permission rule (creator or manager).
create or replace function public.close_availability_poll(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_poll public.availability_polls%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_poll from public.availability_polls where id = p_poll_id for update;
  if not found then
    raise exception 'POLL_NOT_FOUND';
  end if;
  if v_poll.creator_id <> v_uid
     and not public.is_group_manager(v_poll.group_id, v_uid) then
    raise exception 'NOT_ALLOWED';
  end if;
  delete from public.availability_polls where id = p_poll_id;
end;
$$;

-- ── Account deletion: remove everything removable ───────────────────────────
-- Two changes to scrub_account_core:
--   1. course lists and pending course requests are removed (they were
--      simply forgotten — invisible to users but sitting in the tables,
--      and a deleted user's pending course request lingered in the admin
--      queue);
--   2. when NOTHING references the person any more, the profile row
--      itself is deleted instead of tombstoned. The reference checks
--      mirror reality exactly: messages (both kinds), the moderation
--      log, reports, and the three creator/author columns that have no
--      ON DELETE CASCADE (meetups, polls, resources) and would either
--      block the delete or silently take group content with it.
create or replace function public.scrub_account_core(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

-- ── Recurring purge for invisible lifecycle history ─────────────────────────
-- Resolved requests/invitations and read notifications serve no user- or
-- admin-facing purpose after a while (every screen filters to pending /
-- shows recent), but the rows accumulated forever. 30 days keeps recent
-- history inspectable in the dashboard while capping growth.
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
      and not exists (select 1 from public.group_resources gr where gr.author_id = p.id);
end;
$$;

revoke execute on function public.purge_stale_rows() from public, anon, authenticated;

-- Schedule it nightly (3:30 AM UTC) where pg_cron exists. On a stack
-- without pg_cron this degrades to a NOTICE, and purge_stale_rows() can
-- be scheduled from the dashboard or run by hand instead.
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

-- ── One-time cleanup of rows accumulated under the old rules ────────────────

-- Disbanded tombstone groups (cascades wipe their chat/meetups/polls/
-- resources/request history).
delete from public.study_groups where status = 'disbanded';

-- Closed polls and, by cascade, their slots and votes.
delete from public.availability_polls where status = 'closed';

-- Course lists and pending course requests of already-deleted accounts.
delete from public.user_courses uc
  using public.profiles p
  where p.id = uc.user_id and p.account_status = 'deleted';
delete from public.course_requests cr
  using public.profiles p
  where p.id = cr.requester_id and p.account_status = 'deleted'
    and cr.status = 'pending';

-- Tombstones nothing references any more (same checks as the function).
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
    and not exists (select 1 from public.group_resources gr where gr.author_id = p.id);
