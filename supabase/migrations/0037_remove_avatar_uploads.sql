-- ============================================================================
-- 0037 — remove user-uploaded profile pictures.
--
-- Avatar uploads are gone from the app (lib/actions/profile.ts, the
-- onboarding wizard, and the profile form). Every avatar is now the
-- initials fallback rendered by <Avatar>.
--
-- WHY: hosting user-uploaded images on a platform that also enables
-- private messaging and in-person meetups is a child-safety / CSAM
-- liability — there is no image scanning and no NCMEC reporting pipeline —
-- for near-zero product benefit on a study-coordination tool.
--
-- This migration:
--   1. clears every stored avatar_url;
--   2. revokes the avatar_url UPDATE grant, so no client (the app or a
--      direct PostgREST call) can set it to an arbitrary URL — an
--      attacker-controlled avatar_url would render as an <img> on every
--      page that shows the profile, a tracking-pixel / viewer-
--      deanonymization vector;
--   3. drops the "avatars" storage bucket's access policies, so no new
--      object can be uploaded (or read) even through the Storage API.
--
-- NOTE: hosted Supabase forbids `delete from storage.objects` /
-- `delete from storage.buckets` in SQL (SQLSTATE 42501 — "use the Storage
-- API instead"). Emptying and deleting the bucket itself is a manual
-- follow-up step: Supabase dashboard -> Storage -> avatars -> select all
-- files -> delete, then delete the bucket. Or run scripts/purge-avatars
-- with the service-role key. Until then, the objects are orphaned (no
-- avatar_url references them) and unreadable (policies dropped below).
--
-- Idempotent. Safe on a live database.
-- ============================================================================

update public.profiles set avatar_url = null where avatar_url is not null;

-- Column-level privileges are tracked per column, so this leaves every
-- other granted column on public.profiles untouched (see 0001).
revoke update (avatar_url) on public.profiles from authenticated;

-- Policy DDL on storage.objects is permitted (this is how 0009 created
-- these). With all four gone, the bucket can neither be written to nor
-- read from through the API.
drop policy if exists "avatar images are publicly readable" on storage.objects;
drop policy if exists "users upload own avatar" on storage.objects;
drop policy if exists "users update own avatar" on storage.objects;
drop policy if exists "users delete own avatar" on storage.objects;
