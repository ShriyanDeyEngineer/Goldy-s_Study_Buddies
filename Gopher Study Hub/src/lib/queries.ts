import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Read layer — all reads go through RLS with the signed-in user's session. */

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const coursesQuery = () =>
  queryOptions({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, department, number, name")
        .eq("is_active", true)
        .order("department")
        .order("number");
      if (error) throw error;
      return data ?? [];
    },
  });

export const myCoursesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["my-courses", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_courses")
        .select("course_id, enrollment, courses(id, department, number, name)")
        .eq("user_id", userId);
      if (error) throw error;
      return data ?? [];
    },
  });

export const groupsForCourseQuery = (courseId: string) =>
  queryOptions({
    queryKey: ["groups", "course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_groups")
        .select("id, name, capacity, member_count, mode, status, manager_id, course_id")
        .eq("course_id", courseId)
        .eq("status", "active")
        .order("last_activity_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const myGroupsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["my-groups", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_group_members")
        .select(
          "group_id, study_groups(id, name, capacity, member_count, mode, status, manager_id, courses(id, department, number, name))",
        )
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).filter((row) => row.study_groups?.status === "active");
    },
  });

export const groupQuery = (groupId: string) =>
  queryOptions({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_groups")
        .select(
          "id, name, capacity, member_count, mode, status, manager_id, course_id, courses(id, department, number, name)",
        )
        .eq("id", groupId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const groupMembersQuery = (groupId: string) =>
  queryOptions({
    queryKey: ["group-members", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_group_members")
        .select("user_id, joined_at, profiles(id, display_name, major, avatar_url)")
        .eq("group_id", groupId)
        .order("joined_at");
      if (error) throw error;
      return data ?? [];
    },
  });

export const groupMessagesQuery = (groupId: string) =>
  queryOptions({
    queryKey: ["group-messages", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_messages")
        .select("id, content, created_at, sender_id, profiles(display_name, avatar_url)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

export const pendingRequestsQuery = (groupId: string) =>
  queryOptions({
    queryKey: ["join-requests", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("join_requests")
        .select("id, user_id, created_at, profiles(display_name, major)")
        .eq("group_id", groupId)
        .eq("status", "pending")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

export const myRequestQuery = (groupId: string, userId: string) =>
  queryOptions({
    queryKey: ["my-request", groupId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("join_requests")
        .select("id, status")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .eq("status", "pending")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const meetupsQuery = (groupId: string) =>
  queryOptions({
    queryKey: ["meetups", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetups")
        .select(
          "id, title, scheduled_at, format, location, meeting_link, cancelled, cancellation_reason, creator_id, meetup_attendance(user_id, status)",
        )
        .eq("group_id", groupId)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const notificationsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, payload, read_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

export const myInvitationsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["invitations", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_invitations")
        .select("id, group_id, created_at, study_groups(name, courses(department, number))")
        .eq("invited_user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
