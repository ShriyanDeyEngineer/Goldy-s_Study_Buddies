-- ============================================================================
-- 0013 — chat profanity filter.
--
-- Cuss words in group chat and DMs are masked to '****' AT WRITE TIME, in
-- the database function — the one write path a client can't skip. The
-- same masking runs client-side (lib/profanity.ts) so the sender's own
-- optimistic echo matches what everyone else receives; keep the two word
-- lists identical when editing either.
--
-- Two patterns, because of the Scunthorpe problem:
--   - STRONG words are masked wherever they appear, even inside another
--     word ("bullshit" -> "bull****").
--   - AMBIGUOUS words are masked only as whole words (\y = word boundary),
--     so "assessment", "Dickson", and "cockpit" survive.
-- ============================================================================

create or replace function public.censor_profanity(p_text text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select regexp_replace(
           regexp_replace(
             coalesce(p_text, ''),
             '(fuck|shit|cunt|bitch|whore|slut|faggot|nigger|nigga|asshole)',
             '****', 'gi'
           ),
           '\y(ass|dick|cock|pussy|bastard|tits)\y',
           '****', 'gi'
         );
$$;

revoke execute on function public.censor_profanity(text) from public, anon;
grant execute on function public.censor_profanity(text) to authenticated;

-- send_group_message: unchanged from 0006 except the censor step.
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

  -- Length checks run on the ORIGINAL text; masking never changes whether
  -- a message is sendable.
  v_content := public.censor_profanity(v_content);

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

-- send_direct_message: unchanged from 0006 except the censor step.
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

  v_content := public.censor_profanity(v_content);

  return query
  insert into public.direct_messages (sender_id, recipient_id, content)
  values (v_uid, p_recipient, v_content)
  returning direct_messages.id, direct_messages.created_at;
end;
$$;
