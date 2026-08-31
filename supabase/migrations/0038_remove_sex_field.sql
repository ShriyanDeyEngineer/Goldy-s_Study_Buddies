-- ============================================================================
-- 0038 — remove the `sex` profile field and the "filter people by sex"
-- feature (added in 0019).
--
-- WHY: a study-coordination tool that explicitly is not a dating platform
-- has no clear need for members' sex, it was collected without disclosure
-- in the privacy policy, the value was permanently uncorrectable (which
-- contradicts the stated right to correct), it offered only
-- male/female/undisclosed, and a global "filter study partners by sex"
-- control is a discrimination-complaint vector under the Minnesota Human
-- Rights Act.
--
-- This migration:
--   1. reverts search_people() to its pre-0019 signature (no p_sex);
--   2. drops set_sex();
--   3. drops the sex column (and its index by cascade), discarding every
--      stored value.
--
-- Idempotent.
-- ============================================================================

-- ── 1. search_people without p_sex ──────────────────────────────────────────
-- Drop the 0019 overload (…, p_buddy_only boolean, p_sex text, p_limit,
-- p_offset) so create-or-replace doesn't leave both behind.
drop function if exists public.search_people(
  text, uuid[], text[], text[], text[], int, int, boolean, text, int, int
);

create or replace function public.search_people(
  p_query      text default null,
  p_course_ids uuid[] default null,
  p_majors     text[] default null,
  p_colleges   text[] default null,
  p_standings  text[] default null,
  p_grad_min   int default null,
  p_grad_max   int default null,
  p_buddy_only boolean default false,
  p_limit      int default 30,
  p_offset     int default 0
)
returns table (
  id             uuid,
  display_name   text,
  avatar_url     text,
  college        text,
  major          text,
  class_standing text,
  graduation_year int,
  is_available_for_buddies boolean,
  shared_courses bigint,
  total_count    bigint
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with viewer as (
    select p.id, p.university_id, p.graduation_year,
           coalesce((p.privacy->>'graduation')::boolean, false) as my_grad_hidden
    from public.profiles p where p.id = auth.uid()
  ),
  my_courses as (
    select uc.course_id
    from public.user_courses uc
    where uc.user_id = auth.uid() and uc.enrollment_type = 'current'
  ),
  -- Escape LIKE wildcards in the query so a search for "100%" doesn't
  -- match everything (spec pitfall #5: never trust raw input in filters).
  q as (
    select case
      when nullif(trim(coalesce(p_query, '')), '') is null then null
      else '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    end as pattern
  ),
  base as (
    select
      p.*,
      coalesce((p.privacy->>'college')::boolean,         false) as h_college,
      coalesce((p.privacy->>'major')::boolean,           false) as h_major,
      coalesce((p.privacy->>'class_standing')::boolean,  false) as h_standing,
      coalesce((p.privacy->>'graduation')::boolean,      false) as h_grad,
      coalesce((p.privacy->>'courses_current')::boolean, false) as h_courses
    from public.profiles p
    cross join viewer v
    where p.university_id = v.university_id
      and p.id <> v.id
      and p.display_name is not null
      and p.account_status = 'active'
      and not public.are_blocked(v.id, p.id)
  ),
  filtered as (
    select
      b.*,
      case when b.h_courses then 0 else (
        select count(*)
        from public.user_courses uc
        where uc.user_id = b.id
          and uc.enrollment_type = 'current'
          and uc.course_id in (select course_id from my_courses)
      ) end as shared_courses,
      case when b.h_grad or (select my_grad_hidden from viewer) then false
           else b.graduation_year is not null
                and b.graduation_year = (select graduation_year from viewer)
      end as same_grad_year
    from base b
    where
      ((select pattern from q) is null
        or b.display_name ilike (select pattern from q)
        or b.email ilike (select pattern from q))
      and (p_course_ids is null or cardinality(p_course_ids) = 0 or (
        not b.h_courses and exists (
          select 1 from public.user_courses uc
          where uc.user_id = b.id
            and uc.enrollment_type = 'current'
            and uc.course_id = any (p_course_ids)
        )))
      and (p_majors is null or cardinality(p_majors) = 0
        or (not b.h_major and b.major = any (p_majors)))
      and (p_colleges is null or cardinality(p_colleges) = 0
        or (not b.h_college and b.college = any (p_colleges)))
      and (p_standings is null or cardinality(p_standings) = 0
        or (not b.h_standing and b.class_standing = any (p_standings)))
      and (p_grad_min is null
        or (not b.h_grad and b.graduation_year is not null and b.graduation_year >= p_grad_min))
      and (p_grad_max is null
        or (not b.h_grad and b.graduation_year is not null and b.graduation_year <= p_grad_max))
      and (not p_buddy_only or b.is_available_for_buddies)
  )
  select
    f.id,
    f.display_name,
    f.avatar_url,
    case when f.h_college  then null else f.college        end,
    case when f.h_major    then null else f.major          end,
    case when f.h_standing then null else f.class_standing end,
    case when f.h_grad     then null else f.graduation_year end,
    f.is_available_for_buddies,
    f.shared_courses,
    count(*) over () as total_count
  from filtered f
  order by f.shared_courses desc, f.same_grad_year desc, f.display_name asc, f.id
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.search_people(
  text, uuid[], text[], text[], text[], int, int, boolean, int, int
) from public, anon;
grant execute on function public.search_people(
  text, uuid[], text[], text[], text[], int, int, boolean, int, int
) to authenticated;

-- ── 2. drop set_sex() ───────────────────────────────────────────────────────
drop function if exists public.set_sex(text);

-- ── 3. drop the column (index profiles_sex_idx drops with it) ────────────────
alter table public.profiles drop column if exists sex;
