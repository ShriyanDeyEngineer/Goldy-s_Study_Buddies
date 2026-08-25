-- ============================================================================
-- 0018 — group resources: shared notes and links (the "Resources" section).
--
-- Members of a group can post two kinds of resource: a NOTE (text, up to
-- 5,000 chars) or a LINK (http/https URL). Deliberately NO file uploads —
-- files would eat storage and bring malware/copyright headaches; a link
-- to a Google Doc does the same job.
--
-- Standard shape: members-only RLS for reads; writes only through
-- SECURITY DEFINER functions. Note text and titles run through
-- censor_profanity() as the server-side backstop (the client also
-- REJECTS profane titles before submitting).
-- ============================================================================

create table public.group_resources (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.study_groups (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('note', 'link')),
  title      text not null check (char_length(title) between 1 and 100),
  -- The note body, or the URL for links.
  content    text not null check (char_length(content) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index group_resources_by_group on public.group_resources (group_id, created_at desc);

alter table public.group_resources enable row level security;

create policy "members read group resources"
  on public.group_resources for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

grant select on public.group_resources to authenticated;

create or replace function public.add_group_resource(
  p_group_id uuid,
  p_kind     text,
  p_title    text,
  p_content  text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := public.assert_active_caller();
  v_title   text := trim(coalesce(p_title, ''));
  v_content text := trim(coalesce(p_content, ''));
  v_id      uuid;
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
  if p_kind not in ('note', 'link') then
    raise exception 'INVALID_KIND';
  end if;
  if char_length(v_title) not between 1 and 100 then
    raise exception 'INVALID_TITLE';
  end if;
  if p_kind = 'link' then
    if char_length(v_content) not between 1 and 500
       or v_content !~* '^https?://' then
      raise exception 'INVALID_LINK';
    end if;
  else
    if char_length(v_content) not between 1 and 5000 then
      raise exception 'INVALID_NOTE';
    end if;
    -- Notes are shared prose — same masking rule as chat.
    v_content := public.censor_profanity(v_content);
  end if;
  v_title := public.censor_profanity(v_title);

  insert into public.group_resources (group_id, author_id, kind, title, content)
  values (p_group_id, v_uid, p_kind, v_title, v_content)
  returning id into v_id;

  update public.study_groups set last_activity_at = now() where id = p_group_id;
  return v_id;
end;
$$;

revoke execute on function public.add_group_resource(uuid, text, text, text) from public, anon;
grant execute on function public.add_group_resource(uuid, text, text, text) to authenticated;

-- Author or group manager may delete.
create or replace function public.delete_group_resource(p_resource_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.group_resources%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_row from public.group_resources where id = p_resource_id;
  if not found then
    raise exception 'RESOURCE_NOT_FOUND';
  end if;
  if v_row.author_id <> v_uid
     and not public.is_group_manager(v_row.group_id, v_uid) then
    raise exception 'NOT_ALLOWED';
  end if;
  delete from public.group_resources where id = p_resource_id;
end;
$$;

revoke execute on function public.delete_group_resource(uuid) from public, anon;
grant execute on function public.delete_group_resource(uuid) to authenticated;
