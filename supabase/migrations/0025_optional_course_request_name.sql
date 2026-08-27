-- ============================================================================
-- 0025 — course requests: the course name is optional when a STUDENT
-- files one; still required when an ADMIN approves.
--
-- Filing a request is often exactly BECAUSE the student doesn't know the
-- official course name — that's what admin review (0020) is for: the
-- admin fills in or corrects the name before it becomes a real catalog
-- entry. create_course_request() required a non-empty name from the
-- start, silently rejecting every submission that left it blank even
-- though the client form (add-course-dialog.tsx) already treats the
-- field as optional. approve_course_request() is UNCHANGED and
-- deliberately still rejects an empty name — by the time a request is
-- approved it needs a real one, since that value becomes the permanent
-- public.courses.course_name.
--
-- course_requests.course_name stays `not null` — an omitted name is
-- stored as '' (empty string, via the existing coalesce), not NULL, so
-- no column/type change is needed anywhere that already reads this row.
-- ============================================================================

create or replace function public.create_course_request(
  p_department_code text,
  p_course_number   text,
  p_course_name     text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := public.assert_active_caller();
  v_uni   uuid;
  v_dept  text := upper(trim(coalesce(p_department_code, '')));
  v_num   text := upper(trim(coalesce(p_course_number, '')));
  v_name  text := trim(coalesce(p_course_name, ''));
  v_id    uuid;
begin
  select university_id into v_uni from public.profiles where id = v_uid;
  if v_dept !~ '^[A-Z]{2,8}$' then
    raise exception 'INVALID_DEPARTMENT';
  end if;
  if v_num !~ '^[0-9]{1,4}[A-Z]{0,3}$' then
    raise exception 'INVALID_COURSE_NUMBER';
  end if;
  -- Only an upper bound now — empty is a valid "I don't know it" answer.
  -- Distinct code from approve_course_request's INVALID_COURSE_NAME
  -- (which still enforces a 1-char floor) so the two don't share a
  -- friendly-error message that would wrongly imply a name is required
  -- here too.
  if char_length(v_name) > 200 then
    raise exception 'COURSE_NAME_TOO_LONG';
  end if;
  if exists (
    select 1 from public.courses c
    where c.university_id = v_uni
      and c.department_code = v_dept and c.course_number = v_num
  ) then
    raise exception 'COURSE_EXISTS';
  end if;
  if exists (
    select 1 from public.course_requests r
    where r.requester_id = v_uid and r.status = 'pending'
      and r.department_code = v_dept and r.course_number = v_num
  ) then
    raise exception 'DUPLICATE_REQUEST';
  end if;

  insert into public.course_requests
    (university_id, requester_id, department_code, course_number, course_name)
  values (v_uni, v_uid, v_dept, v_num, v_name)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.create_course_request(text, text, text) from public, anon;
grant execute on function public.create_course_request(text, text, text) to authenticated;
