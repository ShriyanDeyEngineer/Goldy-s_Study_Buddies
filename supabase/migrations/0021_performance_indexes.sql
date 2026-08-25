-- ============================================================================
-- 0021 — indexes for queries that were doing sequential scans.
--
-- No schema or behavior changes: every statement here is an index that a
-- hot read path already needed. Each one is matched to the exact query
-- that was scanning without it.
--
-- Idempotent (IF NOT EXISTS), and safe to run on a live database.
-- ============================================================================

-- ── availability_polls (group_id) ───────────────────────────────────────────
-- The group page filters polls by group on EVERY render and every
-- post-action refresh, but this table shipped with only its primary key —
-- its siblings all got one (meetups_group_time_idx, group_messages_group_
-- time_idx, group_resources_by_group) and this was simply missed. Column
-- order matches the query: filter on group_id, order by created_at desc.
create index if not exists availability_polls_group_idx
  on public.availability_polls (group_id, created_at desc);

-- ── blocks (blocked_id) ─────────────────────────────────────────────────────
-- are_blocked() (0003) checks BOTH directions:
--   (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
-- The primary key (blocker_id, blocked_id) serves the first half only, so
-- the second half scanned the whole table — once per candidate profile
-- inside search_people() and suggested_people(), i.e. N scans per search.
create index if not exists blocks_blocked_idx
  on public.blocks (blocked_id);

-- ── direct_messages (sender_id / recipient_id) ──────────────────────────────
-- direct_messages_thread_idx (0006) indexes the EXPRESSIONS
-- least(sender_id, recipient_id) / greatest(...). Postgres only uses an
-- expression index when the query repeats that expression, and the thread
-- query is written with plain columns:
--   (sender_id = me and recipient_id = them) or (sender_id = them and recipient_id = me)
-- so it matched nothing and scanned the table — on every thread open, and
-- again inside get_conversations() for the whole messages list. These two
-- plain indexes let the planner BitmapOr both halves.
create index if not exists direct_messages_sender_idx
  on public.direct_messages (sender_id, created_at);
create index if not exists direct_messages_recipient_idx
  on public.direct_messages (recipient_id, created_at);

-- ── join_requests (user_id) where pending ───────────────────────────────────
-- The course page asks "which groups have I already asked to join?".
-- Both existing pending indexes lead with group_id, which a user_id-only
-- lookup cannot use as a prefix.
create index if not exists join_requests_user_pending_idx
  on public.join_requests (user_id)
  where status = 'pending';

-- ── profiles (university_id) for active, onboarded students ─────────────────
-- The first predicate both people-search functions apply. Partial, because
-- every one of those queries also requires active + onboarded, which keeps
-- the index small and skips tombstoned/suspended rows entirely.
create index if not exists profiles_university_active_idx
  on public.profiles (university_id)
  where account_status = 'active' and display_name is not null;
