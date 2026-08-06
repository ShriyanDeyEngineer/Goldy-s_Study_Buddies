-- ============================================================================
-- 0005 — Meetups, RSVPs, and availability polls.
--
-- WHAT THIS FILE DOES
--   Scheduling inside a group: meetups (a concrete time+place), RSVP
--   attendance, and When2Meet-style availability polls (propose slots,
--   members vote, best slot wins).
--
-- TIMEZONE RULE (the source of the classic bug this schema prevents):
--   scheduled_at is timestamptz — an absolute instant in UTC. The browser
--   converts the student's wall-clock input to UTC BEFORE submitting, and
--   converts back to local time when displaying. The server never
--   interprets wall-clock text, so a student in another timezone over
--   break still sees the correct hour.
--
-- "UPCOMING" vs "PAST" is *derived* — a meetup is upcoming iff
--   scheduled_at > now() at query time. There is deliberately no status
--   column to flip and no background job to flip it (spec §5.8).
-- ============================================================================

create table if not exists public.meetups (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.study_groups (id) on delete cascade,
  creator_id   uuid not null references public.profiles (id),
  title        text not null check (char_length(title) between 1 and 100),
  scheduled_at timestamptz not null,
  format       text not null check (format in ('online','in_person')),
  location     text check (location is null or char_length(location) <= 300),
  meeting_link text check (meeting_link is null or char_length(meeting_link) <= 500),
  is_cancelled boolean not null default false,
  cancellation_reason text,
  created_at   timestamptz not null default now(),

  -- The conditional-fields rule as a hard constraint: online meetups MUST
  -- carry a link, in-person meetups MUST carry a location. The form
  -- validates this too, but the constraint means no code path — not even
  -- a future admin script — can create a meetup nobody can find.
  constraint meetups_format_requirements check (
    (format = 'online'    and meeting_link is not null) or
    (format = 'in_person' and location is not null)
  )
);

comment on table public.meetups is
  'Scheduled study sessions for a group. Upcoming/past is DERIVED from '
  'scheduled_at at query time — never add a status column for it. '
  'Cancelled meetups stay as struck-through history.';

create index if not exists meetups_group_time_idx on public.meetups (group_id, scheduled_at);

create table if not exists public.meetup_attendance (
  meetup_id  uuid not null references public.meetups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  status     text not null check (status in ('attending','maybe','not_attending')),
  updated_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);

comment on table public.meetup_attendance is
  'One RSVP row per (meetup, member) — upserted, so only the latest answer '
  'exists. The attendee count shown in the UI is COUNT(*) WHERE status = '
  '''attending'', computed at read time. Never cache it in a column: a '
  'stored counter and the truth WILL drift apart (spec pitfall #7).';

-- ── Availability polls (our native When2Meet) ───────────────────────────────

create table if not exists public.availability_polls (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.study_groups (id) on delete cascade,
  creator_id uuid not null references public.profiles (id),
  title      text not null check (char_length(title) between 1 and 100),
  status     text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

comment on table public.availability_polls is
  'A "when can everyone meet?" poll. Members mark which proposed slots '
  'work; the group page highlights the slot with the most votes so it can '
  'be turned into a real meetup in one click. Built natively — the spec '
  'forbids embedding When2Meet/Calendly (external accounts would break '
  'the single-sign-in experience).';

create table if not exists public.availability_slots (
  id        uuid primary key default gen_random_uuid(),
  poll_id   uuid not null references public.availability_polls (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  check (ends_at > starts_at)
);

create index if not exists availability_slots_poll_idx on public.availability_slots (poll_id, starts_at);

create table if not exists public.availability_votes (
  slot_id    uuid not null references public.availability_slots (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- A vote row means "this slot works for me". No row = doesn't work /
  -- hasn't answered. One row max per (slot, person).
  primary key (slot_id, user_id)
);

-- ── Row-level security: members only, for all four tables ───────────────────
-- Realtime and PostgREST both respect these policies, so a non-member can
-- never fetch OR subscribe their way into a group's schedule.

alter table public.meetups enable row level security;
alter table public.meetup_attendance enable row level security;
alter table public.availability_polls enable row level security;
alter table public.availability_slots enable row level security;
alter table public.availability_votes enable row level security;

drop policy if exists "members read meetups" on public.meetups;
create policy "members read meetups"
  on public.meetups for select
  to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));

drop policy if exists "members read attendance" on public.meetup_attendance;
create policy "members read attendance"
  on public.meetup_attendance for select
  to authenticated
  using (public.is_group_member(
    (select m.group_id from public.meetups m where m.id = meetup_id),
    (select auth.uid())
  ));

drop policy if exists "members read polls" on public.availability_polls;
create policy "members read polls"
  on public.availability_polls for select
  to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));

drop policy if exists "members read slots" on public.availability_slots;
create policy "members read slots"
  on public.availability_slots for select
  to authenticated
  using (public.is_group_member(
    (select p.group_id from public.availability_polls p where p.id = poll_id),
    (select auth.uid())
  ));

drop policy if exists "members read votes" on public.availability_votes;
create policy "members read votes"
  on public.availability_votes for select
  to authenticated
  using (public.is_group_member(
    (select p.group_id
       from public.availability_slots s
       join public.availability_polls p on p.id = s.poll_id
      where s.id = slot_id),
    (select auth.uid())
  ));

-- No write policies — all writes via the functions below. SELECT is the
-- only privilege clients get (see the grants note in 0001).
grant select on public.meetups, public.meetup_attendance,
                public.availability_polls, public.availability_slots,
                public.availability_votes
  to authenticated;

-- ── create_meetup ───────────────────────────────────────────────────────────

-- Any member may schedule. Validation mirrors the form exactly so a
-- bypassed client changes nothing: future time, and link-or-location
-- matching the format. Creator is auto-RSVP'd "attending" (they planned
-- it; making them click a second button would just be noise — README).
create or replace function public.create_meetup(
  p_group_id     uuid,
  p_title        text,
  p_scheduled_at timestamptz,
  p_format       text,
  p_location     text default null,
  p_meeting_link text default null
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
  if p_format = 'online' and nullif(trim(coalesce(p_meeting_link, '')), '') is null then
    raise exception 'MISSING_LINK';
  end if;
  if p_format = 'in_person' and nullif(trim(coalesce(p_location, '')), '') is null then
    raise exception 'MISSING_LOCATION';
  end if;

  insert into public.meetups (group_id, creator_id, title, scheduled_at, format, location, meeting_link)
  values (
    p_group_id, v_uid, v_title, p_scheduled_at, p_format,
    case when p_format = 'in_person' then trim(p_location) end,
    case when p_format = 'online' then trim(p_meeting_link) end
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

revoke execute on function public.create_meetup(uuid, text, timestamptz, text, text, text) from public, anon;
grant execute on function public.create_meetup(uuid, text, timestamptz, text, text, text) to authenticated;

-- ── cancel_meetup ───────────────────────────────────────────────────────────

-- Only the meetup's creator or the group manager may cancel (spec §5.8).
-- The row is kept and flagged so the card renders struck-through.
create or replace function public.cancel_meetup(p_meetup_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_meetup public.meetups%rowtype;
  v_group  public.study_groups%rowtype;
  r record;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_meetup from public.meetups where id = p_meetup_id;
  if not found then
    raise exception 'MEETUP_NOT_FOUND';
  end if;
  -- Group lock first (canonical lock order), then re-read the meetup.
  select * into v_group from public.study_groups where id = v_meetup.group_id for update;
  select * into v_meetup from public.meetups where id = p_meetup_id for update;

  if v_meetup.creator_id <> v_uid and v_group.manager_id <> v_uid then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_meetup.is_cancelled then
    raise exception 'ALREADY_RESOLVED';
  end if;

  update public.meetups
    set is_cancelled = true,
        cancellation_reason = nullif(trim(coalesce(p_reason, '')), '')
    where id = p_meetup_id;

  for r in
    select m.user_id from public.study_group_members m
    where m.group_id = v_group.id and m.user_id <> v_uid
  loop
    perform public.app_notify(r.user_id, 'meetup_cancelled',
      jsonb_build_object('group_id', v_group.id, 'group_name', v_group.name,
                         'title', v_meetup.title,
                         'reason', nullif(trim(coalesce(p_reason, '')), '')));
  end loop;
end;
$$;

revoke execute on function public.cancel_meetup(uuid, text) from public, anon;
grant execute on function public.cancel_meetup(uuid, text) to authenticated;

-- ── set_meetup_rsvp ─────────────────────────────────────────────────────────

-- Upsert the caller's RSVP. Attending counts are derived from these rows
-- at read time — this function never touches any counter.
create or replace function public.set_meetup_rsvp(p_meetup_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_meetup public.meetups%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_status not in ('attending','maybe','not_attending') then
    raise exception 'INVALID_RSVP';
  end if;
  select * into v_meetup from public.meetups where id = p_meetup_id;
  if not found then
    raise exception 'MEETUP_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.study_group_members m
    where m.group_id = v_meetup.group_id and m.user_id = v_uid
  ) then
    raise exception 'NOT_MEMBER';
  end if;
  if v_meetup.is_cancelled then
    raise exception 'MEETUP_CANCELLED';
  end if;
  -- RSVPing to something that already happened makes no sense.
  if v_meetup.scheduled_at <= now() then
    raise exception 'MEETUP_PAST';
  end if;

  insert into public.meetup_attendance (meetup_id, user_id, status)
  values (p_meetup_id, v_uid, p_status)
  on conflict (meetup_id, user_id)
  do update set status = excluded.status, updated_at = now();
end;
$$;

revoke execute on function public.set_meetup_rsvp(uuid, text) from public, anon;
grant execute on function public.set_meetup_rsvp(uuid, text) to authenticated;

-- ── Availability polls ──────────────────────────────────────────────────────

-- Open a poll with 2–20 candidate slots, passed as a JSON array of
-- {"starts_at": iso, "ends_at": iso}. JSON (rather than N parameters)
-- because the slot count varies.
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
  if p_slots is null or jsonb_typeof(p_slots) <> 'array'
     or jsonb_array_length(p_slots) < 2 or jsonb_array_length(p_slots) > 20 then
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

revoke execute on function public.create_availability_poll(uuid, text, jsonb) from public, anon;
grant execute on function public.create_availability_poll(uuid, text, jsonb) to authenticated;

-- Mark a slot as working / not working for the caller.
-- p_available=true inserts the vote row; false removes it.
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
    insert into public.availability_votes (slot_id, user_id)
    values (p_slot_id, v_uid)
    on conflict do nothing;
  else
    delete from public.availability_votes
      where slot_id = p_slot_id and user_id = v_uid;
  end if;
end;
$$;

revoke execute on function public.vote_availability(uuid, boolean) from public, anon;
grant execute on function public.vote_availability(uuid, boolean) to authenticated;

-- Close a poll (creator or manager) — typically right after converting the
-- winning slot into a real meetup.
create or replace function public.close_availability_poll(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_poll public.availability_polls%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_poll from public.availability_polls where id = p_poll_id for update;
  if not found then
    raise exception 'POLL_NOT_FOUND';
  end if;
  if v_poll.creator_id <> v_uid
     and not public.is_group_manager(v_poll.group_id, v_uid) then
    raise exception 'NOT_ALLOWED';
  end if;
  update public.availability_polls set status = 'closed' where id = p_poll_id;
end;
$$;

revoke execute on function public.close_availability_poll(uuid) from public, anon;
grant execute on function public.close_availability_poll(uuid) to authenticated;
