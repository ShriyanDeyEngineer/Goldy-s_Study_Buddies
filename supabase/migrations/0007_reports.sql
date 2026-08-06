-- ============================================================================
-- 0007 — Reporting and moderation.
--
-- WHAT THIS FILE DOES
--   The `reports` table (students reporting other students) and the
--   function that files one. Moderation ACTIONS (suspending/banning) are a
--   manual admin task for now: an admin sets profiles.account_status by
--   hand (or via future tooling — that is what profiles.is_admin exists
--   for). The app enforces the consequences of those statuses everywhere.
-- ============================================================================

create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid not null references public.profiles (id) on delete cascade,
  -- Fixed category list per the spec — free-text-only reports are
  -- impossible to triage at any volume.
  category         text not null check (category in
    ('harassment','spam','inappropriate_content','impersonation','academic_dishonesty','other')),
  description      text check (description is null or char_length(description) <= 1000),
  status           text not null default 'open'
    check (status in ('open','reviewing','resolved','dismissed')),
  -- What the team decided, written when closing the report.
  resolution       text,
  created_at       timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);

comment on table public.reports is
  'User reports for the team to review. Filed via report_user(); read via '
  'the Supabase dashboard or by admins (profiles.is_admin) — regular users '
  'can never read reports, including their own past ones (nothing useful '
  'to show, and it would leak moderation state).';

create index if not exists reports_open_idx on public.reports (status, created_at)
  where status = 'open';

alter table public.reports enable row level security;

-- "Is the current user an admin?" — definer so the check works even
-- though users can only select their own profile row.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admins read reports" on public.reports;
create policy "admins read reports"
  on public.reports for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins update reports" on public.reports;
create policy "admins update reports"
  on public.reports for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── report_user ─────────────────────────────────────────────────────────────

-- Files a report. Returns the new report id (the server action includes it
-- in the optional email to the moderation inbox).
--
-- Note: we do NOT block reporting someone who blocked you — being blocked
-- by your harasser must never protect them from being reported.
create or replace function public.report_user(
  p_user        uuid,
  p_category    text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
  v_description text := nullif(trim(coalesce(p_description, '')), '');
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_user = v_uid then
    raise exception 'SELF_ACTION';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'USER_NOT_FOUND';
  end if;
  if p_category not in
    ('harassment','spam','inappropriate_content','impersonation','academic_dishonesty','other') then
    raise exception 'INVALID_CATEGORY';
  end if;
  if v_description is not null and char_length(v_description) > 1000 then
    raise exception 'DESCRIPTION_TOO_LONG';
  end if;

  insert into public.reports (reporter_id, reported_user_id, category, description)
  values (v_uid, p_user, p_category, v_description)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.report_user(uuid, text, text) from public, anon;
grant execute on function public.report_user(uuid, text, text) to authenticated;
