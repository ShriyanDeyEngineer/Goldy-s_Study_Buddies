-- ============================================================================
-- 0031 — HOTFIX: 0030's rate-limit check broke every message send.
--
-- Both send functions RETURN TABLE (id uuid, created_at timestamptz),
-- which makes created_at a PL/pgSQL OUTPUT VARIABLE inside the body. The
-- new rate-limit subquery referenced created_at unqualified, so Postgres
-- raised "column reference is ambiguous" on EVERY call — group chat and
-- DMs were fully down. (0006's header documents this exact trap for the
-- id column; the rate check needed the same table qualification.)
--
-- This restates 0030's two functions verbatim with the columns qualified.
-- ============================================================================

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
    -- Table-qualified NAMES REQUIRED here: this function RETURNS TABLE
    -- (id, created_at), so bare created_at is a PL/pgSQL variable and
    -- the unqualified reference is ambiguous — same trap 0006 documents
    -- for study_groups.id. Unqualified, EVERY send raised and chat was
    -- completely down.
    select count(*) from public.group_messages gm
    where gm.sender_id = v_uid and gm.created_at > now() - interval '10 seconds'
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
    -- Table-qualified for the same RETURNS TABLE reason as above.
    select count(*) from public.direct_messages dm
    where dm.sender_id = v_uid and dm.created_at > now() - interval '10 seconds'
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
