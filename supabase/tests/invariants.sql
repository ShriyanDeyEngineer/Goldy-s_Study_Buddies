-- ============================================================================
-- Database invariant tests (spec §7 / §11).
--
-- WHAT THIS IS
--   A self-contained script that creates throwaway users, exercises the
--   SECURITY DEFINER functions, ASSERTS every §7 invariant, and ROLLS
--   BACK — the database is left exactly as it was found.
--
-- HOW TO RUN
--   Local stack:   supabase db start   (once), then:
--                  psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" \
--                       -v ON_ERROR_STOP=1 -f supabase/tests/invariants.sql
--   Hosted (fine — it rolls back): psql "<connection string>" \
--                       -v ON_ERROR_STOP=1 -f supabase/tests/invariants.sql
--
--   Success looks like a series of "NOTICE: PASS: …" lines and a final
--   ROLLBACK. ANY failed assertion raises an exception and aborts the
--   script — with ON_ERROR_STOP that means a non-zero exit code.
--
-- HOW IT IMPERSONATES USERS
--   auth.uid() reads the JWT claims from a session setting. Setting
--   request.jwt.claims to '{"sub": "<uuid>"}' makes every function
--   believe that user is calling — the same mechanism PostgREST uses.
-- ============================================================================

begin;

-- Freeze a helper to switch the "current user".
create or replace function pg_temp.impersonate(p_user uuid)
returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true); $$;

-- ── Fixtures ────────────────────────────────────────────────────────────────

insert into public.universities (name, email_domain)
values ('University of Minnesota', 'umn.edu')
on conflict (email_domain) do nothing;

-- Five test students. Inserting into auth.users fires our triggers:
-- the domain gate (these pass) and profile auto-creation.
do $$
declare
  ids uuid[] := array[
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-a000-000000000002',
    '00000000-0000-4000-a000-000000000003',
    '00000000-0000-4000-a000-000000000004',
    '00000000-0000-4000-a000-000000000005'
  ];
  i int;
begin
  for i in 1..5 loop
    insert into auth.users (id, email)
    values (ids[i], 'invariant-test-' || i || '@umn.edu');
    -- "Finish onboarding" so assert_active_caller lets them act.
    update public.profiles set display_name = 'Test Student ' || i where id = ids[i];
  end loop;
end $$;

-- Short names for readability below.
-- (psql doesn't have variables inside DO blocks, so each block redeclares.)

-- ── INVARIANT: the email-domain gate (both signup methods) ──────────────────
do $$
begin
  begin
    insert into auth.users (id, email)
    values ('00000000-0000-4000-a000-00000000dead', 'intruder@gmail.com');
    raise exception 'FAIL: non-umn.edu signup was allowed';
  exception when others then
    if sqlerrm like '%EMAIL_DOMAIN_NOT_ALLOWED%' then
      raise notice 'PASS: domain gate rejects non-allow-listed signups';
    else
      raise;
    end if;
  end;
end $$;

-- A course for the groups below.
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
begin
  perform pg_temp.impersonate(u1);
  perform public.create_course('TEST', '1001', 'Invariant Testing I');
end $$;

-- ── INVARIANT 1: capacity can never be exceeded ─────────────────────────────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u2 uuid := '00000000-0000-4000-a000-000000000002';
  u3 uuid := '00000000-0000-4000-a000-000000000003';
  v_course uuid;
  v_group uuid;
  v_count int;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');

  perform pg_temp.impersonate(u1);
  v_group := public.create_study_group(v_course, 'Capacity Test', 2, 'open');

  perform pg_temp.impersonate(u2);
  if public.join_group(v_group) <> 'joined' then
    raise exception 'FAIL: open-group join did not return joined';
  end if;

  -- Group is now 2/2. A third join must refuse with GROUP_FULL.
  perform pg_temp.impersonate(u3);
  begin
    perform public.join_group(v_group);
    raise exception 'FAIL: join succeeded on a full group';
  exception when others then
    if sqlerrm not like '%GROUP_FULL%' then raise; end if;
  end;

  select member_count into v_count from public.study_groups where id = v_group;
  if v_count <> 2 then
    raise exception 'FAIL: member_count % after fill (expected 2)', v_count;
  end if;
  if v_count <> (select count(*) from public.study_group_members where group_id = v_group) then
    raise exception 'FAIL: member_count drifted from actual membership rows';
  end if;

  raise notice 'PASS: capacity is enforced and the cached count matches reality';
end $$;

-- ── INVARIANTS 2 & 3: approval re-check + duplicate requests ────────────────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u2 uuid := '00000000-0000-4000-a000-000000000002';
  u3 uuid := '00000000-0000-4000-a000-000000000003';
  v_course uuid;
  v_group uuid;
  v_req_u2 uuid;
  v_req_u3 uuid;
  v_status text;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');

  perform pg_temp.impersonate(u1);
  v_group := public.create_study_group(v_course, 'Approval Test', 2, 'closed');

  perform pg_temp.impersonate(u2);
  if public.join_group(v_group) <> 'requested' then
    raise exception 'FAIL: closed-group join did not create a request';
  end if;

  -- Duplicate pending request must be refused (invariant 3).
  begin
    perform public.join_group(v_group);
    raise exception 'FAIL: duplicate join request was allowed';
  exception when others then
    if sqlerrm not like '%DUPLICATE_REQUEST%' then raise; end if;
  end;

  perform pg_temp.impersonate(u3);
  perform public.join_group(v_group);

  select id into v_req_u2 from public.join_requests
    where group_id = v_group and user_id = u2 and status = 'pending';
  select id into v_req_u3 from public.join_requests
    where group_id = v_group and user_id = u3 and status = 'pending';

  -- Approving U2 fills the group (creator + U2 = 2/2). The sweep must
  -- cancel U3's still-pending request and notify them (invariant 2's
  -- "the group filled while you waited" path).
  perform pg_temp.impersonate(u1);
  if public.approve_join_request(v_req_u2) <> 'approved' then
    raise exception 'FAIL: first approval did not return approved';
  end if;

  select status into v_status from public.join_requests where id = v_req_u3;
  if v_status <> 'cancelled' then
    raise exception 'FAIL: pending request on a full group is % (expected cancelled)', v_status;
  end if;
  if not exists (
    select 1 from public.notifications
    where recipient_id = u3 and type = 'request_cancelled_group_full'
  ) then
    raise exception 'FAIL: no cancelled-because-full notification for the requester';
  end if;

  -- Approving the already-cancelled request must refuse and change nothing.
  begin
    perform public.approve_join_request(v_req_u3);
    raise exception 'FAIL: approving a resolved request succeeded';
  exception when others then
    if sqlerrm not like '%ALREADY_RESOLVED%' then raise; end if;
  end;

  raise notice 'PASS: approval re-checks capacity; duplicates and stale approvals refused';
end $$;

-- ── INVARIANT 4: manager-only actions refuse and change nothing ─────────────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u2 uuid := '00000000-0000-4000-a000-000000000002';
  u4 uuid := '00000000-0000-4000-a000-000000000004';
  v_course uuid;
  v_group uuid;
  v_req uuid;
  v_before public.study_groups%rowtype;
  v_after public.study_groups%rowtype;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');

  perform pg_temp.impersonate(u1);
  v_group := public.create_study_group(v_course, 'Authority Test', 5, 'closed');

  perform pg_temp.impersonate(u2);
  perform public.join_group(v_group);
  select id into v_req from public.join_requests
    where group_id = v_group and user_id = u2 and status = 'pending';

  select * into v_before from public.study_groups where id = v_group;

  -- U4 (not the manager) tries everything; each must refuse.
  perform pg_temp.impersonate(u4);
  begin
    perform public.approve_join_request(v_req);
    raise exception 'FAIL: non-manager approved a request';
  exception when others then
    if sqlerrm not like '%NOT_MANAGER%' then raise; end if;
  end;
  begin
    perform public.update_group_settings(v_group, 'Hijacked', 'open');
    raise exception 'FAIL: non-manager changed settings';
  exception when others then
    if sqlerrm not like '%NOT_MANAGER%' then raise; end if;
  end;
  begin
    perform public.disband_group(v_group);
    raise exception 'FAIL: non-manager disbanded the group';
  exception when others then
    if sqlerrm not like '%NOT_MANAGER%' then raise; end if;
  end;

  select * into v_after from public.study_groups where id = v_group;
  if row(v_before.*) is distinct from row(v_after.*) then
    raise exception 'FAIL: refused manager actions still changed the group row';
  end if;
  if (select status from public.join_requests where id = v_req) <> 'pending' then
    raise exception 'FAIL: refused approval changed the request';
  end if;

  raise notice 'PASS: manager-only actions refuse non-managers and leave state untouched';
end $$;

-- ── INVARIANT 5: deterministic manager succession ───────────────────────────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u2 uuid := '00000000-0000-4000-a000-000000000002';
  u3 uuid := '00000000-0000-4000-a000-000000000003';
  v_course uuid;
  v_group uuid;
  v_manager uuid;
  v_status text;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');

  perform pg_temp.impersonate(u1);
  v_group := public.create_study_group(v_course, 'Succession Test', 5, 'open');
  perform pg_temp.impersonate(u2);
  perform public.join_group(v_group);
  perform pg_temp.impersonate(u3);
  perform public.join_group(v_group);

  -- Stagger tenure explicitly (in one transaction now() is frozen, so
  -- the join timestamps would otherwise tie).
  update public.study_group_members set joined_at = now() - interval '2 hours'
    where group_id = v_group and user_id = u2;
  update public.study_group_members set joined_at = now() - interval '1 hour'
    where group_id = v_group and user_id = u3;

  perform pg_temp.impersonate(u1);
  perform public.leave_group(v_group);

  select manager_id into v_manager from public.study_groups where id = v_group;
  if v_manager <> u2 then
    raise exception 'FAIL: crown went to %, expected longest-tenured u2', v_manager;
  end if;
  if not exists (
    select 1 from public.notifications
    where recipient_id = u2 and type = 'manager_transferred'
  ) then
    raise exception 'FAIL: new manager was not notified';
  end if;

  -- Everyone leaves → the group disbands itself: a tombstone stamped
  -- with disbanded_at, which the purge deletes seven days later (0022).
  perform pg_temp.impersonate(u2);
  perform public.leave_group(v_group);
  perform pg_temp.impersonate(u3);
  perform public.leave_group(v_group);

  select status into v_status from public.study_groups where id = v_group;
  if v_status <> 'disbanded' then
    raise exception 'FAIL: empty group is % (expected disbanded)', v_status;
  end if;
  if (select disbanded_at from public.study_groups where id = v_group) is null then
    raise exception 'FAIL: disbanded_at not stamped on self-disband';
  end if;

  raise notice 'PASS: succession is longest-tenured-first; last member out disbands';
end $$;

-- ── INVARIANT 6: disband completeness ───────────────────────────────────────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u2 uuid := '00000000-0000-4000-a000-000000000002';
  u4 uuid := '00000000-0000-4000-a000-000000000004';
  v_course uuid;
  v_group uuid;
  v_req uuid;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');

  perform pg_temp.impersonate(u1);
  v_group := public.create_study_group(v_course, 'Disband Test', 5, 'closed');

  perform pg_temp.impersonate(u2);
  perform public.join_group(v_group);
  select id into v_req from public.join_requests
    where group_id = v_group and user_id = u2 and status = 'pending';
  perform pg_temp.impersonate(u1);
  perform public.approve_join_request(v_req);

  -- One still-pending request and one future meetup to be cleaned up.
  perform pg_temp.impersonate(u4);
  perform public.join_group(v_group);
  perform pg_temp.impersonate(u1);
  perform public.create_meetup(v_group, 'Doomed meetup', now() + interval '2 days',
                               'in_person', 'Walter Library', null);

  perform public.disband_group(v_group);

  -- Right after disband: the classic tombstone assertions.
  if exists (select 1 from public.study_group_members where group_id = v_group) then
    raise exception 'FAIL: members remain after disband';
  end if;
  if exists (select 1 from public.join_requests where group_id = v_group and status = 'pending') then
    raise exception 'FAIL: pending requests remain after disband';
  end if;
  if exists (
    select 1 from public.meetups
    where group_id = v_group and scheduled_at > now() and not is_cancelled
  ) then
    raise exception 'FAIL: future meetups not cancelled by disband';
  end if;
  if (select member_count from public.study_groups where id = v_group) <> 0 then
    raise exception 'FAIL: member_count nonzero after disband';
  end if;
  if not exists (
    select 1 from public.notifications where recipient_id = u2 and type = 'group_disbanded'
  ) then
    raise exception 'FAIL: members were not notified of disband';
  end if;
  if not exists (
    select 1 from public.notifications where recipient_id = u4 and type = 'group_disbanded'
  ) then
    raise exception 'FAIL: pending requester was not notified of disband';
  end if;

  -- The seven-day rule (0022): age the tombstone past the window and run
  -- the purge — the group and EVERY child row must be gone.
  update public.study_groups
    set disbanded_at = now() - interval '8 days'
    where id = v_group;
  perform public.purge_stale_rows();

  if exists (select 1 from public.study_groups where id = v_group) then
    raise exception 'FAIL: purge kept a week-old disbanded group';
  end if;
  if exists (select 1 from public.join_requests where group_id = v_group) then
    raise exception 'FAIL: join-request rows survived the purge';
  end if;
  if exists (select 1 from public.meetups where group_id = v_group) then
    raise exception 'FAIL: meetup rows survived the purge';
  end if;

  raise notice 'PASS: disband tombstones for seven days, then the purge deletes everything';
end $$;

-- ── INVARIANT 7: closed→open approves min(pending, space), oldest first ─────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u2 uuid := '00000000-0000-4000-a000-000000000002';
  u3 uuid := '00000000-0000-4000-a000-000000000003';
  u4 uuid := '00000000-0000-4000-a000-000000000004';
  v_course uuid;
  v_group uuid;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');

  perform pg_temp.impersonate(u1);
  v_group := public.create_study_group(v_course, 'Mode Switch Test', 3, 'closed');

  perform pg_temp.impersonate(u2); perform public.join_group(v_group);
  perform pg_temp.impersonate(u3); perform public.join_group(v_group);
  perform pg_temp.impersonate(u4); perform public.join_group(v_group);

  -- Stagger request ages: u2 oldest, then u3, then u4.
  update public.join_requests set created_at = now() - interval '3 hours'
    where group_id = v_group and user_id = u2;
  update public.join_requests set created_at = now() - interval '2 hours'
    where group_id = v_group and user_id = u3;
  update public.join_requests set created_at = now() - interval '1 hour'
    where group_id = v_group and user_id = u4;

  -- Capacity 3, 1 member, 3 pending → exactly 2 approvals (u2, u3);
  -- u4 is cancelled-with-notification, never over capacity.
  perform pg_temp.impersonate(u1);
  perform public.update_group_settings(v_group, 'Mode Switch Test', 'open');

  if (select member_count from public.study_groups where id = v_group) <> 3 then
    raise exception 'FAIL: closed->open ended at %/3 members',
      (select member_count from public.study_groups where id = v_group);
  end if;
  if not exists (select 1 from public.study_group_members where group_id = v_group and user_id = u2)
     or not exists (select 1 from public.study_group_members where group_id = v_group and user_id = u3) then
    raise exception 'FAIL: oldest two requests were not the ones approved';
  end if;
  if exists (select 1 from public.study_group_members where group_id = v_group and user_id = u4) then
    raise exception 'FAIL: capacity exceeded — newest requester was seated';
  end if;
  if (select status from public.join_requests where group_id = v_group and user_id = u4) <> 'cancelled' then
    raise exception 'FAIL: overflow request was not cancelled';
  end if;

  raise notice 'PASS: closed->open approves exactly min(pending, space), oldest first';
end $$;

-- ── INVARIANT 8: the 2,000-character message wall ───────────────────────────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u2 uuid := '00000000-0000-4000-a000-000000000002';
  v_course uuid;
  v_group uuid;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');
  perform pg_temp.impersonate(u1);
  v_group := public.create_study_group(v_course, 'Message Test', 5, 'open');

  -- Exactly 2,000 is fine…
  perform public.send_group_message(v_group, repeat('x', 2000));
  -- …2,001 is not, in group chat…
  begin
    perform public.send_group_message(v_group, repeat('x', 2001));
    raise exception 'FAIL: 2,001-char group message was persisted';
  exception when others then
    if sqlerrm not like '%MESSAGE_TOO_LONG%' then raise; end if;
  end;
  -- …and not in DMs either.
  begin
    perform public.send_direct_message(u2, repeat('x', 2001));
    raise exception 'FAIL: 2,001-char direct message was persisted';
  exception when others then
    if sqlerrm not like '%MESSAGE_TOO_LONG%' then raise; end if;
  end;

  if exists (select 1 from public.group_messages where char_length(content) > 2000)
     or exists (select 1 from public.direct_messages where char_length(content) > 2000) then
    raise exception 'FAIL: an over-limit message exists in the database';
  end if;

  raise notice 'PASS: no message over 2,000 characters is ever persisted';
end $$;

-- ── INVARIANT 9: block completeness ─────────────────────────────────────────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u2 uuid := '00000000-0000-4000-a000-000000000002';
  v_req uuid;
begin
  -- Build every kind of connection between u1 and u2 first.
  perform pg_temp.impersonate(u1);
  perform public.send_friend_request(u2);
  select id into v_req from public.friend_requests
    where sender_id = u1 and recipient_id = u2 and status = 'pending';
  perform pg_temp.impersonate(u2);
  perform public.respond_friend_request(v_req, true);

  update public.profiles set is_available_for_buddies = true where id in (u1, u2);
  perform pg_temp.impersonate(u1);
  perform public.send_buddy_request(u2);
  select id into v_req from public.study_buddy_requests
    where sender_id = u1 and recipient_id = u2 and status = 'pending';
  perform pg_temp.impersonate(u2);
  perform public.respond_buddy_request(v_req, true);

  -- One block call must sever all of it, atomically.
  perform pg_temp.impersonate(u1);
  perform public.block_user(u2);

  if exists (select 1 from public.friends
             where user_id_a = least(u1,u2) and user_id_b = greatest(u1,u2)) then
    raise exception 'FAIL: friendship survived the block';
  end if;
  if exists (select 1 from public.study_buddy_connections
             where user_id_a = least(u1,u2) and user_id_b = greatest(u1,u2)) then
    raise exception 'FAIL: buddy connection survived the block';
  end if;
  if exists (select 1 from public.friend_requests
             where status = 'pending'
               and ((sender_id = u1 and recipient_id = u2) or (sender_id = u2 and recipient_id = u1))) then
    raise exception 'FAIL: pending friend request survived the block';
  end if;

  -- And the blocked user can neither message nor re-request.
  perform pg_temp.impersonate(u2);
  begin
    perform public.send_direct_message(u1, 'hello?');
    raise exception 'FAIL: blocked user could send a DM';
  exception when others then
    if sqlerrm not like '%BLOCKED%' then raise; end if;
  end;
  begin
    perform public.send_friend_request(u1);
    raise exception 'FAIL: blocked user could send a friend request';
  exception when others then
    if sqlerrm not like '%BLOCKED%' then raise; end if;
  end;

  -- The blocked user cannot see the blocker's profile at all.
  if public.get_public_profile(u1) is not null then
    raise exception 'FAIL: blocked user can still view the blocker profile';
  end if;

  raise notice 'PASS: one block severs friendship, buddies, requests, DMs, and profile view';
end $$;

-- ── INVARIANT 10: hidden fields are stripped AND exclude from filters ───────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u3 uuid := '00000000-0000-4000-a000-000000000003';
  v_profile jsonb;
begin
  -- u3 declares a major, then hides it.
  update public.profiles
    set major = 'Secret Science', privacy = '{"major": true}'::jsonb
    where id = u3;

  perform pg_temp.impersonate(u1);

  -- Rule 1: the key is ABSENT from the profile payload.
  v_profile := public.get_public_profile(u3);
  if v_profile ? 'major' then
    raise exception 'FAIL: hidden major present in profile payload';
  end if;

  -- Rule 2: filtering by that major must NOT return them.
  if exists (
    select 1 from public.search_people(p_majors => array['Secret Science'])
    where id = u3
  ) then
    raise exception 'FAIL: hidden major still findable via the major filter';
  end if;

  -- Positive control: un-hide, and both behaviors flip.
  update public.profiles set privacy = '{}'::jsonb where id = u3;
  v_profile := public.get_public_profile(u3);
  if not (v_profile ? 'major') then
    raise exception 'FAIL: visible major missing from profile payload';
  end if;
  if not exists (
    select 1 from public.search_people(p_majors => array['Secret Science'])
    where id = u3
  ) then
    raise exception 'FAIL: visible major not findable via the major filter';
  end if;

  raise notice 'PASS: hidden fields are stripped and excluded from their filters';
end $$;

do $$ begin raise notice '=== ALL INVARIANT TESTS PASSED — rolling back ==='; end $$;

rollback;
