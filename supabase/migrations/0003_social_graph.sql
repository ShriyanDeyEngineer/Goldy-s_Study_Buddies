-- ============================================================================
-- 0003 — The social graph: friends, study buddies, and blocking.
--
-- WHAT THIS FILE DOES
--   Friendships and buddy connections (mutual links), the requests that
--   create them, and blocks. All writes go through SECURITY DEFINER
--   functions so the invariants hold no matter what the app does:
--     - at most ONE pending request between any pair (partial unique index)
--     - accepting creates the mutual link atomically (one transaction)
--     - declining is silent (no notification for the sender)
--     - blocking removes friendship + requests + buddy link in one shot
--
-- WHY FRIENDSHIPS STORE "SMALLER ID FIRST":
--   A friendship between A and B could be stored as (A,B), as (B,A), or
--   accidentally as both. We force user_id_a < user_id_b (a "canonical
--   order"), so each friendship has exactly one possible representation
--   and the primary key makes double-storing impossible.
-- ============================================================================

-- ── Blocks (created first: everything else consults it) ─────────────────────

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

comment on table public.blocks is
  'blocker_id no longer wants to see or hear from blocked_id. Enforced in '
  'every people-facing function: messaging, requests, search, filters, '
  'suggestions, and profile viewing. Row direction matters (who blocked '
  'whom), but most exclusions apply in BOTH directions.';

-- "Has either of these two blocked the other?" — used everywhere.
-- SECURITY DEFINER because callers can only see their own block rows
-- (policy below), yet the answer must consider both directions.
create or replace function public.are_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b)
       or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;

revoke execute on function public.are_blocked(uuid, uuid) from public, anon;
grant execute on function public.are_blocked(uuid, uuid) to authenticated;

alter table public.blocks enable row level security;

-- You can see who YOU blocked (for the unblock UI). You can never see who
-- blocked you — that would defeat the point of quiet blocking.
drop policy if exists "users read own block list" on public.blocks;
create policy "users read own block list"
  on public.blocks for select
  to authenticated
  using (blocker_id = (select auth.uid()));

-- ── Friendships ─────────────────────────────────────────────────────────────

create table if not exists public.friends (
  user_id_a  uuid not null references public.profiles (id) on delete cascade,
  user_id_b  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id_a, user_id_b),
  -- Canonical order: see the header comment.
  constraint friends_canonical_order check (user_id_a < user_id_b)
);

comment on table public.friends is
  'Mutual friendships. One row per pair, smaller UUID first (enforced by '
  'CHECK) so a friendship can never be stored twice. Created only by '
  'respond_friend_request()/send_friend_request(); removed by '
  'remove_friend() or block_user().';

create index if not exists friends_user_b_idx on public.friends (user_id_b);

alter table public.friends enable row level security;

drop policy if exists "users read own friendships" on public.friends;
create policy "users read own friendships"
  on public.friends for select
  to authenticated
  using (user_id_a = (select auth.uid()) or user_id_b = (select auth.uid()));

create table if not exists public.friend_requests (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  check (sender_id <> recipient_id)
);

comment on table public.friend_requests is
  'Friend requests with their outcome. Old resolved rows are kept as '
  'history; the partial unique index below is what limits each ordered '
  'pair to a single LIVE (pending) request at a time.';

-- THE duplicate-request guard (spec invariant #3): at most one pending
-- request per (sender, recipient). A resolved request does not block a new
-- one — you may ask again after being declined.
create unique index if not exists friend_requests_one_pending
  on public.friend_requests (sender_id, recipient_id)
  where status = 'pending';

create index if not exists friend_requests_recipient_idx
  on public.friend_requests (recipient_id) where status = 'pending';

alter table public.friend_requests enable row level security;

drop policy if exists "participants read friend requests" on public.friend_requests;
create policy "participants read friend requests"
  on public.friend_requests for select
  to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

-- ── Study buddies (same shapes as friends) ──────────────────────────────────

create table if not exists public.study_buddy_connections (
  user_id_a  uuid not null references public.profiles (id) on delete cascade,
  user_id_b  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id_a, user_id_b),
  constraint buddies_canonical_order check (user_id_a < user_id_b)
);

comment on table public.study_buddy_connections is
  '1-on-1 study buddy pairings, stored exactly like friendships (canonical '
  'order, smaller UUID first). Separate from friends because the product '
  'treats them differently: buddies are a study commitment, friends are a '
  'social link, and either can exist without the other.';

create index if not exists buddies_user_b_idx on public.study_buddy_connections (user_id_b);

alter table public.study_buddy_connections enable row level security;

drop policy if exists "users read own buddy connections" on public.study_buddy_connections;
create policy "users read own buddy connections"
  on public.study_buddy_connections for select
  to authenticated
  using (user_id_a = (select auth.uid()) or user_id_b = (select auth.uid()));

create table if not exists public.study_buddy_requests (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  check (sender_id <> recipient_id)
);

create unique index if not exists buddy_requests_one_pending
  on public.study_buddy_requests (sender_id, recipient_id)
  where status = 'pending';

create index if not exists buddy_requests_recipient_idx
  on public.study_buddy_requests (recipient_id) where status = 'pending';

alter table public.study_buddy_requests enable row level security;

drop policy if exists "participants read buddy requests" on public.study_buddy_requests;
create policy "participants read buddy requests"
  on public.study_buddy_requests for select
  to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

-- ── Shared guard used by every people-to-people function ────────────────────

-- Raises unless the caller is a real, onboarded, non-suspended account.
-- Centralized so no function forgets one of the checks.
create or replace function public.assert_active_caller()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_status text;
  v_name   text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select account_status, display_name into v_status, v_name
  from public.profiles where id = v_uid;
  if v_status is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_status <> 'active' then
    raise exception 'ACCOUNT_DISABLED';
  end if;
  if v_name is null then
    raise exception 'NOT_ONBOARDED';
  end if;
  return v_uid;
end;
$$;

revoke execute on function public.assert_active_caller() from public, anon, authenticated;

-- ── Friend request lifecycle ────────────────────────────────────────────────

-- Send a friend request.
-- The one clever rule: if the OTHER person already has a pending request to
-- YOU, we don't create a crossing request — we accept theirs. Both people
-- clearly want to connect; making them play request ping-pong helps nobody.
-- (Documented as a judgment call in the README.)
create or replace function public.send_friend_request(p_recipient uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := public.assert_active_caller();
  v_reverse public.friend_requests%rowtype;
  v_name    text;
begin
  if p_recipient = v_uid then
    raise exception 'SELF_ACTION';
  end if;

  -- Target must be a real active member. We answer USER_NOT_FOUND for
  -- missing/suspended accounts so nothing about account status leaks.
  select display_name into v_name
  from public.profiles
  where id = p_recipient and account_status = 'active' and display_name is not null;
  if v_name is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  if public.are_blocked(v_uid, p_recipient) then
    raise exception 'BLOCKED';
  end if;

  if exists (
    select 1 from public.friends f
    where f.user_id_a = least(v_uid, p_recipient)
      and f.user_id_b = greatest(v_uid, p_recipient)
  ) then
    raise exception 'ALREADY_FRIENDS';
  end if;

  -- Crossing-request auto-accept, described above.
  select * into v_reverse
  from public.friend_requests
  where sender_id = p_recipient and recipient_id = v_uid and status = 'pending'
  for update;
  if found then
    update public.friend_requests
      set status = 'accepted', resolved_at = now()
      where id = v_reverse.id;
    insert into public.friends (user_id_a, user_id_b)
    values (least(v_uid, p_recipient), greatest(v_uid, p_recipient))
    on conflict do nothing;
    perform public.app_notify(p_recipient, 'friend_request_accepted',
      jsonb_build_object('user_id', v_uid));
    return;
  end if;

  begin
    insert into public.friend_requests (sender_id, recipient_id) values (v_uid, p_recipient);
  exception when unique_violation then
    raise exception 'DUPLICATE_REQUEST';
  end;

  perform public.app_notify(p_recipient, 'friend_request',
    jsonb_build_object('user_id', v_uid));
end;
$$;

revoke execute on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;

-- Accept or decline a request addressed to you.
-- Accepting inserts the friends row and marks the request in ONE
-- transaction (spec: "both users appear in each other's list, or neither
-- does"). Declining is silent: the spec forbids notifying the sender.
create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.assert_active_caller();
  v_req public.friend_requests%rowtype;
begin
  select * into v_req from public.friend_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if v_req.recipient_id <> v_uid then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'ALREADY_RESOLVED';
  end if;

  if p_accept then
    update public.friend_requests set status = 'accepted', resolved_at = now()
      where id = p_request_id;
    insert into public.friends (user_id_a, user_id_b)
    values (least(v_req.sender_id, v_uid), greatest(v_req.sender_id, v_uid))
    on conflict do nothing;
    perform public.app_notify(v_req.sender_id, 'friend_request_accepted',
      jsonb_build_object('user_id', v_uid));
  else
    update public.friend_requests set status = 'declined', resolved_at = now()
      where id = p_request_id;
    -- No notification on decline — deliberate silence, per the spec.
  end if;
end;
$$;

revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- Sender takes back their own pending request.
create or replace function public.cancel_friend_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.assert_active_caller();
  v_count int;
begin
  update public.friend_requests
    set status = 'cancelled', resolved_at = now()
    where id = p_request_id and sender_id = v_uid and status = 'pending';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
end;
$$;

revoke execute on function public.cancel_friend_request(uuid) from public, anon;
grant execute on function public.cancel_friend_request(uuid) to authenticated;

-- Unfriend. Either side may do it, no notification (quiet, like declining).
create or replace function public.remove_friend(p_other uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.assert_active_caller();
  v_count int;
begin
  delete from public.friends
    where user_id_a = least(v_uid, p_other) and user_id_b = greatest(v_uid, p_other);
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'NOT_FRIENDS';
  end if;
end;
$$;

revoke execute on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

-- ── Study buddy lifecycle (mirrors friends) ─────────────────────────────────

-- Send a buddy request. Extra rule vs. friends: the target must currently
-- be "available for study buddies" — the toggle is their consent to being
-- asked. (Friends have no such gate.)
create or replace function public.send_buddy_request(p_recipient uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := public.assert_active_caller();
  v_available boolean;
  v_reverse   public.study_buddy_requests%rowtype;
begin
  if p_recipient = v_uid then
    raise exception 'SELF_ACTION';
  end if;

  select is_available_for_buddies into v_available
  from public.profiles
  where id = p_recipient and account_status = 'active' and display_name is not null;
  if v_available is null then
    raise exception 'USER_NOT_FOUND';
  end if;
  if not v_available then
    raise exception 'NOT_AVAILABLE';
  end if;

  if public.are_blocked(v_uid, p_recipient) then
    raise exception 'BLOCKED';
  end if;

  if exists (
    select 1 from public.study_buddy_connections c
    where c.user_id_a = least(v_uid, p_recipient)
      and c.user_id_b = greatest(v_uid, p_recipient)
  ) then
    raise exception 'ALREADY_CONNECTED';
  end if;

  -- Crossing requests auto-accept, same as friends.
  select * into v_reverse
  from public.study_buddy_requests
  where sender_id = p_recipient and recipient_id = v_uid and status = 'pending'
  for update;
  if found then
    update public.study_buddy_requests
      set status = 'accepted', resolved_at = now()
      where id = v_reverse.id;
    insert into public.study_buddy_connections (user_id_a, user_id_b)
    values (least(v_uid, p_recipient), greatest(v_uid, p_recipient))
    on conflict do nothing;
    perform public.app_notify(p_recipient, 'buddy_request_accepted',
      jsonb_build_object('user_id', v_uid));
    return;
  end if;

  begin
    insert into public.study_buddy_requests (sender_id, recipient_id) values (v_uid, p_recipient);
  exception when unique_violation then
    raise exception 'DUPLICATE_REQUEST';
  end;

  perform public.app_notify(p_recipient, 'buddy_request',
    jsonb_build_object('user_id', v_uid));
end;
$$;

revoke execute on function public.send_buddy_request(uuid) from public, anon;
grant execute on function public.send_buddy_request(uuid) to authenticated;

-- Accept or decline a buddy request. Accepting creates the mutual
-- connection atomically and notifies the sender ("both parties are
-- notified" — the accepter is looking at the result, so their
-- "notification" is the UI itself).
create or replace function public.respond_buddy_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.assert_active_caller();
  v_req public.study_buddy_requests%rowtype;
begin
  select * into v_req from public.study_buddy_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if v_req.recipient_id <> v_uid then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'ALREADY_RESOLVED';
  end if;

  if p_accept then
    update public.study_buddy_requests set status = 'accepted', resolved_at = now()
      where id = p_request_id;
    insert into public.study_buddy_connections (user_id_a, user_id_b)
    values (least(v_req.sender_id, v_uid), greatest(v_req.sender_id, v_uid))
    on conflict do nothing;
    perform public.app_notify(v_req.sender_id, 'buddy_request_accepted',
      jsonb_build_object('user_id', v_uid));
  else
    update public.study_buddy_requests set status = 'declined', resolved_at = now()
      where id = p_request_id;
  end if;
end;
$$;

revoke execute on function public.respond_buddy_request(uuid, boolean) from public, anon;
grant execute on function public.respond_buddy_request(uuid, boolean) to authenticated;

-- Either buddy may end the connection later.
create or replace function public.disconnect_buddy(p_other uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.assert_active_caller();
  v_count int;
begin
  delete from public.study_buddy_connections
    where user_id_a = least(v_uid, p_other) and user_id_b = greatest(v_uid, p_other);
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'NOT_CONNECTED';
  end if;
end;
$$;

revoke execute on function public.disconnect_buddy(uuid) from public, anon;
grant execute on function public.disconnect_buddy(uuid) to authenticated;

-- ── Blocking ────────────────────────────────────────────────────────────────

-- Block someone. ONE atomic operation (spec invariant #9) that:
--   1. records the block,
--   2. deletes any friendship,
--   3. cancels pending friend requests in BOTH directions,
--   4. cancels pending buddy requests in BOTH directions,
--   5. deletes any buddy connection.
-- After this commits, the pair can no longer message each other, send
-- requests, or view each other's profiles (those functions all call
-- are_blocked), and they vanish from each other's search results.
-- Everything happens in this single function so there is no moment where
-- "blocked but still friends" can be observed.
create or replace function public.block_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Deliberately NOT assert_active_caller(): even a not-yet-onboarded user
  -- must be able to block someone who is harassing them.
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_target = v_uid then
    raise exception 'SELF_ACTION';
  end if;
  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'USER_NOT_FOUND';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (v_uid, p_target)
  on conflict do nothing; -- blocking twice is a no-op, not an error

  delete from public.friends
    where user_id_a = least(v_uid, p_target) and user_id_b = greatest(v_uid, p_target);

  update public.friend_requests
    set status = 'cancelled', resolved_at = now()
    where status = 'pending'
      and ((sender_id = v_uid and recipient_id = p_target)
        or (sender_id = p_target and recipient_id = v_uid));

  update public.study_buddy_requests
    set status = 'cancelled', resolved_at = now()
    where status = 'pending'
      and ((sender_id = v_uid and recipient_id = p_target)
        or (sender_id = p_target and recipient_id = v_uid));

  delete from public.study_buddy_connections
    where user_id_a = least(v_uid, p_target) and user_id_b = greatest(v_uid, p_target);

  -- No notification to the blocked user — blocking is always silent.
end;
$$;

revoke execute on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_target uuid)
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
  delete from public.blocks where blocker_id = v_uid and blocked_id = p_target;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'NOT_BLOCKED';
  end if;
  -- Unblocking does NOT restore the old friendship/buddy link — those were
  -- genuinely severed. The pair can send fresh requests if they choose.
end;
$$;

revoke execute on function public.unblock_user(uuid) from public, anon;
grant execute on function public.unblock_user(uuid) to authenticated;
