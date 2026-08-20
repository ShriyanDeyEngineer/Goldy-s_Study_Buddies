-- ============================================================================
-- 0013 — Per-student theme preference (light / dark).
--
-- WHAT THIS FILE DOES
--   Adds the one column dark mode needs. The theme is an ACCOUNT setting,
--   not a device one: pick dark on your laptop and your phone matches.
--
--   WHY THE DATABASE AND NOT localStorage
--   The signed-in layout (app/(app)/layout.tsx) is a server component that
--   already selects the full profile row on every render. Reading the theme
--   there costs no extra query, and it means the <div class="dark"> is in
--   the FIRST byte of HTML — no flash of a light page before JS boots.
--   localStorage would be free of this migration but would need a blocking
--   inline <script> in <head> to avoid that flash, and would not follow the
--   student between devices.
--
--   Only 'light' and 'dark' are allowed. A 'system' option would have to be
--   resolved by matchMedia in the browser, which reintroduces exactly the
--   flash this design avoids. If the team wants it later: add it to the
--   CHECK, then render the wrapper with a `suppressHydrationWarning` and a
--   tiny head script that maps system -> light/dark before first paint.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + drop/add the constraint.
-- ============================================================================

alter table public.profiles
  add column if not exists theme text not null default 'light';

-- The allowed values. Kept as a named constraint so re-running this file is
-- safe and so the app's TypeScript union has one un-bypassable counterpart.
alter table public.profiles
  drop constraint if exists profiles_theme_valid;
alter table public.profiles
  add constraint profiles_theme_valid
  check (theme in ('light','dark'));

comment on column public.profiles.theme is
  'Which color theme this student sees on signed-in pages. Read by the app '
  'layout to put .dark on the page wrapper. Marketing and auth pages are '
  'always light and ignore this. Set from the header avatar menu.';

-- The student may flip their own theme (column-level, matching the other
-- self-editable profile columns in 0001 and email_notifications in 0011).
grant update (theme) on public.profiles to authenticated;
