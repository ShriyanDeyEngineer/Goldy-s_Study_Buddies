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

  else if(userPlatform === "ios")
  {
    const appParams = new URLSearchParams({
      to: DESTINATION_EMAIL,
      subject: subject,
      body: body,
    });

    const mailtoParams = new URLSearchParams({
        subject: subject,
        body: body,
      });

    // If the Gmail app isn't installed, this silently fails and the
    // page stays visible — so we set a fallback timer.
    const fallbackTimer = window.setTimeout(() => {
      if(document.visibilityState === "visible"){window.location.href = `mailto:${DESTINATION_EMAIL}?${mailtoParams.toString()}`;}
    }, 1500);

    // If the Gmail app *does* open, the tab will blur/hide — cancel the fallback.
    const cancelFallback = () => window.clearTimeout(fallbackTimer);
    window.addEventListener("blur", cancelFallback, { once: true });
    document.addEventListener("visibilitychange", () => {
        if(document.visibilityState === "hidden"){cancelFallback();}
      },
      {once: true}
    );

    // Attempt to open the native Gmail app
    window.location.href = `googlegmail://co?${appParams.toString()}`;
  }

  else if(userPlatform === "android")
  {
    const appParams = new URLSearchParams({
      to: DESTINATION_EMAIL,
      subject: subject,
      body: body,
    });

    const mailtoParams = new URLSearchParams({
      subject: subject,
      body: body,
    });
    const mailtoFallback = `mailto:${DESTINATION_EMAIL}?${mailtoParams.toString()}`;

    // Android Chrome ignores bare custom schemes (e.g. "googlegmail://") on
    // top-level navigation — no app opens and no error is raised, so a
    // blur/visibilitychange + setTimeout fallback (as used for iOS above)
    // isn't reliable here: the OS intent handoff itself can fire "blur"
    // even when no handler is found, cancelling the fallback before it runs.
    // "intent://" URLs are Chrome's supported mechanism for this: it tries
    // the native app and natively falls back to browser_fallback_url if the
    // app isn't installed, with no timers required.
    const intentUrl = `intent://co?${appParams.toString()}#Intent;scheme=googlegmail;package=com.google.android.gm;S.browser_fallback_url=${encodeURIComponent(mailtoFallback)};end`;

    window.location.href = intentUrl;
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