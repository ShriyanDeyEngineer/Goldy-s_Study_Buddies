import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  courseSchema,
  groupSchema,
  meetupSchema,
  messageSchema,
  onboardingSchema,
  uuidSchema,
} from "./validation";
import { z } from "zod";

/** All writes flow through these server functions; the database routines own the invariants. */

export const saveOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => onboardingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string }).email ?? "";

    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email,
        university_id: "00000000-0000-0000-0000-000000000000",
        display_name: data.displayName,
        major: data.major || null,
        college: data.college || null,
        bio: data.bio || null,
        graduation_month: data.graduationMonth ?? null,
        graduation_year: data.graduationYear ?? null,
        onboarded_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);

    if (data.courseIds.length) {
      const rows = data.courseIds.map((course_id) => ({
        user_id: userId,
        course_id,
        enrollment: "current" as const,
      }));
      await supabase.from("user_courses").upsert(rows, {
        onConflict: "user_id,course_id,enrollment",
      });
    }
    return { ok: true };
  });

export const setEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        courseId: uuidSchema,
        enrolled: z.boolean(),
        enrollment: z.enum(["current", "taken", "future"]).default("current"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.enrolled) {
      const { error } = await supabase.from("user_courses").upsert(
        { user_id: userId, course_id: data.courseId, enrollment: data.enrollment },
        { onConflict: "user_id,course_id,enrollment" },
      );
      if (error) throw new Error(error.message);
    } else {
      await supabase
        .from("user_courses")
        .delete()
        .eq("user_id", userId)
        .eq("course_id", data.courseId)
        .eq("enrollment", data.enrollment);
    }
    return { ok: true };
  });

export const addCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => courseSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("upsert_course", {
      _department: data.department,
      _number: data.number,
      _name: data.name,
    });
    if (error) throw new Error(error.message);
    return { courseId: id as string };
  });

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => groupSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("create_study_group", {
      _course: data.courseId,
      _name: data.name,
      _capacity: data.capacity,
      _mode: data.mode,
      _invitees: data.invitees,
    });
    if (error) throw new Error(error.message);
    return { groupId: id as string };
  });

export const joinGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ groupId: uuidSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("join_or_request_group", {
      _group: data.groupId,
    });
    if (error) throw new Error(error.message);
    return { result: result as string };
  });

export const withdrawRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ groupId: uuidSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("withdraw_join_request", {
      _group: data.groupId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const decideRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ requestId: uuidSchema, approve: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("decide_join_request", {
      _request: data.requestId,
      _approve: data.approve,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const respondInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ invitationId: uuidSchema, accept: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("respond_invitation", {
      _invitation: data.invitationId,
      _accept: data.accept,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const leaveGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ groupId: uuidSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("leave_group", { _group: data.groupId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ groupId: uuidSchema, memberId: uuidSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("remove_member", {
      _group: data.groupId,
      _member: data.memberId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ groupId: uuidSchema, name: z.string().trim().min(1).max(100) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("rename_group", {
      _group: data.groupId,
      _name: data.name,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setGroupMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ groupId: uuidSchema, mode: z.enum(["open", "closed"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: approved, error } = await context.supabase.rpc("set_group_mode", {
      _group: data.groupId,
      _mode: data.mode,
    });
    if (error) throw new Error(error.message);
    return { approved: (approved as number) ?? 0 };
  });

export const disbandGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ groupId: uuidSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("disband_group", { _group: data.groupId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendGroupMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ groupId: uuidSchema, content: messageSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("post_group_message", {
      _group: data.groupId,
      _content: data.content,
    });
    if (error) throw new Error(error.message);
    return { messageId: id as string };
  });

export const createMeetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ groupId: uuidSchema })
      .and(meetupSchema)
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("create_meetup", {
      _group: data.groupId,
      _title: data.title,
      _at: data.scheduledAt,
      _format: data.format,
      _location: data.location ?? "",
      _link: data.meetingLink ?? "",
    });
    if (error) throw new Error(error.message);
    return { meetupId: id as string };
  });

export const cancelMeetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ meetupId: uuidSchema, reason: z.string().trim().max(500).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("cancel_meetup", {
      _meetup: data.meetupId,
      _reason: data.reason ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setRsvp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        meetupId: uuidSchema,
        status: z.enum(["attending", "maybe", "not_attending"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_rsvp", {
      _meetup: data.meetupId,
      _status: data.status,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
