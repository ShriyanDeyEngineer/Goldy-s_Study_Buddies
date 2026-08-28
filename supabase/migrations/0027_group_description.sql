-- ============================================================================
-- 0027 — study groups get an optional description, settable at creation
-- and editable later from the manager's settings page.
--
-- Both create_study_group() and update_group_settings() gain a new
-- p_description parameter. Adding a parameter changes a Postgres
-- function's identity (it's keyed on the full argument list), so a plain
-- CREATE OR REPLACE would leave the old signature sitting alongside the
-- new one as a separate overload rather than replacing it — both old
-- signatures are dropped first, on purpose.
--
-- Length only, capped at 2000 (GROUP_DESCRIPTION_MAX) — validated here as
-- the authoritative gate, same as name/capacity/mode above it. Profanity
-- rejection for description follows the SAME pattern already used for
-- group name and course name: a zod .refine() in lib/validation, checked
-- before the request ever reaches this function — see lib/profanity.ts's
-- own header comment ("zod schemas REJECT profane names/titles"). No
-- profanity check is added in SQL here, matching that existing group
-- name/course name precedent exactly.
-- ============================================================================

alter table public.study_groups add column if not exists description text;

alter table public.study_groups drop constraint if exists study_groups_description_check;
alter table public.study_groups add constraint study_groups_description_check
  check (description is null or char_length(description) <= 2000);

comment on column public.study_groups.description is
  'Optional blurb the manager sets at creation or from group settings. '
  'NULL means none was given — stored as NULL, not empty string.';

-- ── create_study_group ───────────────────────────────────────────────────
drop function if exists public.create_study_group(uuid, text, int, text, uuid[]);

create or replace function public.create_study_group(
  p_course_id   uuid,
  p_name        text,
  p_description text,
  p_capacity    int,
  p_mode        text,
  p_invitee_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := public.assert_active_caller();
  v_name     text := trim(coalesce(p_name, ''));
  v_desc     text := nullif(trim(coalesce(p_description, '')), '');
  v_group_id uuid;
  v_invitee  uuid;
  v_invitees uuid[] := (
    -- de-duplicate and drop the creator if someone sneaks them in
    select coalesce(array_agg(distinct x), '{}')
    from unnest(coalesce(p_invitee_ids, '{}')) as x
    where x <> auth.uid()
  );
begin
  if char_length(v_name) not between 1 and 100 then
    raise exception 'INVALID_NAME';
  end if;
  if v_desc is not null and char_length(v_desc) > 2000 then
    raise exception 'INVALID_DESCRIPTION';
  end if;
  if p_capacity is null or p_capacity < 2 or p_capacity > 50 then
    raise exception 'INVALID_CAPACITY';
  end if;
  if p_mode not in ('open','closed') then
    raise exception 'INVALID_MODE';
  end if;
  if not exists (select 1 from public.courses c where c.id = p_course_id and c.is_active) then
    raise exception 'COURSE_NOT_FOUND';
  end if;
  if array_length(v_invitees, 1) > p_capacity - 1 then
    raise exception 'TOO_MANY_INVITES';
  end if;

  -- Every invitee must be a current classmate (spec §5.6). Checked in the
  -- database so a hand-crafted request can't invite arbitrary users.
  foreach v_invitee in array v_invitees loop
    if not exists (
      select 1
      from public.user_courses uc
      join public.profiles p on p.id = uc.user_id
      where uc.user_id = v_invitee
        and uc.course_id = p_course_id
        and uc.enrollment_type = 'current'
        and p.account_status = 'active'
        and p.display_name is not null
    ) then
      raise exception 'INVALID_INVITEE';
    end if;
    if public.are_blocked(v_uid, v_invitee) then
      raise exception 'INVALID_INVITEE';
    end if;
  end loop;

  begin
    insert into public.study_groups
      (course_id, name, description, manager_id, mode, capacity, member_count)
    values (p_course_id, v_name, v_desc, v_uid, p_mode, p_capacity, 1)
    returning id into v_group_id;
  exception when unique_violation then
    raise exception 'NAME_TAKEN';
  end;

  insert into public.study_group_members (group_id, user_id) values (v_group_id, v_uid);

  foreach v_invitee in array v_invitees loop
    insert into public.group_invitations (group_id, invited_user_id, inviter_id)
    values (v_group_id, v_invitee, v_uid);
    perform public.app_notify(v_invitee, 'group_invitation',
      jsonb_build_object('group_id', v_group_id, 'group_name', v_name, 'inviter_id', v_uid));
  end loop;

  return v_group_id;
end;
$$;

revoke execute on function public.create_study_group(uuid, text, text, int, text, uuid[]) from public, anon;
grant execute on function public.create_study_group(uuid, text, text, int, text, uuid[]) to authenticated;

-- ── update_group_settings ────────────────────────────────────────────────
drop function if exists public.update_group_settings(uuid, text, int, text);

create or replace function public.update_group_settings(
  p_group_id    uuid,
  p_name        text,
  p_description text,
  p_capacity    int,
  p_mode        text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_group public.study_groups%rowtype;
  v_name  text := trim(coalesce(p_name, ''));
  v_desc  text := nullif(trim(coalesce(p_description, '')), '');
  v_req   record;
  v_remaining int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_group from public.study_groups where id = p_group_id for update;
  if not found then
    raise exception 'GROUP_NOT_FOUND';
  end if;
  if v_group.manager_id <> v_uid then
    raise exception 'NOT_MANAGER';
  end if;
  if v_group.status <> 'active' then
    raise exception 'GROUP_UNAVAILABLE';
  end if;
  if char_length(v_name) not between 1 and 100 then
    raise exception 'INVALID_NAME';
  end if;
  if v_desc is not null and char_length(v_desc) > 2000 then
    raise exception 'INVALID_DESCRIPTION';
  end if;
  if p_capacity is null or p_capacity < 2 or p_capacity > 50 then
    raise exception 'INVALID_CAPACITY';
  end if;
  if p_capacity < v_group.member_count then
    raise exception 'CAPACITY_BELOW_MEMBER_COUNT';
  end if;
  if p_mode not in ('open','closed') then
    raise exception 'INVALID_MODE';
  end if;

  begin
    update public.study_groups
      set name = v_name, description = v_desc, capacity = p_capacity, mode = p_mode
      where id = p_group_id;
  exception when unique_violation then
    raise exception 'NAME_TAKEN';
  end;

  if v_group.mode = 'closed' and p_mode = 'open' then
    v_remaining := p_capacity - v_group.member_count;

    for v_req in
      select * from public.join_requests
      where group_id = p_group_id and status = 'pending'
      order by created_at asc
      for update
    loop
      if v_remaining > 0 then
        insert into public.study_group_members (group_id, user_id)
        values (p_group_id, v_req.user_id);
        update public.join_requests
          set status = 'approved', resolved_at = now()
          where id = v_req.id;
        perform public.app_notify(v_req.user_id, 'join_request_approved',
          jsonb_build_object('group_id', p_group_id, 'group_name', v_name));
        v_remaining := v_remaining - 1;
      else
        update public.join_requests
          set status = 'cancelled', resolved_at = now()
          where id = v_req.id;
        perform public.app_notify(v_req.user_id, 'request_cancelled_group_full',
          jsonb_build_object('group_id', p_group_id, 'group_name', v_name));
      end if;
    end loop;

    update public.study_groups
      set member_count = p_capacity - greatest(v_remaining, 0),
          last_activity_at = now()
      where id = p_group_id;
  end if;
end;
$$;

revoke execute on function public.update_group_settings(uuid, text, text, int, text) from public, anon;
grant execute on function public.update_group_settings(uuid, text, text, int, text) to authenticated;
