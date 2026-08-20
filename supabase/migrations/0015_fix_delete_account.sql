-- ============================================================================
-- 0015 — fix delete_account: 0014's version deleted avatar rows straight
-- out of storage.objects, but the storage schema belongs to the storage
-- service and the function's owner has no DELETE privilege there — the
-- whole deletion failed with a raw "permission denied". Row-deleting in
-- storage.objects was the wrong tool anyway: it wouldn't remove the
-- underlying file bytes. Avatar cleanup now happens in the server action
-- (deleteAccountAction) through the storage API, under the user's own
-- session and the 0009 "own folder" policies, BEFORE this function runs.
-- Identical to 0014's version except that one statement is gone.
-- ============================================================================

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_group uuid;
begin
  -- Bare auth check on purpose: a suspended account may still delete
  -- itself (same reasoning as block_user in 0003).
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 1. Leave every group. leave_group() owns succession and disband.
  for v_group in
    select m.group_id from public.study_group_members m where m.user_id = v_uid
  loop
    perform public.leave_group(v_group);
  end loop;

  -- 2. Pending group paperwork.
  update public.join_requests
    set status = 'withdrawn', resolved_at = now()
    where user_id = v_uid and status = 'pending';
  update public.group_invitations
    set status = 'cancelled', resolved_at = now()
    where (invited_user_id = v_uid or inviter_id = v_uid) and status = 'pending';

  -- 2b. Social graph: vanish from everyone's lists, both directions.
  delete from public.friends
    where user_id_a = v_uid or user_id_b = v_uid;
  delete from public.study_buddy_connections
    where user_id_a = v_uid or user_id_b = v_uid;
  update public.friend_requests
    set status = 'cancelled', resolved_at = now()
    where (sender_id = v_uid or recipient_id = v_uid) and status = 'pending';
  update public.study_buddy_requests
    set status = 'cancelled', resolved_at = now()
    where (sender_id = v_uid or recipient_id = v_uid) and status = 'pending';
  delete from public.blocks
    where blocker_id = v_uid or blocked_id = v_uid;

  -- 3. Their participation records and inbox.
  delete from public.meetup_attendance where user_id = v_uid;
  delete from public.availability_votes where user_id = v_uid;
  delete from public.notifications where recipient_id = v_uid;

  -- 4. Scrub the profile. Old chats keep their rows; every read path
  --    resolves this person as "Unknown" from here on.
  update public.profiles set
    display_name = 'Unknown',
    avatar_url = null,
    bio = null,
    college = null,
    major = null,
    class_standing = null,
    graduation_month = null,
    graduation_year = null,
    social_links = '[]'::jsonb,
    privacy = '{}'::jsonb,
    is_available_for_buddies = false,
    email_notifications = false,
    email = 'deleted+' || v_uid || '@deleted.invalid',
    account_status = 'deleted'
  where id = v_uid;
end;
$$;
