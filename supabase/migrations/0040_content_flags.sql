-- ============================================================================
-- 0040 — user content flags: "a human should look at this".
--
-- WHAT THIS FILE DOES
--   The `reports` table (0007) lets a student report another STUDENT. This
--   adds the complementary tool: flagging one specific PIECE OF CONTENT —
--   a single group-chat message, a direct message, or a shared group
--   resource — as inappropriate, so the team can review it. Managers can
--   already delete resources and the profanity filter masks slurs; this is
--   the lightweight escalation path for everything that slips through.
--
-- INVISIBLE TO EVERYONE BUT THE FLAGGER AND ADMINS
--   Flagging writes ONLY to this table — never to the content row — so no
--   other member sees any change, there is no realtime event (this table
--   is deliberately NOT in the supabase_realtime publication), and no
--   notification fires. RLS returns a flag row to exactly two audiences:
--   the person who created it (so their UI can show the toggle state and
--   let them unflag) and admins (profiles.is_admin). A third party cannot
--   even tell a flag exists.
--
-- SELF-CONTAINED RECORD
--   Each row snapshots the flagged text at flag time (content_snapshot),
--   mirroring message_originals (0023). That is what lets an admin review
--   a flagged DM WITHOUT any broad direct-message read access — they see
--   only the one message the flagger chose to surface — and it keeps the
--   moderation record intact after the underlying content is deleted or
--   purged.
--
-- Standard shape: members-only visibility enforced in the SECURITY DEFINER
-- writers; narrow RLS + explicit grants for reads; every row ages out
-- under the one retention grace period (0035).
--
-- Idempotent.
-- ============================================================================

create table if not exists public.content_flags (
  id                 uuid primary key default gen_random_uuid(),
  flagger_id         uuid not null references public.profiles (id) on delete cascade,
  -- Which kind of content, and its id in the matching table. Polymorphic,
  -- so no foreign key on content_id — the writers below resolve it.
  content_type       text not null check (content_type in
    ('group_message', 'direct_message', 'group_resource')),
  content_id         uuid not null,
  -- Who posted the flagged item. set null (not cascade) so a flag survives
  -- the author's account deletion as an anonymised record.
  content_author_id  uuid references public.profiles (id) on delete set null,
  -- The group the content belongs to (message or resource); NULL for DMs.
  -- Cascade: a purged disbanded group takes its flags with it, like every
  -- other child row.
  group_id           uuid references public.study_groups (id) on delete cascade,
  -- The text the flagger saw, captured now: the masked message body, or a
  -- resource's title + note/link. Survives deletion/purge of the content.
  content_snapshot   text not null,
  content_created_at timestamptz,
  -- Optional short note from the flagger for the team.
  reason             text check (reason is null or char_length(reason) <= 1000),
  status             text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  -- Set by trigger when status crosses into a closed state; drives the
  -- purge (0035 moderation window). NULL while open/reviewing.
  resolved_at        timestamptz,
  created_at         timestamptz not null default now(),
  -- One flag per person per item — re-flagging is a no-op.
  unique (flagger_id, content_type, content_id)
);

comment on table public.content_flags is
  'User flags on individual pieces of content (a group message, a DM, or a '
  'group resource). Read only by the flagger (their own rows) or an admin '
  '(profiles.is_admin) — invisible to everyone else, including the content '
  'author. Not in the supabase_realtime publication. Written via '
  'flag_content(); removed via unflag_content().';
comment on column public.content_flags.content_snapshot is
  'The text the flagger saw, captured at flag time (masked message body, or '
  'resource title + body). Lets an admin review a flagged DM without DM '
  'read access, and preserves the record after the content is purged.';

create index if not exists content_flags_open_idx
  on public.content_flags (status, created_at) where status = 'open';
create index if not exists content_flags_content_idx
  on public.content_flags (content_type, content_id);
create index if not exists content_flags_group_idx
  on public.content_flags (group_id) where group_id is not null;
create index if not exists content_flags_resolved_idx
  on public.content_flags (resolved_at)
  where status in ('resolved', 'dismissed');

alter table public.content_flags enable row level security;

-- A flagger sees ONLY their own flags — enough to render the toggle and to
-- unflag. No other regular user can see that a flag exists at all.
drop policy if exists "flaggers read own flags" on public.content_flags;
create policy "flaggers read own flags"
  on public.content_flags for select
  to authenticated
  using (flagger_id = (select auth.uid()));

-- Admins see every flag and move it through its lifecycle.
drop policy if exists "admins read all content flags" on public.content_flags;
create policy "admins read all content flags"
  on public.content_flags for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins update content flags" on public.content_flags;
create policy "admins update content flags"
  on public.content_flags for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Grants (see the note in 0001): the RLS policies above narrow these to
-- the flagger (SELECT) and admins (SELECT + UPDATE for the status
-- lifecycle). Flagging/unflagging goes through the functions below, so no
-- INSERT/DELETE grant. Same shape as reports (0007).
grant select, update on public.content_flags to authenticated;

-- ── resolved_at stamping (mirror of stamp_report_resolved_at, 0035) ─────────
create or replace function public.stamp_content_flag_resolved_at()
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

drop trigger if exists content_flags_stamp_resolved_at on public.content_flags;
create trigger content_flags_stamp_resolved_at
  before update on public.content_flags
  for each row execute function public.stamp_content_flag_resolved_at();

-- ── flag_content ────────────────────────────────────────────────────────────
-- Files (or refreshes) the caller's flag on one item. Enforces that the
-- caller can actually SEE the content — a non-member cannot flag a group's
-- message, and neither participant's counterpart can flag a DM they are not
-- in. Returns the flag id.
create or replace function public.flag_content(
  p_content_type text,
  p_content_id   uuid,
  p_reason       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := public.assert_active_caller();
  v_reason    text := nullif(trim(coalesce(p_reason, '')), '');
  v_id        uuid;
  v_group     uuid;
  v_author    uuid;
  v_snapshot  text;
  v_made_at   timestamptz;
  -- direct-message lookup
  v_dm_sender uuid;
  v_dm_recip  uuid;
  -- resource lookup
  v_res_title text;
  v_res_body  text;
begin
  if p_content_type not in ('group_message', 'direct_message', 'group_resource') then
    raise exception 'INVALID_CONTENT_TYPE';
  end if;
  if v_reason is not null and char_length(v_reason) > 1000 then
    raise exception 'REASON_TOO_LONG';
  end if;

  if p_content_type = 'group_message' then
    select gm.group_id, gm.sender_id, gm.content, gm.created_at
      into v_group, v_author, v_snapshot, v_made_at
      from public.group_messages gm
      where gm.id = p_content_id;
    if not found or not public.is_group_member(v_group, v_uid) then
      raise exception 'CONTENT_NOT_FOUND';
    end if;

  elsif p_content_type = 'direct_message' then
    select dm.sender_id, dm.recipient_id, dm.content, dm.created_at
      into v_dm_sender, v_dm_recip, v_snapshot, v_made_at
      from public.direct_messages dm
      where dm.id = p_content_id;
    if not found or v_uid not in (v_dm_sender, v_dm_recip) then
      raise exception 'CONTENT_NOT_FOUND';
    end if;
    v_group  := null;
    v_author := v_dm_sender;

  else  -- group_resource
    select gr.group_id, gr.author_id, gr.title, gr.content, gr.created_at
      into v_group, v_author, v_res_title, v_res_body, v_made_at
      from public.group_resources gr
      where gr.id = p_content_id;
    if not found or not public.is_group_member(v_group, v_uid) then
      raise exception 'CONTENT_NOT_FOUND';
    end if;
    v_snapshot := v_res_title || E'\n' || v_res_body;
  end if;

  -- You cannot flag your own content (matches report_user's SELF_ACTION).
  if v_author = v_uid then
    raise exception 'SELF_ACTION';
  end if;

  insert into public.content_flags
    (flagger_id, content_type, content_id, content_author_id, group_id,
     content_snapshot, content_created_at, reason)
  values
    (v_uid, p_content_type, p_content_id, v_author, v_group,
     v_snapshot, v_made_at, v_reason)
  on conflict (flagger_id, content_type, content_id)
    do update set reason = coalesce(nullif(excluded.reason, ''), public.content_flags.reason)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.flag_content(text, uuid, text) from public, anon;
grant execute on function public.flag_content(text, uuid, text) to authenticated;

-- ── unflag_content ─────────────────────────────────────────────────────────
-- Removes the caller's own flag. Idempotent — no error if there was none
-- (the control is a toggle). Bare auth check so a locked-out account can
-- still retract a flag.
create or replace function public.unflag_content(
  p_content_type text,
  p_content_id   uuid
)
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
  delete from public.content_flags
    where flagger_id = v_uid
      and content_type = p_content_type
      and content_id = p_content_id;
end;
$$;

revoke execute on function public.unflag_content(text, uuid) from public, anon;
grant execute on function public.unflag_content(text, uuid) to authenticated;

-- ── Retention: wire content_flags into the nightly purge (0035) ─────────────
-- content_flags follow the same rule as reports: erased
-- retention_grace_days_moderation() days after a moderator closes them; an
-- open/reviewing flag is never auto-deleted. Flags on group content also
-- cascade away with a purged disbanded group, and a flagger's flags cascade
-- when their tombstone is finally swept — so the profiles tombstone sweep's
-- not-exists() guard is deliberately NOT extended to this table
-- (content_author_id set-nulls, flagger_id cascades, and content_snapshot
-- preserves the evidence regardless).
--
-- Both functions below are reproduced verbatim from 0035 with the two
-- content_flags lines added.
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

  -- content_flags: same rule as reports (see 0040).
  delete from public.content_flags
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
  select '2 resolved+grace(mod)', 'content_flags', count(*) from public.content_flags, cut
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
