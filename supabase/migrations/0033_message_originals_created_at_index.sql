-- ============================================================================
-- 0033 — index message_originals for the "latest first" read.
--
-- message_originals (0017) shipped with only its primary key. /admin/messages
-- reads it as `order by created_at desc limit 200`, and /admin/page counts
-- the whole table — both sequential-scan (plus a top-N sort) without this.
--
-- Low urgency: the table is admin-only and grows only when the profanity
-- filter alters a message. But it grows FOREVER (no cleanup), so the scan
-- gets slower every month. Column order matches the query.
--
-- No schema or behavior change. Idempotent; safe on a live database.
-- ============================================================================

create index if not exists message_originals_created_idx
  on public.message_originals (created_at desc);
