-- ============================================================================
-- 0034 — get_unread_counts(): the two nav badges in ONE round trip.
--
-- The signed-in layout ((app)/layout.tsx) renders on every page load and
-- every router.refresh() (which the /messages and /notifications live-refresh
-- fire on each realtime event). It was making TWO separate PostgREST
-- requests there — one COUNT on notifications, one on direct_messages — a
-- fixed multiplier of request/pool pressure across all concurrent traffic.
--
-- This folds both into a single function call. Each count still hits the
-- partial index it already had (notifications_unread_idx,
-- direct_messages_unread_idx), so the work is identical — there is just one
-- request instead of two.
--
-- SECURITY INVOKER on purpose: it only ever counts the caller's own rows,
-- RLS on both tables already scopes select to them, and clients already
-- hold select on both. No privilege escalation, unlike get_conversations()
-- which needs definer to read other people's profile rows.
--
-- Idempotent (create or replace); safe on a live database.
-- ============================================================================

create or replace function public.get_unread_counts()
returns table (unread_notifications integer, unread_messages integer)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    (
      select count(*)::int
      from public.notifications
      where recipient_id = (select auth.uid())
        and read_at is null
    ),
    (
      select count(*)::int
      from public.direct_messages
      where recipient_id = (select auth.uid())
        and not is_read
    );
$$;

revoke execute on function public.get_unread_counts() from public, anon;
grant execute on function public.get_unread_counts() to authenticated;
