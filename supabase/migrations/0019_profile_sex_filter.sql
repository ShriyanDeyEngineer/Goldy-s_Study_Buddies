-- ============================================================================
-- 0019 — sex on profiles + people-filter support.
--
-- Collected once during onboarding: 'male', 'female', or 'undisclosed'
-- ("prefer not to say"). Semantics:
--   - Male/female are PERMANENT once chosen (set_sex refuses changes) —
--     the onboarding UI says so before the student picks.
--   - 'undisclosed' may later be upgraded to male/female (still one-way).
--   - The people filter offers Male/Female; undisclosed and legacy-null
--     students are simply absent from sex-filtered results, the same
--     "excluded from that filter" rule the privacy flags use.
--   - Not shown on profiles, not returned by search — filterable only.
--
-- The column is deliberately NOT in the profiles column-update grant
-- (0001/0011), so the only write path is set_sex().
-- ============================================================================

alter table public.profiles
  add column sex text check (sex in ('male', 'female', 'undisclosed'));

comment on column public.profiles.sex is
  'male | female | undisclosed | null(pre-field accounts). Set once via set_sex(); male/female are locked after that.';

create index profiles_sex_idx on public.profiles (sex) where sex in ('male', 'female');

create or replace function public.set_sex(p_sex text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_current text;
begin
  -- Bare auth check: this runs during onboarding, BEFORE display_name
  -- exists, so assert_active_caller() would wrongly reject it.
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_sex not in ('male', 'female', 'undisclosed') then
    raise exception 'INVALID_SEX';
  end if;
  select sex into v_current from public.profiles where id = v_uid;
  if not found then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  -- Locked once a real value is chosen; re-sending the same value is a
  -- no-op so retries stay safe.
  if v_current in ('male', 'female') and v_current <> p_sex then
    raise exception 'SEX_LOCKED';
  end if;
  update public.profiles set sex = p_sex where id = v_uid;
end;
$$;

revoke execute on function public.set_sex(text) from public, anon;
grant execute on function public.set_sex(text) to authenticated;

-- search_people gains p_sex. New parameter = new signature, so the old
-- overload must be dropped (create-or-replace would leave both behind)
-- and the grants restated — same dance as 0011's create_meetup.
drop function if exists public.search_people(text, uuid[], text[], text[], text[], int, int, boolean, int, int);

create or replace function public.search_people(
  p_query      text default null,
  p_course_ids uuid[] default null,
  p_majors     text[] default null,
  p_colleges   text[] default null,
  p_standings  text[] default null,
  p_grad_min   int default null,
  p_grad_max   int default null,
  p_buddy_only boolean default false,
  p_sex        text default null,
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
      -- Shared-course count for ranking. Zero when the target hides their
      -- list — hidden data must not influence anything observable.
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
      -- text search
      ((select pattern from q) is null
        or b.display_name ilike (select pattern from q)
        or b.email ilike (select pattern from q))
      -- course filter (Rule 2: hidden course list → excluded entirely)
      and (p_course_ids is null or cardinality(p_course_ids) = 0 or (
        not b.h_courses and exists (
          select 1 from public.user_courses uc
          where uc.user_id = b.id
            and uc.enrollment_type = 'current'
            and uc.course_id = any (p_course_ids)
        )))
      -- major filter
      and (p_majors is null or cardinality(p_majors) = 0
        or (not b.h_major and b.major = any (p_majors)))
      -- college filter
      and (p_colleges is null or cardinality(p_colleges) = 0
        or (not b.h_college and b.college = any (p_colleges)))
      -- class-standing filter
      and (p_standings is null or cardinality(p_standings) = 0
        or (not b.h_standing and b.class_standing = any (p_standings)))
      -- graduation-year range (either bound, or both)
      and (p_grad_min is null
        or (not b.h_grad and b.graduation_year is not null and b.graduation_year >= p_grad_min))
      and (p_grad_max is null
        or (not b.h_grad and b.graduation_year is not null and b.graduation_year <= p_grad_max))
      -- study-buddy toggle (not a hideable field — the toggle itself is
      -- the user's consent to being discovered this way)
      and (not p_buddy_only or b.is_available_for_buddies)
      -- sex filter: only 'male'/'female' are filterable; students who
      -- chose "prefer not to say" (or predate the field) simply never
      -- appear in sex-filtered results — same exclusion rule as every
      -- hidden field.
      and (p_sex is null or b.sex = p_sex)
  )
  select
    f.id,
    f.display_name,
    f.avatar_url,
    -- Rule 1 applied to output: hidden fields leave as NULL.
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

revoke execute on function public.search_people(text, uuid[], text[], text[], text[], int, int, boolean, text, int, int) from public, anon;
grant execute on function public.search_people(text, uuid[], text[], text[], text[], int, int, boolean, text, int, int) to authenticated;
