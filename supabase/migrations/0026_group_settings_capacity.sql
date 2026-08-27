-- ============================================================================
-- 0026 — the manager's settings form can now change the group's size limit.
--
-- update_group_settings(uuid, text, text) gains a fourth parameter,
-- p_capacity. Postgres identifies a function by its FULL parameter list,
-- so adding a parameter with plain CREATE OR REPLACE would create a
-- second, separate overload sitting alongside the old 3-arg one rather
-- than replacing it — the old version dropped first, on purpose.
--
-- Validation mirrors create_study_group's capacity rule (0004): 2–50,
-- raising INVALID_CAPACITY. One rule that's new here: the table already
-- has `check (member_count <= capacity)` (0004), so shrinking below the
-- current roster would fail as a raw constraint violation with no
-- friendly text — CAPACITY_BELOW_MEMBER_COUNT catches that first and
-- gives it a real message (lib/errors.ts).
--
-- Deliberately NOT doing here: auto-approving queued join requests when
-- capacity goes UP on a still-closed group. That auto-approve behavior
-- exists today only for the closed→open transition (below, unchanged) —
-- extending it to "raised the cap while staying closed" is a separate
-- product decision, not implied by "let the manager resize the group".
-- ============================================================================

drop function if exists public.update_group_settings(uuid, text, text);

create or replace function public.update_group_settings(
  p_group_id uuid,
  p_name     text,
  p_capacity int,
  p_mode     text
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
      set name = v_name, capacity = p_capacity, mode = p_mode
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

revoke execute on function public.update_group_settings(uuid, text, int, text) from public, anon;
grant execute on function public.update_group_settings(uuid, text, int, text) to authenticated;
