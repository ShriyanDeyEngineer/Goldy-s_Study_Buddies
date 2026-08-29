-- ============================================================================
-- 0029 — denormalize group_id onto availability_votes.
--
-- Two problems, one root cause, one fix:
--
--   1. RLS cost: "members read votes" (0005) resolved group_id per row via
--      a two-table join subquery (slots → polls → group_id) before it
--      could even call is_group_member() — the most expensive policy in
--      the schema, re-evaluated on every row of every read.
--
--   2. Realtime: polls-section.tsx subscribes to this table with NO
--      filter, because there was no row-level column to filter ON — so a
--      vote in ANY group's poll wakes every viewer who currently has a
--      poll open, triggering a full /groups/[groupId] page refresh
--      (~10 queries) for a change that has nothing to do with them.
--
-- Both are fixed by giving each vote row its own group_id, set once at
-- insert time by vote_availability() (which already resolves it to check
-- membership) rather than derived per-row at read time.
-- ============================================================================

alter table public.availability_votes add column if not exists group_id uuid;

-- Backfill existing rows via the same slot → poll → group chain the old
-- RLS policy used to walk on every read.
update public.availability_votes v
  set group_id = p.group_id
  from public.availability_slots s
  join public.availability_polls p on p.id = s.poll_id
  where v.slot_id = s.id and v.group_id is null;

alter table public.availability_votes alter column group_id set not null;

alter table public.availability_votes drop constraint if exists availability_votes_group_id_fkey;
alter table public.availability_votes add constraint availability_votes_group_id_fkey
  foreign key (group_id) references public.study_groups (id) on delete cascade;

-- Backs both the cheap RLS check below and the realtime filter's own
-- lookup; also generally useful for "all votes in this group" reads.
create index if not exists availability_votes_group_idx
  on public.availability_votes (group_id);

-- ── Cheap RLS: a direct column check, same shape as "members read polls" /
--    "members read meetups" — no more per-row join. ─────────────────────────
drop policy if exists "members read votes" on public.availability_votes;
create policy "members read votes"
  on public.availability_votes for select
  to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));

-- ── vote_availability: set group_id (already resolved for the membership
--    check below — this just also stores it now). ──────────────────────────
create or replace function public.vote_availability(p_slot_id uuid, p_available boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_group uuid;
  v_status text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select p.group_id, p.status into v_group, v_status
  from public.availability_slots s
  join public.availability_polls p on p.id = s.poll_id
  where s.id = p_slot_id;
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

  if p_available then
    insert into public.availability_votes (slot_id, user_id, group_id)
    values (p_slot_id, v_uid, v_group)
    on conflict (slot_id, user_id) do nothing;
  else
    delete from public.availability_votes
      where slot_id = p_slot_id and user_id = v_uid;
  end if;
end;
$$;

revoke execute on function public.vote_availability(uuid, boolean) from public, anon;
grant execute on function public.vote_availability(uuid, boolean) to authenticated;
