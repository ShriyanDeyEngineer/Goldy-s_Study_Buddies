
-- ============ universities ============
CREATE TABLE public.universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email_domain text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.universities TO authenticated, anon;
GRANT ALL ON public.universities TO service_role;
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "universities readable" ON public.universities FOR SELECT USING (true);

INSERT INTO public.universities (name, email_domain) VALUES ('University of Minnesota', 'umn.edu');

-- ============ profiles ============
CREATE TYPE public.account_status AS ENUM ('active','suspended','banned');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  university_id uuid NOT NULL REFERENCES public.universities(id),
  email text NOT NULL,
  display_name text CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 50),
  college text,
  major text,
  bio text CHECK (bio IS NULL OR char_length(bio) <= 500),
  graduation_month smallint CHECK (graduation_month BETWEEN 1 AND 12),
  graduation_year smallint CHECK (graduation_year BETWEEN 2020 AND 2040),
  avatar_url text,
  social_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  privacy jsonb NOT NULL DEFAULT '{}'::jsonb,
  buddy_available boolean NOT NULL DEFAULT false,
  status public.account_status NOT NULL DEFAULT 'active',
  is_admin boolean NOT NULL DEFAULT false,
  onboarded_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_array_length(social_links) <= 5)
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- database-enforced domain allow-list (config = one universities row)
CREATE OR REPLACE FUNCTION public.enforce_university_domain()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uni public.universities%ROWTYPE;
BEGIN
  SELECT * INTO uni FROM public.universities
   WHERE is_active AND lower(NEW.email) LIKE '%@' || lower(email_domain)
   LIMIT 1;
  IF uni.id IS NULL THEN
    RAISE EXCEPTION 'EMAIL_DOMAIN_NOT_ALLOWED';
  END IF;
  NEW.university_id := uni.id;
  NEW.email := lower(NEW.email);
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_domain_check BEFORE INSERT OR UPDATE OF email ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_university_domain();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ courses ============
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id),
  department text NOT NULL,
  number text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university_id, department, number)
);
GRANT SELECT, INSERT ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses readable" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "courses insertable" ON public.courses FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE TYPE public.enrollment_type AS ENUM ('current','taken','future');
CREATE TABLE public.user_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrollment public.enrollment_type NOT NULL DEFAULT 'current',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id, enrollment)
);
GRANT SELECT, INSERT, DELETE ON public.user_courses TO authenticated;
GRANT ALL ON public.user_courses TO service_role;
ALTER TABLE public.user_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_courses readable" ON public.user_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "own user_courses insert" ON public.user_courses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own user_courses delete" ON public.user_courses FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ study groups ============
CREATE TYPE public.group_mode AS ENUM ('open','closed');
CREATE TYPE public.group_status AS ENUM ('active','inactive','archived','disbanded');
CREATE TYPE public.request_status AS ENUM ('pending','approved','denied','withdrawn','cancelled','accepted','declined');

CREATE TABLE public.study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  mode public.group_mode NOT NULL DEFAULT 'open',
  capacity int NOT NULL DEFAULT 8 CHECK (capacity BETWEEN 2 AND 50),
  member_count int NOT NULL DEFAULT 0,
  status public.group_status NOT NULL DEFAULT 'active',
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, name)
);
GRANT SELECT ON public.study_groups TO authenticated;
GRANT ALL ON public.study_groups TO service_role;
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups readable" ON public.study_groups FOR SELECT TO authenticated USING (true);

CREATE TABLE public.study_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
GRANT SELECT ON public.study_group_members TO authenticated;
GRANT ALL ON public.study_group_members TO service_role;
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members readable" ON public.study_group_members FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.study_group_members WHERE group_id = _group AND user_id = _user);
$$;

CREATE TABLE public.join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX join_requests_one_pending ON public.join_requests (group_id, user_id) WHERE status = 'pending';
GRANT SELECT ON public.join_requests TO authenticated;
GRANT ALL ON public.join_requests TO service_role;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "join requests visible to self or manager" ON public.join_requests FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.study_groups g WHERE g.id = group_id AND g.manager_id = auth.uid()));

CREATE TABLE public.group_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  invited_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX group_invitations_one_pending ON public.group_invitations (group_id, invited_user_id) WHERE status = 'pending';
GRANT SELECT ON public.group_invitations TO authenticated;
GRANT ALL ON public.group_invitations TO service_role;
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invitations visible to invitee or manager" ON public.group_invitations FOR SELECT TO authenticated
USING (invited_user_id = auth.uid() OR inviter_id = auth.uid());

-- ============ meetups ============
CREATE TYPE public.meetup_format AS ENUM ('online','in_person');
CREATE TYPE public.rsvp_status AS ENUM ('attending','maybe','not_attending');

CREATE TABLE public.meetups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  creator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  scheduled_at timestamptz NOT NULL,
  format public.meetup_format NOT NULL,
  location text,
  meeting_link text,
  cancelled boolean NOT NULL DEFAULT false,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((format = 'online' AND meeting_link IS NOT NULL AND char_length(meeting_link) > 0)
      OR (format = 'in_person' AND location IS NOT NULL AND char_length(location) > 0))
);
GRANT SELECT ON public.meetups TO authenticated;
GRANT ALL ON public.meetups TO service_role;
ALTER TABLE public.meetups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetups readable by members" ON public.meetups FOR SELECT TO authenticated
USING (public.is_group_member(group_id, auth.uid()));

CREATE TABLE public.meetup_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_id uuid NOT NULL REFERENCES public.meetups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.rsvp_status NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meetup_id, user_id)
);
GRANT SELECT ON public.meetup_attendance TO authenticated;
GRANT ALL ON public.meetup_attendance TO service_role;
ALTER TABLE public.meetup_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance readable by members" ON public.meetup_attendance FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.meetups m WHERE m.id = meetup_id AND public.is_group_member(m.group_id, auth.uid())));

-- ============ chat ============
CREATE TABLE public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX group_messages_group_time ON public.group_messages (group_id, created_at);
GRANT SELECT ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages readable by members" ON public.group_messages FOR SELECT TO authenticated
USING (public.is_group_member(group_id, auth.uid()));

-- ============ notifications ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_time ON public.notifications (user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
