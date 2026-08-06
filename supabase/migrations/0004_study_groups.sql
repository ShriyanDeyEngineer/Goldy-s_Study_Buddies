-- ============================================================================
-- 0004 — Study groups: the core of the product.
--
-- WHAT THIS FILE DOES
--   Tables for groups, their members, join requests, and invitations —
--   plus every function that changes them. This is the most correctness-
--   critical file in the repo.
--
-- WHY THESE RULES LIVE IN THE DATABASE AND NOT IN APP CODE:
--   Two students can click "Join" on the last open seat at the same
--   millisecond. App code cannot stop both from succeeding; the database
--   can, because each function below locks the group row first
--   (SELECT … FOR UPDATE) — turning simultaneous clicks into a queue and
--   re-checking capacity once inside the lock. Clients have NO direct
--   insert/update/delete rights on these tables; these functions are the
--   only door in.
--
-- LOCK ORDERING RULE (prevents deadlocks — spec invariant #11):
--   Any function that locks multiple rows locks the GROUP row FIRST, then
--   request/invitation rows. If every writer takes locks in the same
--   order, two writers can wait on each other but never deadlock.
--
-- ERROR CODES:
--   Functions fail with short machine codes ('GROUP_FULL', 'NOT_MANAGER'…)
--   that lib/errors.ts maps to friendly copy. Raw Postgres errors must
--   never reach a student's screen.
-- ============================================================================

create table if not exists public.study_groups (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses (id),
  name       text not null check (char_length(name) between 1 and 100),
  manager_id uuid not null references public.profiles (id),
  -- open = anyone joins instantly; closed = manager approves each request.
  mode       text not null default 'open' check (mode in ('open','closed')),
  capacity   int  not null default 8 check (capacity between 2 and 50),
  -- Cached member count. It is ONLY ever written inside the functions in
  -- this file, always under the group's row lock, so it cannot drift the
  -- way an app-maintained counter would. (Attendance counts, by contrast,
  -- are computed from rows at read time — different tradeoff, see 0005.)
  member_count int not null default 0 check (member_count >= 0 and member_count <= capacity),
  status     text not null default 'active'
    check (status in ('active','inactive','archived','disbanded')),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.study_groups is
  'A study group for one course. manager_id runs it (approve/deny/remove/'
  'settings/disband). status=disbanded rows are kept as tombstones so old '
  'links show "this group is gone" instead of a 404.';

-- Group names are unique per course, case-insensitively — "algo grinders"
-- and "Algo Grinders" in the same course would only confuse people.
create unique index if not exists study_groups_unique_name_per_course
  on public.study_groups (course_id, lower(name));

-- The course page lists ACTIVE groups; partial index keeps that hot path fast.
create index if not exists study_groups_course_active_idx
  on public.study_groups (course_id) where status = 'active';

drop trigger if exists study_groups_touch_updated_at on public.study_groups;
create trigger study_groups_touch_updated_at
  before update on public.study_groups
  for each row execute function public.touch_updated_at();

create table if not exists public.study_group_members (
  group_id  uuid not null references public.study_groups (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  -- joined_at drives manager succession: when a manager leaves, the
  -- longest-tenured member (earliest joined_at) takes over.
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

comment on table public.study_group_members is
  'Who is in which group. The manager also has a row here (they are a '
  'member too). joined_at is load-bearing: it decides manager succession.';

create index if not exists group_members_user_idx on public.study_group_members (user_id);

create table if not exists public.join_requests (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.study_groups (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  -- pending → approved / denied (manager acted), withdrawn (requester took
  -- it back), or cancelled (system: group filled or was disbanded).
  status      text not null default 'pending'
    check (status in ('pending','approved','denied','withdrawn','cancelled')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

comment on table public.join_requests is
  'Requests to join CLOSED groups. Approval order is oldest-first, so '
  'created_at is meaningful. Resolved rows are history; the partial unique '
  'index enforces the one-pending-request-per-(group,user) invariant.';

create unique index if not exists join_requests_one_pending
  on public.join_requests (group_id, user_id)
  where status = 'pending';

create index if not exists join_requests_pending_idx
  on public.join_requests (group_id, created_at) where status = 'pending';

create table if not exists public.group_invitations (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.study_groups (id) on delete cascade,
  invited_user_id uuid not null references public.profiles (id) on delete cascade,
  inviter_id      uuid not null references public.profiles (id) on delete cascade,
  status          text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled')),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

comment on table public.group_invitations is
  'Invitations sent while creating a group. Same one-pending-per-'
  '(group,user) rule as join requests. (Inviting from an existing '
  'group''s members panel is a future feature — see README.)';

create unique index if not exists group_invitations_one_pending
  on public.group_invitations (group_id, invited_user_id)
  where status = 'pending';

create index if not exists group_invitations_invitee_idx
  on public.group_invitations (invited_user_id) where status = 'pending';

-- ── Membership helpers (used by RLS policies here and in 0005/0006) ─────────

-- SECURITY DEFINER so RLS policies can ask "is this user a member?" without
-- recursing into study_group_members' own RLS policy (a classic footgun:
-- a policy that queries its own table loops forever).
create or replace function public.is_group_member(p_group uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.study_group_members m
    where m.group_id = p_group and m.user_id = p_user
  );
$$;

create or replace function public.is_group_manager(p_group uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.study_groups g
    where g.id = p_group and g.manager_id = p_user
  );
$$;

revoke execute on function public.is_group_member(uuid, uuid) from public, anon;
revoke execute on function public.is_group_manager(uuid, uuid) from public, anon;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_group_manager(uuid, uuid) to authenticated;

-- ── Row-level security ──────────────────────────────────────────────────────

alter table public.study_groups enable row level security;
alter table public.study_group_members enable row level security;
alter table public.join_requests enable row level security;
alter table public.group_invitations enable row level security;

-- Groups are previewable by any signed-in student (name, course, counts,
-- mode — that is exactly what the non-member preview shows). Chat/meetups
-- live in other tables with members-only policies, so nothing sensitive
-- leaks through this.
drop policy if exists "authenticated users read groups" on public.study_groups;
create policy "authenticated users read groups"
  on public.study_groups for select
  to authenticated
  using (true);

-- Member rows: visible to yourself (so the join button knows your state)
-- and to fellow members (the Members panel). NOT to outsiders — the
-- preview shows a member COUNT (from study_groups), never the roster.
drop policy if exists "members and self read membership" on public.study_group_members;
create policy "members and self read membership"
  on public.study_group_members for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_group_member(group_id, (select auth.uid()))
  );

-- Join requests: the requester sees their own; the manager sees the queue.
drop policy if exists "requester and manager read join requests" on public.join_requests;
create policy "requester and manager read join requests"
  on public.join_requests for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_group_manager(group_id, (select auth.uid()))
  );

-- Invitations: the invitee, the inviter, and the manager can see them.
drop policy if exists "participants read invitations" on public.group_invitations;
create policy "participants read invitations"
  on public.group_invitations for select
  to authenticated
  using (
    invited_user_id = (select auth.uid())
    or inviter_id = (select auth.uid())
    or public.is_group_manager(group_id, (select auth.uid()))
  );

-- No INSERT/UPDATE/DELETE policies on any of the four tables: every write
-- goes through the functions below. This is the "revoke direct writes"
-- requirement from the spec — with RLS enabled and no write policies,
-- client writes are refused no matter what grants exist.

-- ── Internal helpers (not callable by clients) ──────────────────────────────

-- Cancels every remaining pending request/invitation on a full group and
-- notifies the people affected. Called under the group lock whenever a
-- group hits capacity. Why: leaving requests pending on a full group
-- strands people waiting for an approval that can never come; telling
-- them promptly lets them find another group ("request cancelled because
-- the group filled" is a first-class notification type in the spec).
create or replace function public.cancel_pending_on_full(p_group public.study_groups)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  for r in
    update public.join_requests
      set status = 'cancelled', resolved_at = now()
      where group_id = p_group.id and status = 'pending'
      returning user_id
  loop
    perform public.app_notify(r.user_id, 'request_cancelled_group_full',
      jsonb_build_object('group_id', p_group.id, 'group_name', p_group.name));
  end loop;

  for r in
    update public.group_invitations
      set status = 'cancelled', resolved_at = now()
      where group_id = p_group.id and status = 'pending'
      returning invited_user_id
  loop
    perform public.app_notify(r.invited_user_id, 'request_cancelled_group_full',
      jsonb_build_object('group_id', p_group.id, 'group_name', p_group.name));
  end loop;
end;
$$;

revoke execute on function public.cancel_pending_on_full(public.study_groups) from public, anon, authenticated;

-- ── create_study_group ──────────────────────────────────────────────────────

-- Creates a group, makes the caller its manager AND first member, and
-- sends the optional immediate invitations.
--
-- Invitee rules (re-validated here even though the UI enforces them,
-- because the UI can be bypassed): each invitee must be currently enrolled
-- in the course, must not be blocked either direction, and at most
-- capacity − 1 people may be invited (the creator takes one seat).
create or replace function public.create_study_group(
  p_course_id   uuid,
  p_name        text,
  p_capacity    int,
  p_mode        text,
  p_invitee_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := public.assert_active_caller();
  v_name     text := trim(coalesce(p_name, ''));
  v_group_id uuid;
  v_invitee  uuid;
  v_invitees uuid[] := (
    -- de-duplicate and drop the creator if someone sneaks them in
    select coalesce(array_agg(distinct x), '{}')
    from unnest(coalesce(p_invitee_ids, '{}')) as x
    where x <> auth.uid()
  );
begin
  if char_length(v_name) not between 1 and 100 then
    raise exception 'INVALID_NAME';
  end if;
  if p_capacity is null or p_capacity < 2 or p_capacity > 50 then
    raise exception 'INVALID_CAPACITY';
  end if;
  if p_mode not in ('open','closed') then
    raise exception 'INVALID_MODE';
  end if;
  if not exists (select 1 from public.courses c where c.id = p_course_id and c.is_active) then
    raise exception 'COURSE_NOT_FOUND';
  end if;
  if array_length(v_invitees, 1) > p_capacity - 1 then
    raise exception 'TOO_MANY_INVITES';
  end if;

  -- Every invitee must be a current classmate (spec §5.6). Checked in the
  -- database so a hand-crafted request can't invite arbitrary users.
  foreach v_invitee in array v_invitees loop
    if not exists (
      select 1
      from public.user_courses uc
      join public.profiles p on p.id = uc.user_id
      where uc.user_id = v_invitee
        and uc.course_id = p_course_id
        and uc.enrollment_type = 'current'
        and p.account_status = 'active'
        and p.display_name is not null
    ) then
      raise exception 'INVALID_INVITEE';
    end if;
    if public.are_blocked(v_uid, v_invitee) then
      raise exception 'INVALID_INVITEE';
    end if;
  end loop;

  begin
    insert into public.study_groups (course_id, name, manager_id, mode, capacity, member_count)
    values (p_course_id, v_name, v_uid, p_mode, p_capacity, 1)
    returning id into v_group_id;
  exception when unique_violation then
    raise exception 'NAME_TAKEN';
  end;

  insert into public.study_group_members (group_id, user_id) values (v_group_id, v_uid);

  foreach v_invitee in array v_invitees loop
    insert into public.group_invitations (group_id, invited_user_id, inviter_id)
    values (v_group_id, v_invitee, v_uid);
    perform public.app_notify(v_invitee, 'group_invitation',
      jsonb_build_object('group_id', v_group_id, 'group_name', v_name, 'inviter_id', v_uid));
  end loop;

  return v_group_id;
end;
$$;

revoke execute on function public.create_study_group(uuid, text, int, text, uuid[]) from public, anon;
grant execute on function public.create_study_group(uuid, text, int, text, uuid[]) to authenticated;

-- ── join_group ──────────────────────────────────────────────────────────────

-- The join button's server side. Returns what happened:
--   'joined'    — open group, you are in
--   'requested' — closed group, request now waits for the manager
--
-- CONCURRENCY (spec invariant #1): the FOR UPDATE lock on the group row is
-- taken BEFORE reading member_count. Two simultaneous joiners serialize on
-- that lock; the second one re-reads the incremented count and correctly
-- gets GROUP_FULL instead of over-filling the group.
create or replace function public.join_group(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := public.assert_active_caller();
  v_group public.study_groups%rowtype;
begin
  select * into v_group from public.study_groups where id = p_group_id for update;
  if not found then
    raise exception 'GROUP_NOT_FOUND';
  end if;
  if v_group.status <> 'active' then
    raise exception 'GROUP_UNAVAILABLE';
  end if;
  if exists (
    select 1 from public.study_group_members m
    where m.group_id = p_group_id and m.user_id = v_uid
  ) then
    raise exception 'ALREADY_MEMBER';
  end if;
  -- A full group refuses both instant joins AND new requests — a request
  -- that could never be approved would just be a slow "no".
  if v_group.member_count >= v_group.capacity then
    raise exception 'GROUP_FULL';
  end if;

  if v_group.mode = 'open' then
    insert into public.study_group_members (group_id, user_id) values (p_group_id, v_uid);
    update public.study_groups
      set member_count = member_count + 1, last_activity_at = now()
      where id = p_group_id;
    -- If that join took the last seat, sweep the now-unfulfillable
    -- requests/invites so nobody waits on a full group.
    if v_group.member_count + 1 >= v_group.capacity then
      v_group.member_count := v_group.member_count + 1;
      perform public.cancel_pending_on_full(v_group);
    end if;
    return 'joined';
  else
    begin
      insert into public.join_requests (group_id, user_id) values (p_group_id, v_uid);
    exception when unique_violation then
      raise exception 'DUPLICATE_REQUEST';
    end;
    perform public.app_notify(v_group.manager_id, 'join_request_received',
      jsonb_build_object('group_id', p_group_id, 'group_name', v_group.name, 'user_id', v_uid));
    return 'requested';
  end if;
end;
$$;

revoke execute on function public.join_group(uuid) from public, anon;
grant execute on function public.join_group(uuid) to authenticated;

-- Requester withdraws their own pending request ("Requested ✓" → "Request
-- to join"). Locks the group first to respect the global lock order.
create or replace function public.withdraw_join_request(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  perform 1 from public.study_groups where id = p_group_id for update;
  update public.join_requests
    set status = 'withdrawn', resolved_at = now()
    where group_id = p_group_id and user_id = v_uid and status = 'pending';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'NO_PENDING_REQUEST';
  end if;
end;
$$;

revoke execute on function public.withdraw_join_request(uuid) from public, anon;
grant execute on function public.withdraw_join_request(uuid) to authenticated;

-- ── approve / deny join requests (manager only) ─────────────────────────────

-- Approve one request. Returns:
--   'approved'       — the requester is now a member
--   'cancelled_full' — the group filled while this request waited; the
--                      request was cancelled and the REQUESTER notified.
--                      Returned (not raised) so the cancellation COMMITS —
--                      raising would roll it back. The app shows the
--                      manager "your group is now full" copy for it.
--
-- This is spec invariant #2 (approval re-check) in the flesh: capacity is
-- re-verified inside the lock at the moment of approval, never assumed
-- from what the manager's screen showed seconds earlier.
create or replace function public.approve_join_request(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_req   public.join_requests%rowtype;
  v_group public.study_groups%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- Peek at the request only to learn the group id (no lock yet)…
  select * into v_req from public.join_requests where id = p_request_id;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  -- …then take locks in the canonical order: GROUP first, request second.
  select * into v_group from public.study_groups where id = v_req.group_id for update;
  select * into v_req from public.join_requests where id = p_request_id for update;

  if v_group.manager_id <> v_uid then
    raise exception 'NOT_MANAGER';
  end if;
  if v_group.status <> 'active' then
    raise exception 'GROUP_UNAVAILABLE';
  end if;
  -- Re-check status under the lock — the requester may have withdrawn, or
  -- a concurrent approval may have already resolved it.
  if v_req.status <> 'pending' then
    raise exception 'ALREADY_RESOLVED';
  end if;

  if v_group.member_count >= v_group.capacity then
    update public.join_requests
      set status = 'cancelled', resolved_at = now()
      where id = p_request_id;
    perform public.app_notify(v_req.user_id, 'request_cancelled_group_full',
      jsonb_build_object('group_id', v_group.id, 'group_name', v_group.name));
    return 'cancelled_full';
  end if;

  insert into public.study_group_members (group_id, user_id)
  values (v_group.id, v_req.user_id);
  update public.study_groups
    set member_count = member_count + 1, last_activity_at = now()
    where id = v_group.id;
  update public.join_requests
    set status = 'approved', resolved_at = now()
    where id = p_request_id;
  perform public.app_notify(v_req.user_id, 'join_request_approved',
    jsonb_build_object('group_id', v_group.id, 'group_name', v_group.name));

  -- Just hit capacity? Sweep the rest of the queue with notifications.
  if v_group.member_count + 1 >= v_group.capacity then
    v_group.member_count := v_group.member_count + 1;
    perform public.cancel_pending_on_full(v_group);
  end if;

  return 'approved';
end;
$$;

revoke execute on function public.approve_join_request(uuid) from public, anon;
grant execute on function public.approve_join_request(uuid) to authenticated;

create or replace function public.deny_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_req   public.join_requests%rowtype;
  v_group public.study_groups%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_req from public.join_requests where id = p_request_id;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  select * into v_group from public.study_groups where id = v_req.group_id for update;
  select * into v_req from public.join_requests where id = p_request_id for update;

  if v_group.manager_id <> v_uid then
    raise exception 'NOT_MANAGER';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'ALREADY_RESOLVED';
  end if;

  update public.join_requests
    set status = 'denied', resolved_at = now()
    where id = p_request_id;
  perform public.app_notify(v_req.user_id, 'join_request_denied',
    jsonb_build_object('group_id', v_group.id, 'group_name', v_group.name));
end;
$$;

revoke execute on function public.deny_join_request(uuid) from public, anon;
grant execute on function public.deny_join_request(uuid) to authenticated;

-- ── respond_to_invitation ───────────────────────────────────────────────────

-- Invitee accepts or declines. Returns 'joined', 'declined', or
-- 'cancelled_full' (same commit-the-cancellation reasoning as approvals).
create or replace function public.respond_to_invitation(p_invitation_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := public.assert_active_caller();
  v_inv   public.group_invitations%rowtype;
  v_group public.study_groups%rowtype;
begin
  select * into v_inv from public.group_invitations where id = p_invitation_id;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  select * into v_group from public.study_groups where id = v_inv.group_id for update;
  select * into v_inv from public.group_invitations where id = p_invitation_id for update;

  if v_inv.invited_user_id <> v_uid then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'ALREADY_RESOLVED';
  end if;

  if not p_accept then
    update public.group_invitations
      set status = 'declined', resolved_at = now()
      where id = p_invitation_id;
    return 'declined';
  end if;

  if v_group.status <> 'active' then
    update public.group_invitations
      set status = 'cancelled', resolved_at = now()
      where id = p_invitation_id;
    raise exception 'GROUP_UNAVAILABLE';
  end if;

  if exists (
    select 1 from public.study_group_members m
    where m.group_id = v_group.id and m.user_id = v_uid
  ) then
    update public.group_invitations
      set status = 'accepted', resolved_at = now()
      where id = p_invitation_id;
    return 'joined'; -- already in (e.g. joined via the open-group button)
  end if;

  if v_group.member_count >= v_group.capacity then
    update public.group_invitations
      set status = 'cancelled', resolved_at = now()
      where id = p_invitation_id;
    return 'cancelled_full';
  end if;

  insert into public.study_group_members (group_id, user_id) values (v_group.id, v_uid);
  update public.study_groups
    set member_count = member_count + 1, last_activity_at = now()
    where id = v_group.id;
  update public.group_invitations
    set status = 'accepted', resolved_at = now()
    where id = p_invitation_id;
  perform public.app_notify(v_inv.inviter_id, 'invitation_accepted',
    jsonb_build_object('group_id', v_group.id, 'group_name', v_group.name, 'user_id', v_uid));

  if v_group.member_count + 1 >= v_group.capacity then
    v_group.member_count := v_group.member_count + 1;
    perform public.cancel_pending_on_full(v_group);
  end if;

  return 'joined';
end;
$$;

revoke execute on function public.respond_to_invitation(uuid, boolean) from public, anon;
grant execute on function public.respond_to_invitation(uuid, boolean) to authenticated;

-- ── disband (internal core + manager-facing wrapper) ────────────────────────

-- The teardown shared by "manager clicks Disband" and "last member leaves".
-- Assumes the caller ALREADY HOLDS the group lock. In one transaction
-- (spec invariant #6): remove all members, cancel future meetups, resolve
-- all pending requests/invitations, mark the group disbanded, notify
-- everyone affected (except p_skip_notify, the person doing the action —
-- they don't need a notification about their own click).
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
    delete from public.study_group_members
      where group_id = p_group.id
      returning user_id
  loop
    if r.user_id <> p_skip_notify then
      perform public.app_notify(r.user_id, 'group_disbanded',
        jsonb_build_object('group_name', p_group.name, 'course_id', p_group.course_id));
    end if;
  end loop;

  for r in
    update public.join_requests
      set status = 'cancelled', resolved_at = now()
      where group_id = p_group.id and status = 'pending'
      returning user_id
  loop
    perform public.app_notify(r.user_id, 'group_disbanded',
      jsonb_build_object('group_name', p_group.name, 'course_id', p_group.course_id));
  end loop;

  for r in
    update public.group_invitations
      set status = 'cancelled', resolved_at = now()
      where group_id = p_group.id and status = 'pending'
      returning invited_user_id
  loop
    perform public.app_notify(r.invited_user_id, 'group_disbanded',
      jsonb_build_object('group_name', p_group.name, 'course_id', p_group.course_id));
  end loop;

  -- Cancel only FUTURE meetups; past ones already happened and stay as
  -- history. (meetups table arrives in 0005; plpgsql resolves names at
  -- runtime, and nothing calls disband before 0005 has run.)
  update public.meetups
    set is_cancelled = true,
        cancellation_reason = coalesce(cancellation_reason, 'The group was disbanded.')
    where group_id = p_group.id
      and scheduled_at > now()
      and not is_cancelled;

  update public.study_groups
    set member_count = 0, status = 'disbanded'
    where id = p_group.id;
end;
$$;

revoke execute on function public.disband_group_core(public.study_groups, uuid) from public, anon, authenticated;

-- Manager-facing disband (the typed-name confirmation lives in the UI;
-- the database only cares that the caller is the manager).
create or replace function public.disband_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_group public.study_groups%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_group from public.study_groups where id = p_group_id for update;
  if not found then
    raise exception 'GROUP_NOT_FOUND';
  end if;
  if v_group.manager_id <> v_uid then
    raise exception 'NOT_MANAGER';
  end if;
  if v_group.status = 'disbanded' then
    raise exception 'GROUP_UNAVAILABLE';
  end if;
  perform public.disband_group_core(v_group, v_uid);
end;
$$;

revoke execute on function public.disband_group(uuid) from public, anon;
grant execute on function public.disband_group(uuid) to authenticated;

-- ── leave_group (with manager succession) ───────────────────────────────────

-- Any member leaves. If the MANAGER leaves (spec invariant #5):
--   - other members remain → hand the crown to the longest-tenured member
--     (earliest joined_at, ties broken by earliest account creation, then
--     by user id so the result is fully deterministic — never random);
--   - manager was the last member → the group is disbanded.
create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_group     public.study_groups%rowtype;
  v_successor uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_group from public.study_groups where id = p_group_id for update;
  if not found then
    raise exception 'GROUP_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.study_group_members m
    where m.group_id = p_group_id and m.user_id = v_uid
  ) then
    raise exception 'NOT_MEMBER';
  end if;

  delete from public.study_group_members
    where group_id = p_group_id and user_id = v_uid;
  update public.study_groups
    set member_count = member_count - 1
    where id = p_group_id;

  if v_group.manager_id = v_uid then
    select m.user_id into v_successor
    from public.study_group_members m
    join public.profiles p on p.id = m.user_id
    where m.group_id = p_group_id
    order by m.joined_at asc, p.created_at asc, m.user_id asc
    limit 1;

    if v_successor is null then
      -- Manager was the last one out — turn off the lights.
      v_group.member_count := 0;
      perform public.disband_group_core(v_group, v_uid);
    else
      update public.study_groups set manager_id = v_successor where id = p_group_id;
      perform public.app_notify(v_successor, 'manager_transferred',
        jsonb_build_object('group_id', p_group_id, 'group_name', v_group.name));
    end if;
  end if;
end;
$$;

revoke execute on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;

-- ── remove_member (manager only) ────────────────────────────────────────────

create or replace function public.remove_member(p_group_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_group public.study_groups%rowtype;
  v_count int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_group from public.study_groups where id = p_group_id for update;
  if not found then
    raise exception 'GROUP_NOT_FOUND';
  end if;
  if v_group.manager_id <> v_uid then
    raise exception 'NOT_MANAGER';
  end if;
  -- Managers leave via leave_group (which handles succession); letting
  -- them "remove" themselves here would orphan the group.
  if p_member_id = v_uid then
    raise exception 'SELF_ACTION';
  end if;

  delete from public.study_group_members
    where group_id = p_group_id and user_id = p_member_id;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'NOT_MEMBER';
  end if;

  update public.study_groups
    set member_count = member_count - 1
    where id = p_group_id;

  perform public.app_notify(p_member_id, 'removed_from_group',
    jsonb_build_object('group_name', v_group.name, 'course_id', v_group.course_id));
end;
$$;

revoke execute on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- ── update_group_settings (rename / open⇄closed) ────────────────────────────

-- Rename and/or switch mode. The subtle one is CLOSED → OPEN (spec
-- invariant #7): everyone already waiting must be let in, oldest request
-- first, but only up to capacity — approve exactly
-- min(pending, remaining seats), then cancel-and-notify the rest if the
-- group filled.
create or replace function public.update_group_settings(
  p_group_id uuid,
  p_name     text,
  p_mode     text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_group public.study_groups%rowtype;
  v_name  text := trim(coalesce(p_name, ''));
  v_req   record;
  v_remaining int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_group from public.study_groups where id = p_group_id for update;
  if not found then
    raise exception 'GROUP_NOT_FOUND';
  end if;
  if v_group.manager_id <> v_uid then
    raise exception 'NOT_MANAGER';
  end if;
  if v_group.status <> 'active' then
    raise exception 'GROUP_UNAVAILABLE';
  end if;
  if char_length(v_name) not between 1 and 100 then
    raise exception 'INVALID_NAME';
  end if;
  if p_mode not in ('open','closed') then
    raise exception 'INVALID_MODE';
  end if;

  begin
    update public.study_groups
      set name = v_name, mode = p_mode
      where id = p_group_id;
  exception when unique_violation then
    raise exception 'NAME_TAKEN';
  end;

  if v_group.mode = 'closed' and p_mode = 'open' then
    v_remaining := v_group.capacity - v_group.member_count;

    -- Oldest first; FOR UPDATE so a concurrent withdraw can't slip between
    -- our read and our approval. Group lock is already held (lock order OK).
    for v_req in
      select * from public.join_requests
      where group_id = p_group_id and status = 'pending'
      order by created_at asc
      for update
    loop
      if v_remaining > 0 then
        insert into public.study_group_members (group_id, user_id)
        values (p_group_id, v_req.user_id);
        update public.join_requests
          set status = 'approved', resolved_at = now()
          where id = v_req.id;
        perform public.app_notify(v_req.user_id, 'join_request_approved',
          jsonb_build_object('group_id', p_group_id, 'group_name', v_name));
        v_remaining := v_remaining - 1;
      else
        update public.join_requests
          set status = 'cancelled', resolved_at = now()
          where id = v_req.id;
        perform public.app_notify(v_req.user_id, 'request_cancelled_group_full',
          jsonb_build_object('group_id', p_group_id, 'group_name', v_name));
      end if;
    end loop;

    update public.study_groups
      set member_count = capacity - greatest(v_remaining, 0),
          last_activity_at = now()
      where id = p_group_id;
  end if;
end;
$$;

revoke execute on function public.update_group_settings(uuid, text, text) from public, anon;
grant execute on function public.update_group_settings(uuid, text, text) to authenticated;
