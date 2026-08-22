/**
 * Course actions — currently just "Add a missing course" (spec §5.5).
 *
 * The database's create_course() is find-or-create, so submitting a
 * course that already exists routes the student to the existing page
 * (with a friendly note) instead of erroring — that behavior is a spec
 * requirement, not a nicety.
 */

/*
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addCourseSchema } from "@/lib/validation/course";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/actions/types";

export async function addCourseAction(
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
  const { data, error } = await supabase.rpc("create_course", {
    p_department_code: parsed.data.department_code,
    p_course_number: parsed.data.course_number,
    p_course_name: parsed.data.course_name,
  });
  if (error) return { error: friendlyError(error) };

  // create_course returns one row: { course_id, created }.
  const row = (data as { course_id: string; created: boolean }[] | null)?.[0];
  if (!row) return { error: friendlyError(null) };

  redirect(`/courses/${row.course_id}${row.created ? "" : "?existing=1"}`);
}
*/


export type GmailComposeData = {
  department: string;
  course_number: string;
  course_name: string;
};

const DESTINATION_EMAIL = "goldysstudybuddies@gmail.com";

export async function openGmailCompose(data: GmailComposeData): Promise<void> {
  const subject = `ADD NEW COURSE REQUEST`;
  data.department = data.department.toUpperCase();
  if(data.course_name === ""){data.course_name = 'NOT PROVIDED';}
  const body = `DEPARTMENT:\n${data.department}\n\nCOURSE NUMBER:\n${data.course_number}\n\nCOURSE NAME (Optional):\n${data.course_name}`;

  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: DESTINATION_EMAIL,
    su: subject,
    body: body,
  });

  const gmailUrl = `https://mail.google.com/mail/?${params.toString()}`;

  window.open(gmailUrl, "_blank", "noopener,noreferrer");
}
