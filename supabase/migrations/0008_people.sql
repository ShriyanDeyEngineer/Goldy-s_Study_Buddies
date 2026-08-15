-- ============================================================================
-- 0008 — People: profile viewing, search, filters, and suggestions.
--
-- THIS IS THE PRIVACY-CRITICAL FILE. Read this before touching anything.
--
-- Two rules govern everything here (spec invariant #10):
--
--   RULE 1 — a hidden field is ABSENT from what other users receive.
--     Not blanked in the UI — absent from the database function's output,
--     so even someone calling the API directly cannot read it.
--
--   RULE 2 — a hidden field EXCLUDES you from that field's filter.
--     If you hide your major and someone filters people by major, you are
--     not in the result set AT ALL. Returning you with the major omitted
--     would still leak it: your mere presence in "major = Computer
--     Science" results answers the question you refused to answer.
--
--   Both rules are enforced HERE, in SECURITY DEFINER functions, because
--   profiles' RLS lets users read only their own row — every way one user
--   learns about another runs through these functions, giving privacy a
--   single choke point (and a single place to unit-test).
--
-- Universal exclusions (every function in this file):
--   yourself, users still in onboarding, suspended/banned accounts, and
--   anyone with a block in EITHER direction between you.
-- ============================================================================

-- ── get_course_classmates: the group-creation invite picker ─────────────────

-- Who is currently enrolled in this course? Used to offer invitees when
-- creating a group. Students who HID their current-courses list are
-- excluded (Rule 2: being listed as "a classmate in CSCI 1133" is exactly
-- the fact they hid).
create or replace function public.get_course_classmates(p_course_id uuid)
returns table (id uuid, display_name text, avatar_url text)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select p.id, p.display_name, p.avatar_url
  from public.user_courses uc
  join public.profiles p on p.id = uc.user_id
  where uc.course_id = p_course_id
    and uc.enrollment_type = 'current'
    and p.id <> auth.uid()
    and p.display_name is not null
    and p.account_status = 'active'
    and coalesce((p.privacy->>'courses_current')::boolean, false) = false
    and not public.are_blocked(auth.uid(), p.id)
  order by p.display_name
  limit 200;
$$;

revoke execute on function public.get_course_classmates(uuid) from public, anon;
grant execute on function public.get_course_classmates(uuid) to authenticated;

-- ── get_public_profile: one user viewing another ────────────────────────────

-- Returns the target's profile as JSON with hidden fields REMOVED, plus a
-- `relationship` object describing where the viewer stands (friend?
-- pending request? buddy? blocked by me?) so the profile page can render
-- the right buttons without extra queries.
--
-- Returns NULL (the app 404s) when: the target doesn't exist / isn't
-- onboarded / is suspended or banned, or the target has BLOCKED THE
-- VIEWER. A blocked person gets the same "not found" as a nonexistent
-- account — revealing "this person blocked you" invites retaliation.
--
-- Direction subtlety: if the VIEWER blocked the target, the profile still
-- loads (with blocked_by_me=true) so the viewer can find the Unblock
-- button where they expect it. (Judgment call — README.)
create or replace function public.get_public_profile(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_p   public.profiles%rowtype;
  v_result jsonb;
  v_friend_count int;
  v_courses jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_p from public.profiles where id = p_user_id;
  if not found
     or v_p.display_name is null
     or v_p.account_status <> 'active' then
    return null;
  end if;

  -- Target blocked the viewer → invisible, indistinguishable from absent.
  if v_p.id <> v_uid and exists (
    select 1 from public.blocks b
    where b.blocker_id = v_p.id and b.blocked_id = v_uid
  ) then
    return null;
  end if;

  select count(*) into v_friend_count
  from public.friends f
  where f.user_id_a = v_p.id or f.user_id_b = v_p.id;

  -- Always-visible identity fields. Friend count and member-since are on
  -- the profile spec's always-shown list (they are not hideable fields).
  v_result := jsonb_build_object(
    'id',            v_p.id,
    'display_name',  v_p.display_name,
    'avatar_url',    v_p.avatar_url,
    'friend_count',  v_friend_count,
    'member_since',  v_p.created_at,
    'is_available_for_buddies', v_p.is_available_for_buddies
  );

  -- Each hideable field: include only if (a) it's my own profile, or
  -- (b) the field is not hidden. jsonb simply lacks the key otherwise —
  -- that absence IS the feature (Rule 1).
  if v_p.id = v_uid or coalesce((v_p.privacy->>'college')::boolean, false) = false then
    v_result := v_result || jsonb_build_object('college', v_p.college);
  end if;
  if v_p.id = v_uid or coalesce((v_p.privacy->>'major')::boolean, false) = false then
    v_result := v_result || jsonb_build_object('major', v_p.major);
  end if;
  if v_p.id = v_uid or coalesce((v_p.privacy->>'class_standing')::boolean, false) = false then
    v_result := v_result || jsonb_build_object('class_standing', v_p.class_standing);
  end if;
  if v_p.id = v_uid or coalesce((v_p.privacy->>'bio')::boolean, false) = false then
    v_result := v_result || jsonb_build_object('bio', v_p.bio);
  end if;
  if v_p.id = v_uid or coalesce((v_p.privacy->>'graduation')::boolean, false) = false then
    v_result := v_result
      || jsonb_build_object('graduation_month', v_p.graduation_month)
      || jsonb_build_object('graduation_year',  v_p.graduation_year);
  end if;
  if v_p.id = v_uid or coalesce((v_p.privacy->>'social_links')::boolean, false) = false then
    v_result := v_result || jsonb_build_object('social_links', v_p.social_links);
  end if;

  -- The three class lists, each independently hideable.
  if v_p.id = v_uid or coalesce((v_p.privacy->>'courses_current')::boolean, false) = false then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'department_code', c.department_code,
      'course_number', c.course_number, 'course_name', c.course_name
    ) order by c.department_code, c.course_number), '[]'::jsonb)
    into v_courses
    from public.user_courses uc
    join public.courses c on c.id = uc.course_id
    where uc.user_id = v_p.id and uc.enrollment_type = 'current';
    v_result := v_result || jsonb_build_object('courses_current', v_courses);
  end if;
  if v_p.id = v_uid or coalesce((v_p.privacy->>'courses_taken')::boolean, false) = false then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'department_code', c.department_code,
      'course_number', c.course_number, 'course_name', c.course_name
    ) order by c.department_code, c.course_number), '[]'::jsonb)
    into v_courses
    from public.user_courses uc
    join public.courses c on c.id = uc.course_id
    where uc.user_id = v_p.id and uc.enrollment_type = 'taken';
    v_result := v_result || jsonb_build_object('courses_taken', v_courses);
  end if;
  if v_p.id = v_uid or coalesce((v_p.privacy->>'courses_future')::boolean, false) = false then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'department_code', c.department_code,
      'course_number', c.course_number, 'course_name', c.course_name
    ) order by c.department_code, c.course_number), '[]'::jsonb)
    into v_courses
    from public.user_courses uc
    join public.courses c on c.id = uc.course_id
    where uc.user_id = v_p.id and uc.enrollment_type = 'future';
    v_result := v_result || jsonb_build_object('courses_future', v_courses);
  end if;

  -- Relationship block (only meaningful when viewing someone else).
  if v_p.id <> v_uid then
    v_result := v_result || jsonb_build_object('relationship', jsonb_build_object(
      'is_friend', exists (
        select 1 from public.friends f
        where f.user_id_a = least(v_uid, v_p.id) and f.user_id_b = greatest(v_uid, v_p.id)
      ),
      'outgoing_friend_request', (
        select to_jsonb(x) from (
          select fr.id from public.friend_requests fr
          where fr.sender_id = v_uid and fr.recipient_id = v_p.id and fr.status = 'pending'
          limit 1
        ) x
      ),
      'incoming_friend_request', (
        select to_jsonb(x) from (
          select fr.id from public.friend_requests fr
          where fr.sender_id = v_p.id and fr.recipient_id = v_uid and fr.status = 'pending'
          limit 1
        ) x
      ),
      'is_buddy', exists (
        select 1 from public.study_buddy_connections c
        where c.user_id_a = least(v_uid, v_p.id) and c.user_id_b = greatest(v_uid, v_p.id)
      ),
      'outgoing_buddy_request', (
        select to_jsonb(x) from (
          select br.id from public.study_buddy_requests br
          where br.sender_id = v_uid and br.recipient_id = v_p.id and br.status = 'pending'
          limit 1
        ) x
      ),
      'incoming_buddy_request', (
        select to_jsonb(x) from (
          select br.id from public.study_buddy_requests br
          where br.sender_id = v_p.id and br.recipient_id = v_uid and br.status = 'pending'
          limit 1
        ) x
      ),
      'blocked_by_me', exists (
        select 1 from public.blocks b
        where b.blocker_id = v_uid and b.blocked_id = v_p.id
      )
    ));
  end if;

  return v_result;
end;
$$;

revoke execute on function public.get_public_profile(uuid) from public, anon;
grant execute on function public.get_public_profile(uuid) to authenticated;

-- ── search_people: the search box AND the filter panel ──────────────────────

-- One function serves people search, the filter panel, and study-buddy
-- discovery (p_buddy_only). All filtering is server-side, and every filter
-- applies Rule 2: a hidden field excludes the user from that filter.
--
-- Ranking (spec §5.4/§5.10): people sharing a current course with the
-- viewer first (more shared courses = higher), then people sharing a
-- graduation year, then alphabetically. A target's hidden course list or
-- hidden graduation year contributes NOTHING to ranking — otherwise sort
-- order would leak hidden data.
--
-- p_query matches display names AND email addresses (case-insensitive
-- substring). Emails are matched as a server-side convenience but NEVER
-- returned — the output columns simply don't include email.
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

revoke execute on function public.search_people(text, uuid[], text[], text[], text[], int, int, boolean, int, int) from public, anon;
grant execute on function public.search_people(text, uuid[], text[], text[], text[], int, int, boolean, int, int) to authenticated;

-- ── suggested_people: the dashboard's "people you might know" ───────────────

-- Up to 10 users, and the membership rule is strict (spec §5.4):
--   - shares ≥1 VISIBLE current course with you  → eligible (ranked first)
--   - else shares your VISIBLE graduation year   → eligible (ranked after)
--   - shares neither                             → must never appear.
create or replace function public.suggested_people()
returns table (
  id             uuid,
  display_name   text,
  avatar_url     text,
  college        text,
  major          text,
  shared_courses bigint,
  same_grad_year boolean
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
  scored as (
    select
      p.id, p.display_name, p.avatar_url,
      case when coalesce((p.privacy->>'college')::boolean, false) then null else p.college end as college,
      case when coalesce((p.privacy->>'major')::boolean,   false) then null else p.major   end as major,
      case when coalesce((p.privacy->>'courses_current')::boolean, false) then 0 else (
        select count(*)
        from public.user_courses uc
        where uc.user_id = p.id
          and uc.enrollment_type = 'current'
          and uc.course_id in (select course_id from my_courses)
      ) end as shared_courses,
      case when coalesce((p.privacy->>'graduation')::boolean, false)
                or (select my_grad_hidden from viewer) then false
           else p.graduation_year is not null
                and p.graduation_year = (select graduation_year from viewer)
      end as same_grad_year
    from public.profiles p
    cross join viewer v
    where p.university_id = v.university_id
      and p.id <> v.id
      and p.display_name is not null
      and p.account_status = 'active'
      and not public.are_blocked(v.id, p.id)
  )
  select s.id, s.display_name, s.avatar_url, s.college, s.major, s.shared_courses, s.same_grad_year
  from scored s
  where s.shared_courses > 0 or s.same_grad_year  -- share neither → never appear
  order by s.shared_courses desc, s.same_grad_year desc, s.display_name asc
  limit 10;
$$;

revoke execute on function public.suggested_people() from public, anon;
grant execute on function public.suggested_people() to authenticated;
