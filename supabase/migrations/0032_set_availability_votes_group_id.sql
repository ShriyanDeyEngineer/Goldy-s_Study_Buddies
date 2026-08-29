-- ============================================================================
-- 0032 — set_availability_votes() must populate availability_votes.group_id.
--
-- 0029 added availability_votes.group_id as NOT NULL and taught the
-- single-cell voter vote_availability() to set it — but missed its batch
-- twin set_availability_votes() (0012), the RPC the When2Meet grid actually
-- commits through (components/groups/availability-grid.tsx →
-- setAvailabilityVotesAction). Since 0029 every drag on the grid inserts a
-- row with a null group_id, fails the NOT NULL check, and the user sees the
-- generic "Something went wrong on our end."
--
-- This is 0012's function verbatim except the INSERT now also writes
-- group_id — which is already resolved as v_group for the membership check
-- just above it, so no extra lookup. Nothing else changed.
--
-- (0023–0031 reached the live database out of band via the SQL editor;
-- check_drift.sql confirmed every other object from that batch is already
-- in its correct state, so this migration is the only outstanding repair.)
-- ============================================================================

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

  -- …and add the ones that are (only slots that really belong to this
  -- poll). group_id is the poll's group, resolved above — this is the line
  -- 0029 should have changed and didn't.
  insert into public.availability_votes (slot_id, user_id, group_id)
  select s.id, v_uid, v_group
  from public.availability_slots s
  where s.poll_id = p_poll_id
    and s.id = any (coalesce(p_slot_ids, '{}'))
  on conflict do nothing;
end;
$$;

revoke execute on function public.set_availability_votes(uuid, uuid[]) from public, anon;
grant execute on function public.set_availability_votes(uuid, uuid[]) to authenticated;
