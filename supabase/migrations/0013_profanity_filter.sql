-- ============================================================================
-- 0013 — chat profanity filter.
--
-- Cuss words in group chat and DMs are masked to '****' AT WRITE TIME, in
-- the database function — the one write path a client can't skip. The
-- same masking runs client-side (lib/profanity.ts) so the sender's own
-- optimistic echo matches what everyone else receives; keep the two word
-- lists identical when editing either. The fuzzy-matching STRATEGY (leet
-- substitutions, separators, repetition) is duplicated in both files too —
-- if you change one, change the other, or the echo can diverge from what
-- actually gets masked.
--
-- Two patterns, because of the Scunthorpe problem:
--   - STRONG words are masked wherever they appear, even inside another
--     word ("bullshit" -> "bull****").
--   - AMBIGUOUS words are masked only as whole words (\y = word boundary),
--     so "assessment", "Dickson", and "cockpit" survive.
--
-- Bypass hardening: each word is compiled into a "fuzzy" pattern that
-- tolerates:
--   - leetspeak substitutions (a<->4/@, e<->3, i<->1/!/|, o<->0, s<->5/$,
--     t<->7/+, ...)
--   - separators/punctuation inserted between letters ("f.u.c.k", "f u c k")
--   - zero-width/invisible unicode used as spacers (U+200B-U+200D, U+FEFF)
--   - repeated characters ("fuuuuck")
--
-- Known limitation: this does NOT catch unicode homoglyphs (Cyrillic "a"
-- for Latin "a", etc). That needs a confusables-normalization pass against
-- the Unicode confusables table — flag if it becomes a real problem.
-- ============================================================================

-- Per-letter substitution class: what characters can stand in for this
-- letter in a bypass attempt. Falls through to the letter itself.
create or replace function public._profanity_leet_class(p_letter text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case lower(p_letter)
    when 'a' then 'a4@'
    when 'b' then 'b8'
    when 'c' then 'c(<{'
    when 'e' then 'e3'
    when 'g' then 'g9'
    when 'i' then 'i1!|'
    when 'l' then 'l1|'
    when 'o' then 'o0'
    when 's' then 's5$'
    when 't' then 't7+'
    when 'u' then 'uv'
    else lower(p_letter)
  end;
$$;

-- Turns a plain word into a regex fragment that matches it plus common
-- bypass variants: "fuck" -> matches "f u c k", "f.u.c.k", "fuuuck",
-- "f*ck", "f4ck", zero-width-spaced "f<ZWSP>uck", etc.
create or replace function public._profanity_fuzzy_word(p_word text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  -- Optional separator allowed between every letter: whitespace, common
  -- punctuation, or zero-width/invisible unicode spacers.
  v_sep constant text :=
    '[\s\-_.,*''"~`' || chr(8203) || '-' || chr(8205) || chr(65279) || ']*';
  v_out text := '';
  i int;
begin
  for i in 1..char_length(p_word) loop
    if i > 1 then
      v_out := v_out || v_sep;
    end if;
    -- "+" absorbs repeated characters ("fuuuuck").
    v_out := v_out || '[' || public._profanity_leet_class(substr(p_word, i, 1)) || ']+';
  end loop;
  return v_out;
end;
$$;

-- Builds a "(word1|word2|...)" alternation from a word list, longest word
-- first so a longer match never gets shadowed by a shorter one that
-- happens to share a fuzzy-pattern prefix.
create or replace function public._profanity_pattern(p_words text[])
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select string_agg(public._profanity_fuzzy_word(w), '|' order by length(w) desc)
  from unnest(p_words) as w;
$$;

create or replace function public.censor_profanity(p_text text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_strong_words constant text[] := array[
    'fuck', 'shit', 'cunt', 'bitch', 'whore', 'slut',
    'faggot', 'nigger', 'nigga', 'asshole', 'retard'
  ];
  v_whole_words constant text[] := array[
    'ass', 'dick', 'cock', 'pussy', 'bastard', 'tits'
  ];
begin
  return regexp_replace(
    regexp_replace(
      coalesce(p_text, ''),
      '(' || public._profanity_pattern(v_strong_words) || ')',
      '[REDACTED]', 'gi'
    ),
    '\y(' || public._profanity_pattern(v_whole_words) || ')\y',
    '#&%*@!', 'gi'
  );
end;
$$;

revoke execute on function public._profanity_leet_class(text) from public, anon;
grant execute on function public._profanity_leet_class(text) to authenticated;

revoke execute on function public._profanity_fuzzy_word(text) from public, anon;
grant execute on function public._profanity_fuzzy_word(text) to authenticated;

revoke execute on function public._profanity_pattern(text[]) from public, anon;
grant execute on function public._profanity_pattern(text[]) to authenticated;

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