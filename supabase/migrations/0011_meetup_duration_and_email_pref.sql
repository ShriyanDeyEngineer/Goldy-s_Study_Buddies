-- ============================================================================
-- 0011 — Meetup duration + email notification preference.
--
-- WHAT THIS FILE DOES
--   Adds how LONG a meetup runs. Until now a meetup was just a start
--   instant; the "Add to Google Calendar" link guessed one hour, and the
--   team asked for real control (bug report #2): 15 minutes to 8 hours.
--
--   Stored as whole MINUTES (an int) rather than an end timestamp so the
--   invariant "end is after start" cannot be violated by a clock edit —
--   there is only one instant to get right, and duration is always
--   positive by CHECK.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE.
-- ============================================================================

alter table public.meetups
  add column if not exists duration_minutes int not null default 60;

-- The product's allowed range. Every layer (slider, zod, this CHECK)
-- agrees on 15–480; the CHECK is the one nobody can bypass.
alter table public.meetups
  drop constraint if exists meetups_duration_range;
alter table public.meetups
  add constraint meetups_duration_range
  check (duration_minutes between 15 and 480);

comment on column public.meetups.duration_minutes is
  'How long the session runs, in whole minutes. 15–480 (8 h). Drives the '
  'end time shown in the UI and the calendar link. Default 60 for rows '
  'created before this column existed.';

-- ── create_meetup: now takes a duration ─────────────────────────────────────
-- Same function as 0005 with one new (defaulted) parameter, so existing
-- callers keep working. Postgres treats a changed signature as a NEW
-- function, so we drop the old one first to avoid two overloads.
drop function if exists public.create_meetup(uuid, text, timestamptz, text, text, text);

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
  if p_format = 'online' and nullif(trim(coalesce(p_meeting_link, '')), '') is null then
    raise exception 'MISSING_LINK';
  end if;
  if p_format = 'in_person' and nullif(trim(coalesce(p_location, '')), '') is null then
    raise exception 'MISSING_LOCATION';
  end if;
  -- The un-bypassable half of the 15 min – 8 h rule.
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

-- ── Email notification preference (bug report #9) ────────────────────────────
-- Students can turn off notification emails; the webhook route checks
-- this before sending. Defaults ON so nobody misses a group invite, and
-- the switch on the profile settings page makes opting out one click.
alter table public.profiles
  add column if not exists email_notifications boolean not null default true;

comment on column public.profiles.email_notifications is
  'When false, the notification-email webhook skips this student. In-app '
  'notifications are unaffected. Set from Edit profile → Notifications.';

-- The user may flip their own switch (column-level, like the other
-- self-editable profile columns in 0001).
grant update (email_notifications) on public.profiles to authenticated;
