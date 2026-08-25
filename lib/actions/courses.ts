/** 
 * Course actions — currently just "Add a missing course" (spec §5.5).
 *
 * This file stores the function that exported to add-course-dialog.tsx
 * where it is called when the user submits the "Add a Course" request.
 * As a result, this function redirects the user to gmail where they can then
 * review their request (this function transfers their filled out request into a neat email)
 * and then click send in gmail once ready.
 */

export type GmailComposeData = {
  department: string;
  course_number: string;
  course_name: string;
};

const DESTINATION_EMAIL = "goldysstudybuddies@gmail.com";

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform 
{
  const ua = navigator.userAgent || "";
  
  if(/iPhone|iPad|iPod/i.test(ua)){return "ios";}
  else if(/Android/i.test(ua)){return "android";}
  else{return "desktop";}
}

export async function openGmailCompose(data: GmailComposeData): Promise<void> 
{
  const userPlatform = detectPlatform();

  const subject = `ADD NEW COURSE REQUEST`;
  data.department = data.department.toUpperCase();
  data.course_number = data.course_number.toUpperCase();

  if(data.course_name === ""){data.course_name = 'NOT PROVIDED';}
  const body = `DEPARTMENT:\n${data.department}\n\nCOURSE NUMBER:\n${data.course_number}\n\nCOURSE NAME (Optional):\n${data.course_name}`;

  if(userPlatform === "desktop")
  {
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

  else
  {
    // mailto builds its query with encodeURIComponent, NOT URLSearchParams:
    // URLSearchParams encodes spaces as "+", which some mail apps show as
    // literal plus signs in the subject/body.
    const mailtoUrl =
      `mailto:${DESTINATION_EMAIL}` +
      `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    if(userPlatform === "android")
    {
      // ANDROID: googlegmail:// is an iOS-ONLY scheme — Android's Gmail
      // doesn't register it, so navigating to it sent people to the Play
      // Store "get the app" page even with Gmail installed. A plain
      // mailto: opens the user's default mail app (Gmail for almost
      // everyone) directly.
      window.location.href = mailtoUrl;
      return;
    }

    // iOS: try the Gmail app's compose scheme first; if the app isn't
    // installed the navigation silently fails and the page stays visible,
    // so a timer falls back to mailto (Apple Mail). If Gmail *does* open,
    // the tab hides — cancel the fallback.
    const appParams =
      `to=${encodeURIComponent(DESTINATION_EMAIL)}` +
      `&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    const fallbackTimer = window.setTimeout(() => {
      if(document.visibilityState === "visible"){window.location.href = mailtoUrl;}
    }, 1500);

    const cancelFallback = () => window.clearTimeout(fallbackTimer);
    window.addEventListener("blur", cancelFallback, { once: true });
    document.addEventListener("visibilitychange", () => {
        if(document.visibilityState === "hidden"){cancelFallback();}
      },
      {once: true}
    );

    window.location.href = `googlegmail://co?${appParams}`;
  }
}


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