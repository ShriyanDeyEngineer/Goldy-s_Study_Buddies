-- ============================================================================
-- 0006 — Messaging: group chat and direct messages.
--
-- WHAT THIS FILE DOES
--   Two message tables (group + direct), the functions that write to them,
--   and their realtime wiring.
--
-- HOW REALTIME DELIVERY STAYS PRIVATE:
--   Supabase Realtime ("postgres_changes") checks each subscriber against
--   this table's ROW-LEVEL SECURITY before delivering an event. So the
--   SELECT policies below don't just guard fetches — they are also what
--   stops a non-member's websocket from receiving a group's chat. Never
--   rely on client-side filtering for this.
--
-- THE 2,000-CHARACTER LIMIT (spec invariant #8) exists in three layers:
--   form counter (UX) → zod schema (server action) → CHECK constraint +
--   function validation here (the layer that cannot be bypassed).
-- ============================================================================

create table if not exists public.group_messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.study_groups (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

comment on table public.group_messages is
  'Group chat. Full history is kept and served in chronological order; a '
  'member who was offline simply reads everything on their next visit (no '
  'separate offline queue). Insert via send_group_message() only.';

-- Chat loads "messages for group X ordered by time" — this is that query's index.
create index if not exists group_messages_group_time_idx
  on public.group_messages (group_id, created_at);

create table if not exists public.direct_messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  content      text not null check (char_length(content) between 1 and 2000),
  is_read      boolean not null default false,
  created_at   timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

comment on table public.direct_messages is
  '1-to-1 messages. is_read drives the per-conversation unread badge and '
  'flips when the recipient opens the thread (mark_thread_read). Insert '
  'via send_direct_message() only — it is where the block check lives.';

-- A conversation is "all messages between A and B regardless of direction".
-- Indexing on (least, greatest) gives both directions one shared key, so
-- loading a thread is a single index scan.
create index if not exists direct_messages_thread_idx
  on public.direct_messages ((least(sender_id, recipient_id)), (greatest(sender_id, recipient_id)), created_at);

-- Unread counting: "my unread messages, by sender" — partial index keeps it
-- tiny (read messages fall out of the index entirely).
create index if not exists direct_messages_unread_idx
  on public.direct_messages (recipient_id, sender_id)
  where not is_read;

-- ── Row-level security ──────────────────────────────────────────────────────

alter table public.group_messages enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "members read group messages" on public.group_messages;
create policy "members read group messages"
  on public.group_messages for select
  to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));

drop policy if exists "participants read direct messages" on public.direct_messages;
create policy "participants read direct messages"
  on public.direct_messages for select
  to authenticated
  using (
    sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
  );

-- No write policies: sending goes through the functions below, and
-- mark_thread_read is the only path that flips is_read. SELECT is the
-- only privilege clients get (see the grants note in 0001).
grant select on public.group_messages, public.direct_messages to authenticated;

-- ── Realtime wiring ─────────────────────────────────────────────────────────
-- Chat panels subscribe to INSERTs on group_messages (filtered by group)
-- and on direct_messages (filtered by recipient). RLS above decides who
-- may actually receive each event.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_messages'
  ) then
    alter publication supabase_realtime add table public.group_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end $$;

-- ── send_group_message ──────────────────────────────────────────────────────

-- Validates membership + length, inserts, bumps the group's last-activity
-- timestamp. Returns the new row's id and timestamp so the sender's UI can
-- render the message immediately (and de-duplicate when the same message
-- arrives back over realtime).
create or replace function public.send_group_message(p_group_id uuid, p_content text)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.assert_active_caller();
  v_content text := coalesce(p_content, '');
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
  -- Whitespace-only messages are "empty" even though char_length > 0.
  if char_length(trim(v_content)) < 1 then
    raise exception 'EMPTY_MESSAGE';
  end if;
  -- The un-bypassable half of the 2,000-char rule. 2,001 must fail here
  -- even if every client-side check was stripped away.
  if char_length(v_content) > 2000 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;

  -- NOTE the table-qualified "study_groups.id": this function's RETURNS
  -- TABLE declares an output variable also named "id", and plpgsql treats
  -- an unqualified "id" inside queries as ambiguous. Qualify or it breaks.
  update public.study_groups
    set last_activity_at = now()
    where study_groups.id = p_group_id;

  return query
  insert into public.group_messages (group_id, sender_id, content)
  values (p_group_id, v_uid, v_content)
  returning group_messages.id, group_messages.created_at;
end;
$$;

revoke execute on function public.send_group_message(uuid, text) from public, anon;
grant execute on function public.send_group_message(uuid, text) to authenticated;

-- ── send_direct_message ─────────────────────────────────────────────────────

-- Same shape as group send, plus the people rules: no messaging yourself,
-- no messaging someone who blocked you or whom you blocked (part of spec
-- invariant #9 — block completeness).
create or replace function public.send_direct_message(p_recipient uuid, p_content text)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.assert_active_caller();
  v_content text := coalesce(p_content, '');
begin
  if p_recipient = v_uid then
    raise exception 'SELF_ACTION';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_recipient and p.account_status = 'active' and p.display_name is not null
  ) then
    raise exception 'USER_NOT_FOUND';
  end if;
  if public.are_blocked(v_uid, p_recipient) then
    -- Deliberately the same error whichever direction the block runs —
    -- revealing "they blocked you" invites confrontation.
    raise exception 'BLOCKED';
  end if;
  if char_length(trim(v_content)) < 1 then
    raise exception 'EMPTY_MESSAGE';
  end if;
  if char_length(v_content) > 2000 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;

  return query
  insert into public.direct_messages (sender_id, recipient_id, content)
  values (v_uid, p_recipient, v_content)
  returning direct_messages.id, direct_messages.created_at;
end;
$$;

revoke execute on function public.send_direct_message(uuid, text) from public, anon;
grant execute on function public.send_direct_message(uuid, text) to authenticated;

-- ── mark_thread_read ────────────────────────────────────────────────────────

-- Opening a conversation clears its unread badge: every message FROM that
-- person TO me becomes read. (Only the recipient can mark reads — you
-- cannot mark your own sent messages as read-by-them.)
create or replace function public.mark_thread_read(p_other uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  update public.direct_messages
    set is_read = true
    where recipient_id = v_uid and sender_id = p_other and not is_read;
end;
$$;

revoke execute on function public.mark_thread_read(uuid) from public, anon;
grant execute on function public.mark_thread_read(uuid) to authenticated;

-- ── get_conversations ───────────────────────────────────────────────────────

-- The conversation list: one row per person I've exchanged messages with —
-- their identity, the latest message (for the preview line), and my unread
-- count from them. Sorted newest-conversation-first.
create or replace function public.get_conversations()
returns table (
  other_id           uuid,
  display_name       text,
  avatar_url         text,
  last_message       text,
  last_message_at    timestamptz,
  last_message_mine  boolean,
  unread_count       bigint
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with mine as (
    select
      dm.*,
      case when dm.sender_id = auth.uid() then dm.recipient_id else dm.sender_id end as partner
    from public.direct_messages dm
    where dm.sender_id = auth.uid() or dm.recipient_id = auth.uid()
  ),
  latest as (
    select distinct on (partner)
      partner, content, created_at, (sender_id = auth.uid()) as is_mine
    from mine
    order by partner, created_at desc
  ),
  unread as (
    select sender_id as partner, count(*) as n
    from public.direct_messages
    where recipient_id = auth.uid() and not is_read
    group by sender_id
  )
  select
    l.partner,
    p.display_name,
    p.avatar_url,
    l.content,
    l.created_at,
    l.is_mine,
    coalesce(u.n, 0)
  from latest l
  join public.profiles p on p.id = l.partner
  left join unread u on u.partner = l.partner
  order by l.created_at desc;
$$;

revoke execute on function public.get_conversations() from public, anon;
grant execute on function public.get_conversations() to authenticated;
