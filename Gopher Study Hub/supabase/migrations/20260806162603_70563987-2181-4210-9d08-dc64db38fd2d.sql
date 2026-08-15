
REVOKE EXECUTE ON FUNCTION public.enforce_university_domain() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;

-- helper: notify
CREATE OR REPLACE FUNCTION public.notify(_user uuid, _type text, _payload jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, type, payload) VALUES (_user, _type, _payload);
$$;
REVOKE EXECUTE ON FUNCTION public.notify(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ===== create group =====
CREATE OR REPLACE FUNCTION public.create_study_group(_course uuid, _name text, _capacity int, _mode public.group_mode, _invitees uuid[] DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _gid uuid; _inv uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _name IS NULL OR char_length(btrim(_name)) < 1 OR char_length(_name) > 100 THEN RAISE EXCEPTION 'INVALID_NAME'; END IF;
  IF _capacity < 2 OR _capacity > 50 THEN RAISE EXCEPTION 'INVALID_CAPACITY'; END IF;
  IF EXISTS (SELECT 1 FROM public.study_groups WHERE course_id = _course AND lower(name) = lower(btrim(_name)) AND status <> 'disbanded') THEN
    RAISE EXCEPTION 'NAME_TAKEN';
  END IF;
  IF array_length(_invitees, 1) > _capacity - 1 THEN RAISE EXCEPTION 'TOO_MANY_INVITES'; END IF;

  INSERT INTO public.study_groups (course_id, name, manager_id, mode, capacity, member_count)
  VALUES (_course, btrim(_name), _uid, _mode, _capacity, 1) RETURNING id INTO _gid;
  INSERT INTO public.study_group_members (group_id, user_id) VALUES (_gid, _uid);

  FOREACH _inv IN ARRAY COALESCE(_invitees, '{}')
  LOOP
    IF _inv <> _uid AND EXISTS (SELECT 1 FROM public.user_courses WHERE user_id = _inv AND course_id = _course AND enrollment = 'current') THEN
      INSERT INTO public.group_invitations (group_id, invited_user_id, inviter_id) VALUES (_gid, _inv, _uid)
      ON CONFLICT DO NOTHING;
      PERFORM public.notify(_inv, 'group_invitation', jsonb_build_object('group_id', _gid, 'group_name', btrim(_name)));
    END IF;
  END LOOP;
  RETURN _gid;
END; $$;

-- ===== join / request =====
CREATE OR REPLACE FUNCTION public.join_or_request_group(_group uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); g public.study_groups%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO g FROM public.study_groups WHERE id = _group FOR UPDATE;
  IF g.id IS NULL OR g.status <> 'active' THEN RAISE EXCEPTION 'GROUP_UNAVAILABLE'; END IF;
  IF public.is_group_member(_group, _uid) THEN RAISE EXCEPTION 'ALREADY_MEMBER'; END IF;
  IF g.member_count >= g.capacity THEN RAISE EXCEPTION 'GROUP_FULL'; END IF;

  IF g.mode = 'open' THEN
    INSERT INTO public.study_group_members (group_id, user_id) VALUES (_group, _uid);
    UPDATE public.study_groups SET member_count = member_count + 1, last_activity_at = now() WHERE id = _group;
    UPDATE public.join_requests SET status = 'withdrawn', updated_at = now() WHERE group_id = _group AND user_id = _uid AND status = 'pending';
    RETURN 'joined';
  ELSE
    IF EXISTS (SELECT 1 FROM public.join_requests WHERE group_id = _group AND user_id = _uid AND status = 'pending') THEN
      RAISE EXCEPTION 'DUPLICATE_REQUEST';
    END IF;
    INSERT INTO public.join_requests (group_id, user_id) VALUES (_group, _uid);
    PERFORM public.notify(g.manager_id, 'join_request_received', jsonb_build_object('group_id', _group, 'group_name', g.name, 'user_id', _uid));
    RETURN 'requested';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.withdraw_join_request(_group uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  UPDATE public.join_requests SET status = 'withdrawn', updated_at = now()
   WHERE group_id = _group AND user_id = _uid AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_PENDING_REQUEST'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.decide_join_request(_request uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); r public.join_requests%ROWTYPE; g public.study_groups%ROWTYPE;
BEGIN
  SELECT group_id INTO r.group_id FROM public.join_requests WHERE id = _request;
  IF r.group_id IS NULL THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
  SELECT * INTO g FROM public.study_groups WHERE id = r.group_id FOR UPDATE;
  SELECT * INTO r FROM public.join_requests WHERE id = _request FOR UPDATE;
  IF g.manager_id <> _uid THEN RAISE EXCEPTION 'NOT_MANAGER'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'REQUEST_NOT_PENDING'; END IF;

  IF NOT _approve THEN
    UPDATE public.join_requests SET status = 'denied', updated_at = now() WHERE id = _request;
    PERFORM public.notify(r.user_id, 'join_request_denied', jsonb_build_object('group_id', g.id, 'group_name', g.name));
    RETURN;
  END IF;

  IF g.member_count >= g.capacity THEN
    UPDATE public.join_requests SET status = 'cancelled', updated_at = now() WHERE id = _request;
    PERFORM public.notify(r.user_id, 'request_cancelled_group_full', jsonb_build_object('group_id', g.id, 'group_name', g.name));
    RAISE EXCEPTION 'GROUP_FULL';
  END IF;

  INSERT INTO public.study_group_members (group_id, user_id) VALUES (g.id, r.user_id) ON CONFLICT DO NOTHING;
  UPDATE public.study_groups SET member_count = member_count + 1, last_activity_at = now() WHERE id = g.id;
  UPDATE public.join_requests SET status = 'approved', updated_at = now() WHERE id = _request;
  PERFORM public.notify(r.user_id, 'join_request_approved', jsonb_build_object('group_id', g.id, 'group_name', g.name));
END; $$;

-- ===== invitations =====
CREATE OR REPLACE FUNCTION public.respond_invitation(_invitation uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); i public.group_invitations%ROWTYPE; g public.study_groups%ROWTYPE;
BEGIN
  SELECT group_id INTO i.group_id FROM public.group_invitations WHERE id = _invitation;
  IF i.group_id IS NULL THEN RAISE EXCEPTION 'INVITATION_NOT_FOUND'; END IF;
  SELECT * INTO g FROM public.study_groups WHERE id = i.group_id FOR UPDATE;
  SELECT * INTO i FROM public.group_invitations WHERE id = _invitation FOR UPDATE;
  IF i.invited_user_id <> _uid THEN RAISE EXCEPTION 'NOT_INVITEE'; END IF;
  IF i.status <> 'pending' THEN RAISE EXCEPTION 'INVITATION_NOT_PENDING'; END IF;

  IF NOT _accept THEN
    UPDATE public.group_invitations SET status = 'declined', updated_at = now() WHERE id = _invitation;
    RETURN;
  END IF;
  IF g.member_count >= g.capacity THEN
    UPDATE public.group_invitations SET status = 'cancelled', updated_at = now() WHERE id = _invitation;
    RAISE EXCEPTION 'GROUP_FULL';
  END IF;
  INSERT INTO public.study_group_members (group_id, user_id) VALUES (g.id, _uid) ON CONFLICT DO NOTHING;
  UPDATE public.study_groups SET member_count = member_count + 1, last_activity_at = now() WHERE id = g.id;
  UPDATE public.group_invitations SET status = 'accepted', updated_at = now() WHERE id = _invitation;
  PERFORM public.notify(i.inviter_id, 'invitation_accepted', jsonb_build_object('group_id', g.id, 'group_name', g.name, 'user_id', _uid));
END; $$;

-- ===== succession helper =====
CREATE OR REPLACE FUNCTION public.assign_successor(_group uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _next uuid; _name text;
BEGIN
  SELECT m.user_id INTO _next FROM public.study_group_members m
    JOIN public.profiles p ON p.id = m.user_id
   WHERE m.group_id = _group
   ORDER BY m.joined_at ASC, p.created_at ASC LIMIT 1;
  SELECT name INTO _name FROM public.study_groups WHERE id = _group;
  IF _next IS NULL THEN
    UPDATE public.study_groups SET status = 'disbanded', manager_id = NULL, member_count = 0 WHERE id = _group;
  ELSE
    UPDATE public.study_groups SET manager_id = _next WHERE id = _group;
    PERFORM public.notify(_next, 'manager_transferred', jsonb_build_object('group_id', _group, 'group_name', _name));
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.assign_successor(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.leave_group(_group uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); g public.study_groups%ROWTYPE;
BEGIN
  SELECT * INTO g FROM public.study_groups WHERE id = _group FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'GROUP_UNAVAILABLE'; END IF;
  DELETE FROM public.study_group_members WHERE group_id = _group AND user_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_MEMBER'; END IF;
  UPDATE public.study_groups SET member_count = GREATEST(member_count - 1, 0) WHERE id = _group;
  IF g.manager_id = _uid THEN PERFORM public.assign_successor(_group); END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.remove_member(_group uuid, _member uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); g public.study_groups%ROWTYPE;
BEGIN
  SELECT * INTO g FROM public.study_groups WHERE id = _group FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'GROUP_UNAVAILABLE'; END IF;
  IF g.manager_id <> _uid THEN RAISE EXCEPTION 'NOT_MANAGER'; END IF;
  IF _member = _uid THEN RAISE EXCEPTION 'CANNOT_REMOVE_SELF'; END IF;
  DELETE FROM public.study_group_members WHERE group_id = _group AND user_id = _member;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_MEMBER'; END IF;
  UPDATE public.study_groups SET member_count = GREATEST(member_count - 1, 0) WHERE id = _group;
  PERFORM public.notify(_member, 'removed_from_group', jsonb_build_object('group_id', _group, 'group_name', g.name));
END; $$;

-- ===== management =====
CREATE OR REPLACE FUNCTION public.rename_group(_group uuid, _name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); g public.study_groups%ROWTYPE;
BEGIN
  SELECT * INTO g FROM public.study_groups WHERE id = _group FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'GROUP_UNAVAILABLE'; END IF;
  IF g.manager_id <> _uid THEN RAISE EXCEPTION 'NOT_MANAGER'; END IF;
  IF _name IS NULL OR char_length(btrim(_name)) < 1 OR char_length(_name) > 100 THEN RAISE EXCEPTION 'INVALID_NAME'; END IF;
  IF EXISTS (SELECT 1 FROM public.study_groups WHERE course_id = g.course_id AND lower(name) = lower(btrim(_name)) AND id <> _group AND status <> 'disbanded') THEN
    RAISE EXCEPTION 'NAME_TAKEN';
  END IF;
  UPDATE public.study_groups SET name = btrim(_name), updated_at = now() WHERE id = _group;
END; $$;

CREATE OR REPLACE FUNCTION public.set_group_mode(_group uuid, _mode public.group_mode)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); g public.study_groups%ROWTYPE; r RECORD; _approved int := 0; _remaining int;
BEGIN
  SELECT * INTO g FROM public.study_groups WHERE id = _group FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'GROUP_UNAVAILABLE'; END IF;
  IF g.manager_id <> _uid THEN RAISE EXCEPTION 'NOT_MANAGER'; END IF;
  UPDATE public.study_groups SET mode = _mode, updated_at = now() WHERE id = _group;
  IF _mode = 'open' THEN
    _remaining := g.capacity - g.member_count;
    FOR r IN SELECT * FROM public.join_requests WHERE group_id = _group AND status = 'pending' ORDER BY created_at ASC FOR UPDATE
    LOOP
      EXIT WHEN _approved >= _remaining;
      INSERT INTO public.study_group_members (group_id, user_id) VALUES (_group, r.user_id) ON CONFLICT DO NOTHING;
      UPDATE public.join_requests SET status = 'approved', updated_at = now() WHERE id = r.id;
      PERFORM public.notify(r.user_id, 'join_request_approved', jsonb_build_object('group_id', _group, 'group_name', g.name));
      _approved := _approved + 1;
    END LOOP;
    UPDATE public.study_groups SET member_count = g.member_count + _approved WHERE id = _group;
  END IF;
  RETURN _approved;
END; $$;

CREATE OR REPLACE FUNCTION public.disband_group(_group uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); g public.study_groups%ROWTYPE; m RECORD;
BEGIN
  SELECT * INTO g FROM public.study_groups WHERE id = _group FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'GROUP_UNAVAILABLE'; END IF;
  IF g.manager_id <> _uid THEN RAISE EXCEPTION 'NOT_MANAGER'; END IF;
  FOR m IN SELECT user_id FROM public.study_group_members WHERE group_id = _group LOOP
    PERFORM public.notify(m.user_id, 'group_disbanded', jsonb_build_object('group_id', _group, 'group_name', g.name));
  END LOOP;
  FOR m IN SELECT user_id FROM public.join_requests WHERE group_id = _group AND status = 'pending' LOOP
    PERFORM public.notify(m.user_id, 'join_request_denied', jsonb_build_object('group_id', _group, 'group_name', g.name));
  END LOOP;
  UPDATE public.join_requests SET status = 'denied', updated_at = now() WHERE group_id = _group AND status = 'pending';
  UPDATE public.group_invitations SET status = 'cancelled', updated_at = now() WHERE group_id = _group AND status = 'pending';
  UPDATE public.meetups SET cancelled = true, cancellation_reason = COALESCE(cancellation_reason, 'Group disbanded')
   WHERE group_id = _group AND scheduled_at > now() AND NOT cancelled;
  DELETE FROM public.study_group_members WHERE group_id = _group;
  UPDATE public.study_groups SET status = 'disbanded', member_count = 0, manager_id = NULL WHERE id = _group;
END; $$;

-- ===== chat =====
CREATE OR REPLACE FUNCTION public.post_group_message(_group uuid, _content text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _c text := btrim(_content);
BEGIN
  IF NOT public.is_group_member(_group, _uid) THEN RAISE EXCEPTION 'NOT_MEMBER'; END IF;
  IF _c IS NULL OR char_length(_c) < 1 OR char_length(_c) > 2000 THEN RAISE EXCEPTION 'INVALID_MESSAGE'; END IF;
  INSERT INTO public.group_messages (group_id, sender_id, content) VALUES (_group, _uid, _c) RETURNING id INTO _id;
  UPDATE public.study_groups SET last_activity_at = now() WHERE id = _group;
  RETURN _id;
END; $$;

-- ===== meetups =====
CREATE OR REPLACE FUNCTION public.create_meetup(_group uuid, _title text, _at timestamptz, _format public.meetup_format, _location text, _link text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; m RECORD; _gname text;
BEGIN
  IF NOT public.is_group_member(_group, _uid) THEN RAISE EXCEPTION 'NOT_MEMBER'; END IF;
  IF _title IS NULL OR char_length(btrim(_title)) < 1 OR char_length(_title) > 100 THEN RAISE EXCEPTION 'INVALID_TITLE'; END IF;
  IF _at IS NULL OR _at <= now() THEN RAISE EXCEPTION 'INVALID_TIME'; END IF;
  IF _format = 'online' AND (_link IS NULL OR btrim(_link) = '') THEN RAISE EXCEPTION 'LINK_REQUIRED'; END IF;
  IF _format = 'in_person' AND (_location IS NULL OR btrim(_location) = '') THEN RAISE EXCEPTION 'LOCATION_REQUIRED'; END IF;
  INSERT INTO public.meetups (group_id, creator_id, title, scheduled_at, format, location, meeting_link)
  VALUES (_group, _uid, btrim(_title), _at, _format, NULLIF(btrim(COALESCE(_location,'')),''), NULLIF(btrim(COALESCE(_link,'')),''))
  RETURNING id INTO _id;
  INSERT INTO public.meetup_attendance (meetup_id, user_id, status) VALUES (_id, _uid, 'attending');
  SELECT name INTO _gname FROM public.study_groups WHERE id = _group;
  FOR m IN SELECT user_id FROM public.study_group_members WHERE group_id = _group AND user_id <> _uid LOOP
    PERFORM public.notify(m.user_id, 'meetup_created', jsonb_build_object('group_id', _group, 'group_name', _gname, 'meetup_id', _id, 'title', btrim(_title)));
  END LOOP;
  UPDATE public.study_groups SET last_activity_at = now() WHERE id = _group;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_meetup(_meetup uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); mt public.meetups%ROWTYPE; g public.study_groups%ROWTYPE; m RECORD;
BEGIN
  SELECT * INTO mt FROM public.meetups WHERE id = _meetup;
  IF mt.id IS NULL THEN RAISE EXCEPTION 'MEETUP_NOT_FOUND'; END IF;
  SELECT * INTO g FROM public.study_groups WHERE id = mt.group_id FOR UPDATE;
  IF mt.creator_id <> _uid AND g.manager_id <> _uid THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  UPDATE public.meetups SET cancelled = true, cancellation_reason = NULLIF(btrim(COALESCE(_reason,'')),'') WHERE id = _meetup;
  FOR m IN SELECT user_id FROM public.study_group_members WHERE group_id = g.id AND user_id <> _uid LOOP
    PERFORM public.notify(m.user_id, 'meetup_cancelled', jsonb_build_object('group_id', g.id, 'group_name', g.name, 'meetup_id', _meetup, 'title', mt.title));
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.set_rsvp(_meetup uuid, _status public.rsvp_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _g uuid;
BEGIN
  SELECT group_id INTO _g FROM public.meetups WHERE id = _meetup;
  IF _g IS NULL THEN RAISE EXCEPTION 'MEETUP_NOT_FOUND'; END IF;
  IF NOT public.is_group_member(_g, _uid) THEN RAISE EXCEPTION 'NOT_MEMBER'; END IF;
  INSERT INTO public.meetup_attendance (meetup_id, user_id, status) VALUES (_meetup, _uid, _status)
  ON CONFLICT (meetup_id, user_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now();
END; $$;

-- ===== course helper =====
CREATE OR REPLACE FUNCTION public.upsert_course(_department text, _number text, _name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _uni uuid; _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT university_id INTO _uni FROM public.profiles WHERE id = _uid;
  IF _uni IS NULL THEN RAISE EXCEPTION 'NO_PROFILE'; END IF;
  SELECT id INTO _id FROM public.courses
   WHERE university_id = _uni AND upper(department) = upper(btrim(_department)) AND upper(number) = upper(btrim(_number));
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  INSERT INTO public.courses (university_id, department, number, name, created_by)
  VALUES (_uni, upper(btrim(_department)), upper(btrim(_number)), btrim(_name), _uid) RETURNING id INTO _id;
  RETURN _id;
END; $$;

-- ===== seed courses =====
INSERT INTO public.courses (university_id, department, number, name)
SELECT u.id, c.dept, c.num, c.nm FROM public.universities u,
(VALUES
 ('PHYS','1301W','Introductory Physics for Science and Engineering I'),
 ('PHYS','1302W','Introductory Physics for Science and Engineering II'),
 ('PHYS','2503','Physics III: Intro to Waves, Optics, and Special Relativity'),
 ('CHEM','1061','Chemical Principles I'),
 ('CHEM','1062','Chemical Principles II'),
 ('CHEM','1065','Chemical Principles I Laboratory'),
 ('CHEM','2301','Organic Chemistry I'),
 ('CHEM','2302','Organic Chemistry II'),
 ('CSCI','1133','Introduction to Computing and Programming Concepts'),
 ('CSCI','1913','Introduction to Algorithms, Data Structures, and Program Development'),
 ('CSCI','2011','Discrete Structures of Computer Science'),
 ('CSCI','2021','Machine Architecture and Organization'),
 ('CSCI','2033','Elementary Computational Linear Algebra'),
 ('CSCI','4041','Algorithms and Data Structures'),
 ('CSCI','4061','Introduction to Operating Systems'),
 ('CSCI','5525','Machine Learning: Analysis and Methods'),
 ('MATH','1271','Calculus I'),
 ('MATH','1272','Calculus II'),
 ('MATH','1371','CSE Calculus I'),
 ('MATH','1372','CSE Calculus II'),
 ('MATH','2243','Linear Algebra and Differential Equations'),
 ('MATH','2263','Multivariable Calculus'),
 ('MATH','2373','CSE Linear Algebra and Differential Equations'),
 ('MATH','2374','CSE Multivariable Calculus and Vector Analysis'),
 ('MATH','3283W','Sequences, Series, and Foundations'),
 ('BIOL','1009','General Biology'),
 ('BIOL','2002','Foundations of Biology Part I'),
 ('BIOL','2003','Foundations of Biology Part II'),
 ('STAT','3021','Introduction to Probability and Statistics'),
 ('STAT','3011','Introduction to Statistical Analysis'),
 ('ECON','1101','Principles of Microeconomics'),
 ('ECON','1102','Principles of Macroeconomics'),
 ('PSY','1001','Introduction to Psychology'),
 ('PSY','3001W','Introduction to Research Methods'),
 ('WRIT','1301','University Writing'),
 ('WRIT','3562W','Technical and Professional Writing'),
 ('AEM','2011','Statics'),
 ('CE','3101','Computer Applications in Civil Engineering'),
 ('EE','2001','Introduction to Circuits and Electronics'),
 ('ME','2011','Introduction to Engineering'),
 ('MATS','2001','Introduction to the Science of Engineering Materials'),
 ('IE','3011','Optimization and Simulation')
) AS c(dept, num, nm)
WHERE u.email_domain = 'umn.edu';
