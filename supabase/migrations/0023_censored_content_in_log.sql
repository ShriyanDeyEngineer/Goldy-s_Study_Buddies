-- ============================================================================
-- 0023 — the flagged-message log stores BOTH versions of a message.
--
-- message_originals (0017) kept only the pre-censorship text; the masked
-- version lived solely in group_messages / direct_messages.content. That
-- meant the admin log couldn't show what everyone actually saw next to
-- what the sender actually typed — and once a message's group was purged
-- (0022 cascades), the masked version was lost entirely.
--
-- Now every logged row carries its own censored_content, written at send
-- time in the same insert. Nothing about WHEN a row is logged changes: a
-- row exists for every message the filter altered — plain "shit" and
-- spaced-out dodges alike. (Messages the filter misses entirely can't be
-- logged: the database has no way to know they were profane.)
--
-- Idempotent.
-- ============================================================================

alter table public.message_originals
  add column if not exists censored_content text;

comment on column public.message_originals.censored_content is
  'The masked text as it was actually stored and shown to users, captured '
  'at send time. Survives the message itself (0022 purges can delete the '
  'message row; this log is the moderation record).';

-- Backfill existing rows: prefer the REAL stored message (exact bytes
-- users saw)…
update public.message_originals mo
  set censored_content = gm.content
  from public.group_messages gm
  where mo.message_kind = 'group'
    and mo.message_id = gm.id
    and mo.censored_content is null;

update public.message_originals mo
  set censored_content = dm.content
  from public.direct_messages dm
  where mo.message_kind = 'direct'
    and mo.message_id = dm.id
    and mo.censored_content is null;

-- …and reconstruct with the current filter for rows whose message has
-- since been deleted (best-effort — the filter may have changed since).
update public.message_originals
  set censored_content = public.censor_profanity(original_content)
  where censored_content is null;

alter table public.message_originals
  alter column censored_content set not null;

-- ── send_group_message: log both versions ───────────────────────────────────
-- Identical to 0017's except the message_originals insert gains
-- censored_content.
create or replace function public.send_group_message(p_group_id uuid, p_content text)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid      uuid := public.assert_active_caller();
  v_content  text := coalesce(p_content, '');
  v_original text;
  v_msg_id   uuid;
  v_msg_at   timestamptz;
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
  if char_length(trim(v_content)) < 1 then
    raise exception 'EMPTY_MESSAGE';
  end if;
  if char_length(v_content) > 2000 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;

  v_original := v_content;
  v_content := public.censor_profanity(v_content);

  update public.study_groups
    set last_activity_at = now()
    where study_groups.id = p_group_id;

  insert into public.group_messages (group_id, sender_id, content)
  values (p_group_id, v_uid, v_content)
  returning group_messages.id, group_messages.created_at into v_msg_id, v_msg_at;

  if v_content <> v_original then
    insert into public.message_originals
      (message_kind, message_id, sender_id, original_content, censored_content)
    values ('group', v_msg_id, v_uid, v_original, v_content);
  end if;

  return query select v_msg_id, v_msg_at;
end;
$fn$;

-- ── send_direct_message: same treatment ─────────────────────────────────────
create or replace function public.send_direct_message(p_recipient uuid, p_content text)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid      uuid := public.assert_active_caller();
  v_content  text := coalesce(p_content, '');
  v_original text;
  v_msg_id   uuid;
  v_msg_at   timestamptz;
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
    raise exception 'BLOCKED';
  end if;
  if char_length(trim(v_content)) < 1 then
    raise exception 'EMPTY_MESSAGE';
  end if;
  if char_length(v_content) > 2000 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;

  v_original := v_content;
  v_content := public.censor_profanity(v_content);

  insert into public.direct_messages (sender_id, recipient_id, content)
  values (v_uid, p_recipient, v_content)
  returning direct_messages.id, direct_messages.created_at into v_msg_id, v_msg_at;

  if v_content <> v_original then
    insert into public.message_originals
      (message_kind, message_id, sender_id, original_content, censored_content)
    values ('direct', v_msg_id, v_uid, v_original, v_content);
  end if;

  return query select v_msg_id, v_msg_at;
end;
$fn$;
