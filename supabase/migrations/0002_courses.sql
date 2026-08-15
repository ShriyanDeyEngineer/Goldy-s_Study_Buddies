-- ============================================================================
-- 0002 — Courses and enrollments.
--
-- WHAT THIS FILE DOES
--   1. `courses` — the catalog students browse. Seeded with verified UMN
--      courses (supabase/seed.sql); students can add missing ones through
--      create_course(); admins can bulk-import via scripts/import-courses.ts.
--   2. `user_courses` — which courses each student marked as current /
--      already taken / planned ("future"). Drives the dashboard, the invite
--      picker, people filters, and suggestions.
--   3. create_course() — the "Add a missing course" path. Find-or-create,
--      so adding a duplicate quietly routes you to the existing course
--      instead of erroring confusingly.
-- ============================================================================

create table if not exists public.courses (
  id              uuid primary key default gen_random_uuid(),
  university_id   uuid not null references public.universities (id),
  -- Normalized to UPPERCASE by create_course(); seed data is written
  -- uppercase already. Keeping one case means the uniqueness constraint
  -- below actually catches duplicates like "csci 1133" vs "CSCI 1133".
  department_code text not null check (department_code ~ '^[A-Z]{2,8}$'),
  course_number   text not null check (course_number ~ '^[0-9]{1,4}[A-Z]{0,3}$'),
  course_name     text not null check (char_length(course_name) between 1 and 200),
  is_active       boolean not null default true,
  -- Who added it (null for seeded/imported rows). on delete set null so
  -- deleting an account never deletes a course other students rely on.
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),

  -- A course exists once per university. This is also what seed.sql's
  -- "on conflict … do nothing" targets, so renaming it breaks seeding.
  constraint courses_unique_per_university
    unique (university_id, department_code, course_number)
);

comment on table public.courses is
  'The course catalog. Rows come from seed data, the admin CSV import, or '
  'students using "Add a missing course". Never hard-delete a course that '
  'has groups — flip is_active off instead.';

-- The catalog search box filters on these.
create index if not exists courses_department_idx on public.courses (university_id, department_code);

alter table public.courses enable row level security;

-- Any signed-in student can browse the whole catalog. Writes go through
-- create_course() below (or the service-role import script), never directly.
drop policy if exists "authenticated users read courses" on public.courses;
create policy "authenticated users read courses"
  on public.courses for select
  to authenticated
  using (true);

-- Grant + policy pair (see the grants note in 0001).
grant select on public.courses to authenticated;

-- ── Enrollments ─────────────────────────────────────────────────────────────

create table if not exists public.user_courses (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  course_id       uuid not null references public.courses (id) on delete cascade,
  -- 'current' = taking it now (drives groups/invites/filters),
  -- 'taken'   = finished it, 'future' = planning to take it.
  enrollment_type text not null check (enrollment_type in ('current','taken','future')),
  created_at      timestamptz not null default now(),

  -- "Unique per triple" per the spec: the same course may legitimately
  -- appear as e.g. both 'taken' and 'future' (retakes), but never twice
  -- with the same type.
  primary key (user_id, course_id, enrollment_type)
);

comment on table public.user_courses is
  'Which courses each student attached to their profile, split into '
  'current / taken / future lists. The `current` list is the one that '
  'matters for matching: group invites, people filters, and suggestions '
  'all key off it.';

-- The invite picker and people search ask "who is taking course X right
-- now?" — this index answers that without scanning the table.
create index if not exists user_courses_course_idx
  on public.user_courses (course_id, enrollment_type);

alter table public.user_courses enable row level security;

-- You manage (and see) only your own course lists. Other people's lists are
-- served by the privacy-aware functions in 0008, which respect the
-- courses_current/taken/future privacy flags.
drop policy if exists "users read own enrollments" on public.user_courses;
create policy "users read own enrollments"
  on public.user_courses for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "users add own enrollments" on public.user_courses;
create policy "users add own enrollments"
  on public.user_courses for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "users remove own enrollments" on public.user_courses;
create policy "users remove own enrollments"
  on public.user_courses for delete
  to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, delete on public.user_courses to authenticated;

-- ── create_course: the "Add a missing course" write path ────────────────────

-- Find-or-create a course in the caller's university.
--
-- Returns (course_id, created): created=false means it already existed and
-- the app should route the student to the existing page — the spec is
-- explicit that a duplicate must not surface as a confusing error.
--
-- Lives in the database (SECURITY DEFINER) because clients have no INSERT
-- right on courses: this function is the single choke point that normalizes
-- codes to uppercase and validates their shape, so the catalog can't fill
-- up with "csci-1133", "CSCI 1133 ", and "Csci1133" variants.
create or replace function public.create_course(
  p_department_code text,
  p_course_number   text,
  p_course_name     text
)
returns table (course_id uuid, created boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_university uuid;
  v_dept       text := upper(trim(coalesce(p_department_code, '')));
  v_num        text := upper(trim(coalesce(p_course_number, '')));
  v_name       text := trim(coalesce(p_course_name, ''));
  v_existing   uuid;
  v_new        uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select p.university_id into v_university from public.profiles p where p.id = v_uid;
  if v_university is null then
    raise exception 'NOT_ONBOARDED';
  end if;

  -- Same shape rules as the table's CHECK constraints, validated up front
  -- so students get a specific code instead of a raw constraint violation.
  if v_dept !~ '^[A-Z]{2,8}$' then
    raise exception 'INVALID_DEPARTMENT';
  end if;
  if v_num !~ '^[0-9]{1,4}[A-Z]{0,3}$' then
    raise exception 'INVALID_COURSE_NUMBER';
  end if;
  if char_length(v_name) not between 1 and 200 then
    raise exception 'INVALID_COURSE_NAME';
  end if;

  select c.id into v_existing
  from public.courses c
  where c.university_id = v_university
    and c.department_code = v_dept
    and c.course_number = v_num;

  if v_existing is not null then
    return query select v_existing, false;
    return;
  end if;

  insert into public.courses (university_id, department_code, course_number, course_name, created_by)
  values (v_university, v_dept, v_num, v_name, v_uid)
  returning id into v_new;

  return query select v_new, true;
exception
  -- Two students adding the same course at the same instant: the loser of
  -- the race hits the unique constraint; treat it as "already existed".
  when unique_violation then
    select c.id into v_existing
    from public.courses c
    where c.university_id = v_university
      and c.department_code = v_dept
      and c.course_number = v_num;
    return query select v_existing, false;
end;
$$;

revoke execute on function public.create_course(text, text, text) from public, anon;
grant execute on function public.create_course(text, text, text) to authenticated;

-- NOTE: get_course_classmates() — the invite-picker query that lists who is
-- currently enrolled in a course — lives in migration 0008 with the other
-- people-reading functions, because it must consult the blocks table
-- (created in 0003) and the privacy flags.
