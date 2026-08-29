-- ============================================================================
-- check_drift.sql  —  READ-ONLY probe of the live database vs. what
-- migrations 0023-0032 are supposed to have done. Touches nothing.
--
-- HOW TO RUN (Supabase Dashboard -> SQL Editor):
--   • Paste this whole file and press Run.
--   • Use the DEFAULT "postgres" role. If the editor offers "Run with RLS"
--     vs "Run without RLS", pick WITHOUT rls — this only reads system
--     catalogs, and the RLS path runs with an empty search_path that can
--     break catalog queries ("relation \"public\" does not exist").
--   • It is one SELECT. It returns one table: result / name / detail.
--
--   ✅ PASS  = that piece is already correct on live
--   ❌ FAIL  = migration 0032 still needs to run (or has not taken yet)
--
-- Run it once before applying 0032 and once after.
-- Migration-history check is a separate one-liner — see the bottom.
-- ============================================================================

with r(sort, name, ok, detail) as (

  -- ── 0023: flagged-message log stores the masked text ────────────────────
  select 1,
    '0023  message_originals.censored_content column exists',
    exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('public.message_originals')
        and a.attname = 'censored_content' and a.attnum > 0 and not a.attisdropped
    ),
    'Missing => every group/DM message the profanity filter alters errors on send.'

  union all
  select 2,
    '0023  message_originals.censored_content is NOT NULL',
    exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('public.message_originals')
        and a.attname = 'censored_content' and a.attnotnull
    ),
    'Backfilled + locked by 0023.'

  -- ── 0031: rate-limit COUNT is table-qualified (0030 alone is not enough) ─
  union all
  select 3,
    '0031  send_group_message qualifies gm.created_at',
    exists (
      select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'send_group_message'
        and p.prosrc like '%gm.created_at%'
    ),
    'False => 0030 is live without 0031: "column reference is ambiguous" on every group send.'

  union all
  select 4,
    '0031  send_direct_message qualifies dm.created_at',
    exists (
      select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'send_direct_message'
        and p.prosrc like '%dm.created_at%'
    ),
    'False => every DM send raises.'

  union all
  select 5,
    '0023  send_* functions write censored_content',
    exists (
      select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'send_group_message'
        and p.prosrc like '%censored_content%'
    ),
    'Function body is 0023-or-later (should agree with check 1).'

  -- ── 0025: course-request name optional when a student files ────────────
  union all
  select 6,
    '0025  create_course_request allows an empty name',
    exists (
      select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'create_course_request'
        and p.prosrc like '%COURSE_NAME_TOO_LONG%'
    ),
    'False => filing a request with a blank name still fails (pre-0025 behavior).'

  -- ── 0028 / 0030: performance indexes ──────────────────────────────────
  union all
  select 7,
    '0028  study_groups_active_idx exists',
    pg_catalog.to_regclass('public.study_groups_active_idx') is not null,
    'Platform-wide active-group scans sequential-scan without it.'

  union all
  select 8,
    '0030  group_messages_sender_idx exists',
    pg_catalog.to_regclass('public.group_messages_sender_idx') is not null,
    'The rate-limit COUNT sequential-scans group_messages without it.'

  -- ── 0029: availability_votes.group_id ────────────────────────────────
  union all
  select 9,
    '0029  availability_votes.group_id column exists',
    exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('public.availability_votes')
        and a.attname = 'group_id' and a.attnum > 0 and not a.attisdropped
    ),
    'The NOT NULL column whose presence drives the poll bug.'

  union all
  select 10,
    '0029  availability_votes.group_id is NOT NULL',
    exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('public.availability_votes')
        and a.attname = 'group_id' and a.attnotnull
    ),
    'When true, set_availability_votes MUST supply group_id (check 13).'

  union all
  select 11,
    '0029  availability_votes_group_id_fkey exists',
    exists (
      select 1 from pg_catalog.pg_constraint
      where conname = 'availability_votes_group_id_fkey'
        and conrelid = pg_catalog.to_regclass('public.availability_votes')
    ),
    'FK to study_groups(id) ON DELETE CASCADE.'

  union all
  select 12,
    '0029  vote_availability writes group_id  (single-cell path)',
    exists (
      select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'vote_availability'
        and p.prosrc like '%availability_votes (slot_id, user_id, group_id)%'
    ),
    'False => Space/Enter on a single grid cell also fails the NOT NULL check.'

  -- ── 0032: THE FIX — batch voting writes group_id ───────────────────
  union all
  select 13,
    '0032  set_availability_votes writes group_id  (the grid-drag path)',
    exists (
      select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'set_availability_votes'
        and p.prosrc like '%availability_votes (slot_id, user_id, group_id)%'
    ),
    'FALSE here = the availability-poll outage. Migration 0032 fixes exactly this.'

  -- ── Assumptions this repair makes (0024 / 0026 / 0027 already ran) ──
  union all
  select 14,
    '0027  study_groups.description column exists',
    exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('public.study_groups')
        and a.attname = 'description' and a.attnum > 0 and not a.attisdropped
    ),
    'FALSE => 0027 never ran; create_study_group / update_group_settings are broken. Tell me.'

  union all
  select 15,
    '0027  update_group_settings takes p_description',
    exists (
      select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'update_group_settings'
        and pg_catalog.pg_get_function_arguments(p.oid) like '%p_description%'
    ),
    'The signature lib/actions/groups.ts calls. FALSE => group settings save is down.'

  union all
  select 16,
    '0024  deleted_account_emails table exists',
    pg_catalog.to_regclass('public.deleted_account_emails') is not null,
    'Law-enforcement email retention. Not user-facing; if FALSE, worth a follow-up migration.'
)
select
  case when ok then '✅ PASS' else '❌ FAIL' end as result,
  name,
  detail
from r
order by ok, sort;


-- ────────────────────────────────────────────────────────────────────────
-- Migration-history high-water mark. Run this ONE line on its own
-- (select it, then Run) so a missing table can't hide the results above:
--
--   select version from supabase_migrations.schema_migrations order by version;
--
-- Expect a contiguous run through at least 0031 (0032 after you push it).
-- ────────────────────────────────────────────────────────────────────────
