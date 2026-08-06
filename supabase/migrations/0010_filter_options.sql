-- ============================================================================
-- 0010 — Filter options for the people-search panel.
--
-- WHAT THIS FILE DOES
--   One small function the filter UI calls to populate its "Major"
--   multi-select with the majors that actually exist in the data
--   (spec §5.10: "Multi-select from the majors present in the data").
--
-- WHY IT'S A FUNCTION: profiles RLS only lets you read your own row, so
-- the client cannot ask "what majors exist?" directly. And the privacy
-- rule follows the values all the way down: a major that only hidden
-- profiles have must NOT appear as an option — offering it would reveal
-- that somebody has it, which is exactly what they hid.
-- ============================================================================

create or replace function public.get_major_options()
returns text[]
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(array_agg(distinct p.major order by p.major), '{}')
  from public.profiles p
  where p.major is not null
    and p.display_name is not null
    and p.account_status = 'active'
    -- Only majors from profiles that SHOW their major (see header).
    and coalesce((p.privacy->>'major')::boolean, false) = false;
$$;

revoke execute on function public.get_major_options() from public, anon;
grant execute on function public.get_major_options() to authenticated;

-- ── cancel_buddy_request ────────────────────────────────────────────────────
-- Added alongside (0003 shipped cancel for FRIEND requests only): the
-- sender takes back their own pending study-buddy request. Mirrors
-- cancel_friend_request exactly.
create or replace function public.cancel_buddy_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  update public.study_buddy_requests
    set status = 'cancelled', resolved_at = now()
    where id = p_request_id and sender_id = v_uid and status = 'pending';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
end;
$$;

revoke execute on function public.cancel_buddy_request(uuid) from public, anon;
grant execute on function public.cancel_buddy_request(uuid) to authenticated;
