-- ============================================================================
-- 0030 — server-side rate limit on sending messages.
--
-- Chat send was only ever guarded client-side (the composer disables its
-- own button while a request is in flight) — a script calling
-- send_group_message/send_direct_message directly (server actions are
-- just POST endpoints) faced no limit at all. Matches this codebase's own
-- rule that a write's actual invariant belongs in the database function,
-- not the client (see lib/actions/groups.ts's header comment) — the
-- client-side guard stays as UX, this is the real gate.
--
-- Threshold: 10 messages per 10 seconds per sender. Generous enough that
-- no real conversation — even a fast back-and-forth — ever brushes it,
-- tight enough to stop a flood loop. Checked with a plain COUNT against a
-- new (sender_id, created_at) index — group_messages had no sender-scoped
-- index at all before this (only (group_id, created_at), 0006); without
-- one, the rate check itself would sequential-scan the very table this
-- migration set is otherwise working to keep bounded reads on.
-- ============================================================================

create index if not exists group_messages_sender_idx
  on public.group_messages (sender_id, created_at);

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
  if (
    select count(*) from public.group_messages
    where sender_id = v_uid and created_at > now() - interval '10 seconds'
  ) >= 10 then
    raise exception 'RATE_LIMITED';
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
  if (
    select count(*) from public.direct_messages
    where sender_id = v_uid and created_at > now() - interval '10 seconds'
  ) >= 10 then
    raise exception 'RATE_LIMITED';
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
