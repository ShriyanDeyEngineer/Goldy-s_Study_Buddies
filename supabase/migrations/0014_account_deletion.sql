-- ============================================================================
-- 0014 — account deletion (self-service).
--
-- "Delete my account" is a SOFT delete that scrubs, not a row delete:
-- group_messages.sender_id and direct_messages.sender_id cascade from
-- profiles, so hard-deleting the row would erase every chat message the
-- person ever sent — and the product decision is that old chats STAY,
-- attributed to "Unknown". So delete_account():
--   1. leaves every group through leave_group() (manager succession and
--      last-member disband behave exactly as a manual leave),
--   2. cancels all pending paperwork (join requests, invitations,
--      friend/buddy requests) and severs friendships, buddy links, blocks,
--   3. deletes their RSVPs, poll votes, notifications, and avatar files,
--   4. scrubs every profile field, sets display_name = 'Unknown' and
--      account_status = 'deleted'.
--
-- The auth.users row is kept (its FK cascade would take the profile with
-- it). If the person signs in again they hit the "account deleted" screen;
-- assert_active_caller() raises ACCOUNT_DISABLED on every write.
--
-- public_profiles now also serves deleted accounts — forced to
-- 'Unknown' / no avatar — so chats, DM headers, and conversation lists
-- resolve a name everywhere without per-component fallbacks.
-- ============================================================================

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active', 'suspended', 'banned', 'deleted'));

create or replace view public.public_profiles as
  select
    p.id,
    case when p.account_status = 'deleted' then 'Unknown' else p.display_name end
      as display_name,
    case when p.account_status = 'deleted' then null else p.avatar_url end
      as avatar_url
  from public.profiles p
  where p.account_status in ('active', 'deleted');

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
  delete from storage.objects
    where bucket_id = 'avatars' and (storage.foldername(name))[1] = v_uid::text;

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

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
