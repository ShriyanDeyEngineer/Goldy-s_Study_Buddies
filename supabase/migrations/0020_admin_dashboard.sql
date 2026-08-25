-- ============================================================================
-- 0020 — the admin role becomes real: observation access + course requests.
--
-- WHO IS ADMIN: profiles.is_admin, still settable ONLY by hand in SQL —
-- deliberately no in-app path, and no emails hardcoded here (public repo).
--
-- WHAT ADMINS GET (read-only observation):
--   - SELECT on every group's content (members, chat, meetups, RSVPs,
--     polls, resources) WITHOUT being a member. Pure extra SELECT
--     policies — the write paths still require membership, so an
--     observing admin cannot chat, RSVP, or add resources, and never
--     appears in any member list. Admins acting as normal students
--     (joining groups, planning meetups) are unaffected.
--   - SELECT on message_originals (the uncensored log) through the API.
--   - SELECT on all profiles rows (names for reports/messages, including
--     suspended accounts that public_profiles hides).
--   - Reports were already admin-readable/updatable (0007).
--
-- COURSE REQUESTS move from email into the database: students file a
-- request, admins review it in the dashboard, edit it if needed, and
-- approve (creating the course) or decline — the requester is notified
-- in-app either way.
-- ============================================================================

-- ── Observation: admins may read all group content ──────────────────────────
create policy "admins read all members"
  on public.study_group_members for select to authenticated
  using (public.is_admin());
create policy "admins read all group messages"
  on public.group_messages for select to authenticated
  using (public.is_admin());
create policy "admins read all meetups"
  on public.meetups for select to authenticated
  using (public.is_admin());
create policy "admins read all attendance"
  on public.meetup_attendance for select to authenticated
  using (public.is_admin());
create policy "admins read all polls"
  on public.availability_polls for select to authenticated
  using (public.is_admin());
create policy "admins read all slots"
  on public.availability_slots for select to authenticated
  using (public.is_admin());
create policy "admins read all votes"
  on public.availability_votes for select to authenticated
  using (public.is_admin());
create policy "admins read all resources"
  on public.group_resources for select to authenticated
  using (public.is_admin());
create policy "admins read all join requests"
  on public.join_requests for select to authenticated
  using (public.is_admin());
create policy "admins read all invitations"
  on public.group_invitations for select to authenticated
  using (public.is_admin());

-- The uncensored log, until now dashboard-only. RLS keeps it admin-only;
-- for everyone else the grant yields zero rows, never data.
grant select on public.message_originals to authenticated;
create policy "admins read message originals"
  on public.message_originals for select to authenticated
  using (public.is_admin());

-- Names for the dashboard (reports, originals), including accounts that
-- public_profiles hides (suspended/banned).
create policy "admins read all profiles"
  on public.profiles for select to authenticated
  using (public.is_admin());

-- ── Course requests ─────────────────────────────────────────────────────────
create table public.course_requests (
  id              uuid primary key default gen_random_uuid(),
  university_id   uuid not null references public.universities (id),
  requester_id    uuid not null references public.profiles (id) on delete cascade,
  department_code text not null,
  course_number   text not null,
  course_name     text not null,
  status          text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  -- Set on approval: the catalog entry this request became.
  course_id       uuid references public.courses (id) on delete set null,
  resolved_by     uuid references public.profiles (id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index course_requests_pending_idx
  on public.course_requests (created_at) where status = 'pending';

alter table public.course_requests enable row level security;

create policy "requesters read own course requests"
  on public.course_requests for select to authenticated
  using (requester_id = auth.uid());
create policy "admins read all course requests"
  on public.course_requests for select to authenticated
  using (public.is_admin());

grant select on public.course_requests to authenticated;

-- Student files a request. Same shape rules as create_course; a course
-- already in the catalog is refused with COURSE_EXISTS so the dialog can
-- point at the search instead.
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
  if char_length(v_name) not between 1 and 200 then
    raise exception 'INVALID_COURSE_NAME';
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

-- Admin approves — with the FINAL values, which may differ from what the
-- student typed (admins fix typos and official names before approving).
create or replace function public.approve_course_request(
  p_request_id      uuid,
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
  v_uid  uuid := auth.uid();
  v_req  public.course_requests%rowtype;
  v_dept text := upper(trim(coalesce(p_department_code, '')));
  v_num  text := upper(trim(coalesce(p_course_number, '')));
  v_name text := trim(coalesce(p_course_name, ''));
  v_course uuid;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;
  select * into v_req from public.course_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'ALREADY_RESOLVED';
  end if;
  if v_dept !~ '^[A-Z]{2,8}$' then
    raise exception 'INVALID_DEPARTMENT';
  end if;
  if v_num !~ '^[0-9]{1,4}[A-Z]{0,3}$' then
    raise exception 'INVALID_COURSE_NUMBER';
  end if;
  if char_length(v_name) not between 1 and 200 then
    raise exception 'INVALID_COURSE_NAME';
  end if;

  -- Find-or-create, same rule as create_course.
  select c.id into v_course from public.courses c
  where c.university_id = v_req.university_id
    and c.department_code = v_dept and c.course_number = v_num;
  if v_course is null then
    insert into public.courses
      (university_id, department_code, course_number, course_name, created_by)
    values (v_req.university_id, v_dept, v_num, v_name, v_req.requester_id)
    returning id into v_course;
  end if;

  update public.course_requests
    set status = 'approved', course_id = v_course,
        resolved_by = v_uid, resolved_at = now()
    where id = p_request_id;

  perform public.app_notify(v_req.requester_id, 'course_request_approved',
    jsonb_build_object('course_id', v_course,
                       'department_code', v_dept, 'course_number', v_num));
  return v_course;
end;
$$;

revoke execute on function public.approve_course_request(uuid, text, text, text) from public, anon;
grant execute on function public.approve_course_request(uuid, text, text, text) to authenticated;

create or replace function public.decline_course_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.course_requests%rowtype;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;
  select * into v_req from public.course_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'ALREADY_RESOLVED';
  end if;
  update public.course_requests
    set status = 'declined', resolved_by = v_uid, resolved_at = now()
    where id = p_request_id;
  perform public.app_notify(v_req.requester_id, 'course_request_declined',
    jsonb_build_object('department_code', v_req.department_code,
                       'course_number', v_req.course_number));
end;
$$;

revoke execute on function public.decline_course_request(uuid) from public, anon;
grant execute on function public.decline_course_request(uuid) to authenticated;
