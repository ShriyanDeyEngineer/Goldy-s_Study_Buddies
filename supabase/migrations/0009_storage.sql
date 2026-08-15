-- ============================================================================
-- 0009 — Storage: the profile-picture bucket.
--
-- WHAT THIS FILE DOES
--   Creates the `avatars` bucket and its access policies. Pictures are
--   public-readable (they appear in chat, search, member lists — gating
--   reads would break every <img> tag), but each user may only write
--   inside their own folder: avatars/<their-user-id>/...
--
-- LIMITS enforced at the BUCKET level (5 MB, JPEG/PNG only) duplicate the
-- server action's checks on purpose — the action gives friendly errors,
-- the bucket guarantees the rule holds even for uploads that bypass the
-- app entirely.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB in bytes
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may view avatars (the bucket is public; this SELECT policy also
-- lets the client SDK list/download through the API path).
drop policy if exists "avatar images are publicly readable" on storage.objects;
create policy "avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Uploads/overwrites/deletes: only within your own top-level folder.
-- storage.foldername(name) returns the path segments; segment 1 must be
-- the caller's user id. This is what stops one student from replacing
-- another student's picture.
drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
