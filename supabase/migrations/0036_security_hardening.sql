-- ============================================================================
-- 0036 — security hardening (five unrelated fixes bundled).
--
-- 1. censor_profanity(): every quantifier in the generated regex is now
--    BOUNDED, and the function runs under a 2 s statement_timeout. The
--    old unbounded pattern ( [class]+ per letter, [^alnum]* between every
--    pair, wrapped in [[:alnum:]_]* ) could be pushed into pathological
--    backtracking by a long run of one character — the same ReDoS that
--    was fixed on the TypeScript side (lib/profanity.ts). Bounds are set
--    far above anything real text produces (letter runs ≤ 32, separators
--    ≤ 24, whole-word extension ≤ 24), so ordinary messages mask exactly
--    as before; only absurd inputs (e.g. "f" + 400×"u" + "ck") can now
--    slip past, and the timeout is the belt-and-braces backstop.
--
-- 2. create_meetup(): an ONLINE meetup's meeting_link must be an http(s)
--    URL. Without this a member could store `javascript:…` as the link,
--    which the group page renders as the clickable "Join online" anchor
--    → stored XSS. (add_group_resource already checks this for link
--    resources — meetups just missed it.)
--
-- 3. create_course() / create_course_request(): the free-text course
--    name now runs through censor_profanity(), same backstop the chat and
--    resource paths already have. The catalog is a shared namespace with
--    no per-entry review.
--
-- 4. profiles UPDATE and user_courses INSERT/DELETE now require the caller
--    to be an ACTIVE account. A suspended/banned user is shown the
--    lockout screen, but the server actions behind it (updateProfile,
--    updatePrivacy, setBuddyAvailability, setCourseEnrollment…) wrote
--    straight to these tables via RLS, which only checked ownership.
--
-- Idempotent.
-- ============================================================================

-- ── 1. censor_profanity: bounded quantifiers + timeout ─────────────────────
create or replace function public.censor_profanity(p_text text)
returns text
language sql
immutable
set search_path = public, pg_temp
set statement_timeout = '2s'
as $fn$
  select regexp_replace(
           regexp_replace(
             coalesce(p_text, ''),
             '[[:alnum:]_]{0,24}([a4@*]{1,32}[^[:alnum:]]{0,24}[s5$]{1,32}[^[:alnum:]]{0,24}[s5$]{1,32}[^[:alnum:]]{0,24}[h]{1,32}[^[:alnum:]]{0,24}[o0*]{1,32}[^[:alnum:]]{0,24}[l1|]{1,32}[^[:alnum:]]{0,24}[e3*]{1,32}|[f]{1,32}[^[:alnum:]]{0,24}[a4@*]{1,32}[^[:alnum:]]{0,24}[g9]{1,32}[^[:alnum:]]{0,24}[g9]{1,32}[^[:alnum:]]{0,24}[o0*]{1,32}[^[:alnum:]]{0,24}[t7+]{1,32}|[n]{1,32}[^[:alnum:]]{0,24}[i1!|*]{1,32}[^[:alnum:]]{0,24}[g9]{1,32}[^[:alnum:]]{0,24}[g9]{1,32}[^[:alnum:]]{0,24}[e3*]{1,32}[^[:alnum:]]{0,24}[r]{1,32}|[r]{1,32}[^[:alnum:]]{0,24}[e3*]{1,32}[^[:alnum:]]{0,24}[t7+]{1,32}[^[:alnum:]]{0,24}[a4@*]{1,32}[^[:alnum:]]{0,24}[r]{1,32}[^[:alnum:]]{0,24}[d]{1,32}|[b8]{1,32}[^[:alnum:]]{0,24}[i1!|*]{1,32}[^[:alnum:]]{0,24}[t7+]{1,32}[^[:alnum:]]{0,24}[c(<{]{1,32}[^[:alnum:]]{0,24}[h]{1,32}|[w]{1,32}[^[:alnum:]]{0,24}[h]{1,32}[^[:alnum:]]{0,24}[o0*]{1,32}[^[:alnum:]]{0,24}[r]{1,32}[^[:alnum:]]{0,24}[e3*]{1,32}|[n]{1,32}[^[:alnum:]]{0,24}[i1!|*]{1,32}[^[:alnum:]]{0,24}[g9]{1,32}[^[:alnum:]]{0,24}[g9]{1,32}[^[:alnum:]]{0,24}[a4@*]{1,32}|[f]{1,32}[^[:alnum:]]{0,24}[uv4*]{1,32}[^[:alnum:]]{0,24}[c(<{]{1,32}[^[:alnum:]]{0,24}[k]{1,32}|[s5$]{1,32}[^[:alnum:]]{0,24}[h]{1,32}[^[:alnum:]]{0,24}[i1!|*]{1,32}[^[:alnum:]]{0,24}[t7+]{1,32}|[c(<{]{1,32}[^[:alnum:]]{0,24}[uv4*]{1,32}[^[:alnum:]]{0,24}[n]{1,32}[^[:alnum:]]{0,24}[t7+]{1,32}|[s5$]{1,32}[^[:alnum:]]{0,24}[l1|]{1,32}[^[:alnum:]]{0,24}[uv4*]{1,32}[^[:alnum:]]{0,24}[t7+]{1,32})[[:alnum:]_]{0,24}',
             '****', 'gi'
           ),
           '\y([b8]{1,32}[^[:alnum:]]{0,24}[a4@*]{1,32}[^[:alnum:]]{0,24}[s5$]{1,32}[^[:alnum:]]{0,24}[t7+]{1,32}[^[:alnum:]]{0,24}[a4@*]{1,32}[^[:alnum:]]{0,24}[r]{1,32}[^[:alnum:]]{0,24}[d]{1,32}|[p]{1,32}[^[:alnum:]]{0,24}[uv4*]{1,32}[^[:alnum:]]{0,24}[s5$]{1,32}[^[:alnum:]]{0,24}[s5$]{1,32}[^[:alnum:]]{0,24}[y]{1,32}|[d]{1,32}[^[:alnum:]]{0,24}[i1!|*]{1,32}[^[:alnum:]]{0,24}[c(<{]{1,32}[^[:alnum:]]{0,24}[k]{1,32}|[c(<{]{1,32}[^[:alnum:]]{0,24}[o0*]{1,32}[^[:alnum:]]{0,24}[c(<{]{1,32}[^[:alnum:]]{0,24}[k]{1,32}|[t7+]{1,32}[^[:alnum:]]{0,24}[i1!|*]{1,32}[^[:alnum:]]{0,24}[t7+]{1,32}[^[:alnum:]]{0,24}[s5$]{1,32}|[a4@*]{1,32}[^[:alnum:]]{0,24}[s5$]{1,32}[^[:alnum:]]{0,24}[s5$]{1,32})\y',
           '****', 'gi'
         );
$fn$;

-- ── 2. create_meetup: online meeting_link must be an http(s) URL ───────────
-- Signature unchanged from 0011; body identical except the online-format
-- branch now also rejects a non-web scheme (INVALID_LINK).
create or replace function public.create_meetup(
  p_group_id         uuid,
  p_title            text,
  p_scheduled_at     timestamptz,
  p_format           text,
  p_location         text default null,
  p_meeting_link     text default null,
  p_duration_minutes int  default 60
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := public.assert_active_caller();
  v_group  public.study_groups%rowtype;
  v_title  text := trim(coalesce(p_title, ''));
  v_id     uuid;
  r record;
begin
  select * into v_group from public.study_groups where id = p_group_id for update;
  if not found or v_group.status <> 'active' then
    raise exception 'GROUP_UNAVAILABLE';
  end if;
  if not exists (
    select 1 from public.study_group_members m
    where m.group_id = p_group_id and m.user_id = v_uid
  ) then
    raise exception 'NOT_MEMBER';
  end if;

  if char_length(v_title) not between 1 and 100 then
    raise exception 'INVALID_TITLE';
  end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then
    raise exception 'MEETUP_IN_PAST';
  end if;
  if p_format not in ('online','in_person') then
    raise exception 'INVALID_FORMAT';
  end if;
  if p_format = 'online' then
    if nullif(trim(coalesce(p_meeting_link, '')), '') is null then
      raise exception 'MISSING_LINK';
    end if;
    -- Web schemes only: the link is rendered as a clickable anchor, so a
    -- `javascript:` (or `data:` …) URI here would be stored XSS.
    if trim(p_meeting_link) !~* '^https?://' then
      raise exception 'INVALID_LINK';
    end if;
  end if;
  if p_format = 'in_person' and nullif(trim(coalesce(p_location, '')), '') is null then
    raise exception 'MISSING_LOCATION';
  end if;
  if p_duration_minutes is null or p_duration_minutes < 15 or p_duration_minutes > 480 then
    raise exception 'INVALID_DURATION';
  end if;

  insert into public.meetups
    (group_id, creator_id, title, scheduled_at, format, location, meeting_link, duration_minutes)
  values (
    p_group_id, v_uid, v_title, p_scheduled_at, p_format,
    case when p_format = 'in_person' then trim(p_location) end,
    case when p_format = 'online' then trim(p_meeting_link) end,
    p_duration_minutes
  )
  returning id into v_id;

  insert into public.meetup_attendance (meetup_id, user_id, status)
  values (v_id, v_uid, 'attending');

  update public.study_groups set last_activity_at = now() where id = p_group_id;

  for r in
    select m.user_id from public.study_group_members m
    where m.group_id = p_group_id and m.user_id <> v_uid
  loop
    perform public.app_notify(r.user_id, 'meetup_created',
      jsonb_build_object('group_id', p_group_id, 'group_name', v_group.name,
                         'meetup_id', v_id, 'title', v_title));
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.create_meetup(uuid, text, timestamptz, text, text, text, int) from public, anon;
grant execute on function public.create_meetup(uuid, text, timestamptz, text, text, text, int) to authenticated;

-- ── 3. course names run through the profanity filter ──────────────────────
-- create_course(): signature + body from 0002, plus one censor step.
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
  v_uid        uuid := public.assert_active_caller();
  v_university uuid;
  v_dept       text := upper(trim(coalesce(p_department_code, '')));
  v_num        text := upper(trim(coalesce(p_course_number, '')));
  v_name       text := trim(coalesce(p_course_name, ''));
  v_existing   uuid;
  v_new        uuid;
begin
  select p.university_id into v_university from public.profiles p where p.id = v_uid;
  if v_university is null then
    raise exception 'NOT_ONBOARDED';
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
  -- Shared, unreviewed catalog namespace — same masking backstop as chat.
  v_name := public.censor_profanity(v_name);

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

-- create_course_request(): signature + body from 0025, plus one censor step.
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
  if char_length(v_name) > 200 then
    raise exception 'COURSE_NAME_TOO_LONG';
  end if;
  -- Empty is still a valid "I don't know it" answer; censor only if given.
  if v_name <> '' then
    v_name := public.censor_profanity(v_name);
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

-- ── 4. writes require an ACTIVE account ───────────────────────────────────

-- "Is the caller a real, active account?" — definer so it works even
-- though a user can only SELECT their own profile row. Mirrors is_admin().
create or replace function public.caller_is_active()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(
    (select p.account_status = 'active' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke execute on function public.caller_is_active() from public, anon;
grant execute on function public.caller_is_active() to authenticated;

-- profiles: you may still only edit your own row, AND only while active.
-- (During onboarding account_status is already 'active', so the wizard is
-- unaffected; delete_account() is SECURITY DEFINER and bypasses this.)
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) and account_status = 'active')
  with check (id = (select auth.uid()) and account_status = 'active');

-- user_courses: same — own rows only, and only while active.
drop policy if exists "users add own enrollments" on public.user_courses;
create policy "users add own enrollments"
  on public.user_courses for insert
  to authenticated
  with check (user_id = (select auth.uid()) and public.caller_is_active());

drop policy if exists "users remove own enrollments" on public.user_courses;
create policy "users remove own enrollments"
  on public.user_courses for delete
  to authenticated
  using (user_id = (select auth.uid()) and public.caller_is_active());
