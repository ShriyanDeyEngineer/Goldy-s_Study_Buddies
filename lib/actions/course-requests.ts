/**
 * Course requests: students file them in-app (no more email round trip);
 * admins review in /admin/requests — editing the fields if the student's
 * typing needs fixing — and approve (which creates the catalog entry and
 * notifies the requester) or decline (which also notifies).
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addCourseSchema } from "@/lib/validation/course";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/actions/types";

export async function createCourseRequestAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = addCourseSchema.safeParse({
    department_code: formData.get("department_code"),
    course_number: formData.get("course_number"),
    course_name: formData.get("course_name"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_course_request", {
    p_department_code: parsed.data.department_code,
    p_course_number: parsed.data.course_number,
    p_course_name: parsed.data.course_name,
  });
  if (error) return { error: friendlyError(error) };

  return {
    success: "Request sent — an admin will review it and you'll get a notification either way.",
  };
}

/** Admin approval, with the (possibly edited) final field values. */
export async function approveCourseRequestAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const requestId = String(formData.get("request_id") ?? "");
  const parsed = addCourseSchema.safeParse({
    department_code: formData.get("department_code"),
    course_number: formData.get("course_number"),
    course_name: formData.get("course_name"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_course_request", {
    p_request_id: requestId,
    p_department_code: parsed.data.department_code,
    p_course_number: parsed.data.course_number,
    p_course_name: parsed.data.course_name,
  });
  if (error) return { error: friendlyError(error) };

  revalidatePath("/admin/requests");
  return { success: "Approved — the course is in the catalog and the student was notified." };
}

export async function declineCourseRequestAction(
  requestId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_course_request", {
    p_request_id: requestId,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/requests");
  return {};
}
