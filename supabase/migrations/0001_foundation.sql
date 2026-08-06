-- ============================================================================
-- 0001 — Foundation: universities, profiles, notifications, auth triggers.
--
-- WHAT THIS FILE DOES (read this first if SQL is new to you)
--   1. Creates the `universities` allow-list — the single row that decides
--      which email domains may sign up. Adding a second school later is
--      INSERT one row here; no code changes anywhere.
--   2. Creates `profiles` — one row per user, holding everything about a
--      student that isn't managed by Supabase Auth itself.
--   3. Creates `notifications` — the in-app inbox every later feature
--      writes into.
--   4. Installs triggers on auth.users that (a) REJECT signups from
--      non-allow-listed email domains and (b) auto-create a profile row.
--
-- WHY THE DOMAIN CHECK LIVES HERE AND NOT IN THE APP:
--   Form validation can be bypassed (curl straight at the auth API) and the
--   Google OAuth "hd" hint can be bypassed (sign in with a personal Gmail).
--   A database trigger cannot be bypassed by anyone — it runs no matter how
--   the user row is created, covering BOTH sign-in methods with one rule.
--
-- Every statement is idempotent (safe to run twice).
-- ============================================================================

-- ── Universities: the email-domain allow-list ───────────────────────────────

create table if not exists public.universities (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email_domain text not null unique,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

comment on table public.universities is
  'Allow-list of schools whose students may sign up. One row per school. '
  'The signup trigger checks new emails against email_domain. To launch at '
  'a second university, insert a row here — that is the whole rollout.';
comment on column public.universities.email_domain is
  'Bare domain, lowercase, no @ (e.g. umn.edu). Compared case-insensitively.';
comment on column public.universities.is_active is
  'Flip to false to pause signups for a school without deleting history.';

-- Everyone may read the allow-list (it is public knowledge, not a secret);
-- nobody but the service role may change it.
alter table public.universities enable row level security;
drop policy if exists "universities are readable by everyone" on public.universities;
create policy "universities are readable by everyone"
  on public.universities for select
  to anon, authenticated
  using (true);

-- ── Profiles: one row per student ───────────────────────────────────────────

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  university_id uuid not null references public.universities (id),
  email         text not null,

  -- Identity. display_name is NULL until onboarding finishes — the app uses
  -- that NULL as the "must finish onboarding" signal, which is what makes
  -- the wizard refresh-safe (no separate half-done state to corrupt).
  display_name  text check (display_name is null or char_length(display_name) between 1 and 50),
  avatar_url    text,
  bio           text check (bio is null or char_length(bio) <= 500),

  -- Academic info. All optional — onboarding never gates on these.
  college        text check (college is null or college in
                   ('cse','cla','carlson','cbs','cfans','design','education','nursing','other')),
  major          text check (major is null or char_length(major) <= 100),
  class_standing text check (class_standing is null or class_standing in
                   ('freshman','sophomore','junior','senior','graduate')),
  graduation_month int check (graduation_month is null or graduation_month between 1 and 12),
  graduation_year  int check (graduation_year is null or graduation_year between 2020 and 2040),

  -- Up to 5 http(s) links, stored as a JSON array of strings.
  social_links jsonb not null default '[]'::jsonb
    check (jsonb_typeof(social_links) = 'array' and jsonb_array_length(social_links) <= 5),

  -- Per-field privacy. A key set to true means "hide this from others",
  -- e.g. {"major": true}. Missing key = visible. Valid keys: college,
  -- major, class_standing, bio, graduation, social_links, courses_current,
  -- courses_taken, courses_future. Enforced by the profile/search functions
  -- in migration 0008 — NEVER read profiles directly for another user.
  privacy jsonb not null default '{}'::jsonb,

  -- "Open to 1-on-1 study buddy sessions" toggle (drives the discovery page).
  is_available_for_buddies boolean not null default false,

  -- Moderation. suspended/banned users are locked out by the app shell and
  -- excluded from search/suggestions by the functions in 0008.
  account_status text not null default 'active'
    check (account_status in ('active','suspended','banned')),
  is_admin boolean not null default false,

  onboarded_at  timestamptz,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'One row per user, created automatically by the auth trigger below. Holds '
  'everything about a student except their password/session (Supabase Auth '
  'owns those). Other users must NEVER read this table directly — they go '
  'through get_public_profile()/search_people(), which apply privacy flags.';
comment on column public.profiles.privacy is
  'Hidden-field flags, e.g. {"major":true}. A hidden field is stripped from '
  'API responses AND excludes the user from filtering on that field — '
  'otherwise appearing in a filtered result would leak the hidden value.';
comment on column public.profiles.email is
  'Copy of auth.users.email, kept in sync by trigger. Exists so people '
  'search can match on email server-side. Never shown to other users.';

-- Search/filter indexes: the people-filter panel queries these columns, and
-- they must stay fast as the user base grows.
create index if not exists profiles_college_idx        on public.profiles (college);
create index if not exists profiles_major_idx          on public.profiles (major);
create index if not exists profiles_class_standing_idx on public.profiles (class_standing);
create index if not exists profiles_grad_year_idx      on public.profiles (graduation_year);
create index if not exists profiles_buddies_idx        on public.profiles (is_available_for_buddies)
  where is_available_for_buddies;

alter table public.profiles enable row level security;

-- You can read and edit YOUR OWN full row. Other people's profiles are only
-- reachable through the privacy-applying functions (migration 0008) and the
-- public_profiles view below — that is what makes hidden fields truly hidden
-- even from someone poking the API directly.
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Column-level lockdown: even on your own row you may not touch moderation
-- or identity-critical columns (account_status, is_admin, email, university).
-- RLS is row-level only, so this is done with column grants.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, bio, college, major, class_standing,
              graduation_month, graduation_year, social_links, privacy,
              is_available_for_buddies, onboarded_at, last_login_at, updated_at)
  on public.profiles to authenticated;

-- ── public_profiles: the safe "name + avatar" surface ───────────────────────
-- Chat bubbles, member lists, and search results need SOMEONE's name and
-- picture. Those two fields are the user's public identity and are never
-- hideable, so we expose exactly them (and nothing else) through this view.
-- The view runs with its owner's rights (postgres), bypassing profiles RLS —
-- which is safe precisely because it exposes only unhideable fields.
create or replace view public.public_profiles as
  select id, display_name, avatar_url
  from public.profiles
  where account_status = 'active';

comment on view public.public_profiles is
  'Safe subset of profiles (id, display_name, avatar_url) for joins in chat, '
  'member lists, etc. Excludes suspended/banned users. If you are tempted to '
  'add a column here, check the privacy spec first — most fields are hideable '
  'and must go through get_public_profile() instead.';

grant select on public.public_profiles to authenticated;

-- ── Notifications: the in-app inbox ─────────────────────────────────────────

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  -- Machine-readable kind, e.g. 'group_invitation', 'friend_request'.
  -- The app maps each type to icon + copy + destination link.
  type         text not null,
  -- Type-specific details (group id/name, actor name, …). JSON so adding a
  -- new notification type never needs a migration.
  payload      jsonb not null default '{}'::jsonb,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

comment on table public.notifications is
  'In-app notification inbox. Rows are only ever inserted by SECURITY '
  'DEFINER functions (never by clients). The bell badge counts rows where '
  'read_at is null; realtime INSERT events drive the live badge.';

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications"
  on public.notifications for select
  to authenticated
  using (recipient_id = (select auth.uid()));

-- Users may only flip their own notifications to read (read_at is the only
-- grantable column). Creation is reserved for database functions.
drop policy if exists "users mark own notifications read" on public.notifications;
create policy "users mark own notifications read"
  on public.notifications for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

revoke insert, delete on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Realtime: the bell subscribes to INSERTs on this table. Adding the table
-- to the supabase_realtime publication is what makes those events flow;
-- row-level security still decides WHO may receive each event.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ── Shared helper functions ─────────────────────────────────────────────────

-- Stamps updated_at on any UPDATE. Attached to tables that carry updated_at.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- app_notify: the one way notification rows get created. SECURITY DEFINER
-- so the group/friend/meetup functions (which run as the calling user's
-- definer context) can write to a table clients cannot.
create or replace function public.app_notify(
  p_recipient uuid,
  p_type      text,
  p_payload   jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (recipient_id, type, payload)
  values (p_recipient, p_type, coalesce(p_payload, '{}'::jsonb));
end;
$$;

revoke execute on function public.app_notify(uuid, text, jsonb) from public, anon, authenticated;

-- ── Auth triggers: THE domain gate + profile auto-creation ──────────────────

-- (a) BEFORE INSERT on auth.users: reject any email whose domain is not on
-- the active allow-list. Raising an exception here aborts the signup for
-- both email/password AND Google sign-ins — this is the security boundary
-- the whole "UMN students only" promise rests on.
create or replace function public.enforce_university_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain text;
begin
  -- OAuth providers always supply an email; if one ever doesn't, we cannot
  -- verify eligibility, so we refuse.
  if new.email is null then
    raise exception 'EMAIL_DOMAIN_NOT_ALLOWED';
  end if;

  v_domain := lower(split_part(new.email, '@', 2));

  if not exists (
    select 1 from public.universities u
    where lower(u.email_domain) = v_domain and u.is_active
  ) then
    -- The app recognizes this exact code and shows the friendly
    -- "Only @umn.edu accounts can join" screen (see lib/errors.ts).
    raise exception 'EMAIL_DOMAIN_NOT_ALLOWED';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_university_email on auth.users;
create trigger enforce_university_email
  before insert on auth.users
  for each row execute function public.enforce_university_email();

-- (b) AFTER INSERT on auth.users: create the matching profile row.
-- display_name intentionally stays NULL — the onboarding wizard fills it in,
-- and its NULL-ness is how the app knows onboarding isn't done yet.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_university uuid;
begin
  select u.id into v_university
  from public.universities u
  where lower(u.email_domain) = lower(split_part(new.email, '@', 2))
    and u.is_active;

  insert into public.profiles (id, university_id, email)
  values (new.id, v_university, new.email)
  on conflict (id) do nothing; -- makes re-running auth backfills harmless

  return new;
end;
$$;

drop trigger if exists handle_new_auth_user on auth.users;
create trigger handle_new_auth_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- (c) Keep profiles.email in sync if the user ever changes their auth email
-- (they can only change it to another allow-listed domain — Supabase runs
-- the BEFORE trigger path only on INSERT, so we re-check here).
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain text;
begin
  if new.email is distinct from old.email then
    v_domain := lower(split_part(new.email, '@', 2));
    if not exists (
      select 1 from public.universities u
      where lower(u.email_domain) = v_domain and u.is_active
    ) then
      raise exception 'EMAIL_DOMAIN_NOT_ALLOWED';
    end if;
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_profile_email on auth.users;
create trigger sync_profile_email
  after update of email on auth.users
  for each row execute function public.sync_profile_email();
