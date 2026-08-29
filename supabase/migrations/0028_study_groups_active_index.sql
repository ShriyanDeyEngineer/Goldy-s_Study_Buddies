-- ============================================================================
-- 0028 — index the platform-wide "active groups" scan.
--
-- study_groups already has study_groups_course_active_idx (0004), a
-- partial index scoped to (course_id) where status='active' — good for
-- "active groups in THIS course" lookups, but it doesn't help the two
-- PLATFORM-WIDE active-group scans that run on some of the app's highest-
-- traffic pages:
--   - app/(app)/dashboard/page.tsx: .eq("status", "active") across every
--     group, to compute each course's group count for "my courses".
--   - app/(app)/courses/page.tsx: the same, for the whole catalog's
--     per-course group counts.
--   - app/(app)/admin/groups/page.tsx: .order("last_activity_at desc")
--     over the same active set.
-- All three currently have no covering index and sequential-scan
-- study_groups as it grows. This one partial index covers all three
-- query shapes (a plain equality scan, and the same set pre-sorted by
-- last_activity_at).
-- ============================================================================

create index if not exists study_groups_active_idx
  on public.study_groups (last_activity_at desc)
  where status = 'active';
