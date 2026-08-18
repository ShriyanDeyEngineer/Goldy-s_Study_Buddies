-- ============================================================================
-- 0012 — Availability grid: bigger polls + batch voting.
--
-- WHAT THIS FILE DOES
--   Supports the When2Meet-style grid UI. Two changes, no new tables:
--
--   1. RAISE THE SLOT CAP. A poll used to hold at most 20 hand-typed slots.
--      A grid is "every 30 minutes across a date range" — one week from
--      8 AM to 10 PM is 7 × 28 = 196 slots. The cap becomes 400 (about
--      two weeks of 30-minute cells), still small enough that a page load
--      is cheap.
--
--   2. BATCH VOTING. Dragging across the grid touches many cells in one
--      gesture. Calling vote_availability() once per cell would mean 30+
--      round-trips per drag; instead set_availability_votes() takes the
--      caller's COMPLETE list of available slots for a poll and makes the
--      database match it in one transaction (delete what's gone, insert
--      what's new). Idempotent — sending the same list twice is a no-op —
--      so a flaky network can safely retry.
--
-- The one-slot vote_availability() from 0005 keeps working for anything
-- that still uses it.
-- ============================================================================

-- ── 1. Slot cap ─────────────────────────────────────────────────────────────

create or replace function public.create_availability_poll(
  p_group_id uuid,
  p_title    text,
  p_slots    jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := public.assert_active_caller();
  v_title  text := trim(coalesce(p_title, ''));
  v_poll   uuid;
  v_slot   jsonb;
  v_starts timestamptz;
  v_ends   timestamptz;
begin
  if not exists (
    select 1 from public.study_group_members m
    where m.group_id = p_group_id and m.user_id = v_uid
  ) then
    raise exception 'NOT_MEMBER';
  end if;
  if not exists (
    select 1 from public.study_groups g
    where g.id = p_group_id and g.status = 'active'
  ) then
    raise exception 'GROUP_UNAVAILABLE';
  end if;
  if char_length(v_title) not between 1 and 100 then
    raise exception 'INVALID_TITLE';
  end if;
  -- 2..400 (was 2..20). Mirrors POLL_SLOTS_MAX in lib/constants.ts.
  if p_slots is null or jsonb_typeof(p_slots) <> 'array'
     or jsonb_array_length(p_slots) < 2 or jsonb_array_length(p_slots) > 400 then
    raise exception 'INVALID_SLOTS';
  end if;

  insert into public.availability_polls (group_id, creator_id, title)
  values (p_group_id, v_uid, v_title)
  returning id into v_poll;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    begin
      v_starts := (v_slot->>'starts_at')::timestamptz;
      v_ends   := (v_slot->>'ends_at')::timestamptz;
    exception when others then
      raise exception 'INVALID_SLOTS';
    end;
    if v_starts is null or v_ends is null or v_ends <= v_starts or v_starts <= now() then
      raise exception 'INVALID_SLOTS';
    end if;
    insert into public.availability_slots (poll_id, starts_at, ends_at)
    values (v_poll, v_starts, v_ends);
  end loop;

  return v_poll;
end;
$$;

-- ── 2. Batch voting ─────────────────────────────────────────────────────────

-- Make the caller's votes on one poll equal exactly p_slot_ids.
-- Slot ids that don't belong to this poll are ignored (never an error —
-- a stale client can't be tricked into voting on another poll's slots).
create or replace function public.set_availability_votes(
  p_poll_id  uuid,
  p_slot_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_group  uuid;
  v_status text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select p.group_id, p.status into v_group, v_status
  from public.availability_polls p where p.id = p_poll_id;
  if v_group is null then
    raise exception 'POLL_NOT_FOUND';
  end if;
  if v_status <> 'open' then
    raise exception 'POLL_CLOSED';
  end if;
  if not exists (
    select 1 from public.study_group_members m
    where m.group_id = v_group and m.user_id = v_uid
  ) then
    raise exception 'NOT_MEMBER';
  end if;

  -- Remove votes on this poll's slots that are no longer in the list…
  delete from public.availability_votes v
  using public.availability_slots s
  where v.slot_id = s.id
    and s.poll_id = p_poll_id
    and v.user_id = v_uid
    and not (v.slot_id = any (coalesce(p_slot_ids, '{}')));

  -- …and add the ones that are (only slots that really belong to this poll).
  insert into public.availability_votes (slot_id, user_id)
  select s.id, v_uid
  from public.availability_slots s
  where s.poll_id = p_poll_id
    and s.id = any (coalesce(p_slot_ids, '{}'))
  on conflict do nothing;
end;
$$;

revoke execute on function public.set_availability_votes(uuid, uuid[]) from public, anon;
grant execute on function public.set_availability_votes(uuid, uuid[]) to authenticated;
