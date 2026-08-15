/**
 * People-to-people server actions: friends, study buddies, blocking, and
 * reporting. Every rule (duplicates, blocks, atomicity, silence on
 * decline) lives in the database functions from migrations 0003/0007 —
 * these actions just call them and translate errors.
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reportSchema } from "@/lib/validation/report";
import { friendlyError } from "@/lib/errors";
import { adminEmail, sendEmail } from "@/lib/email";
import type { ActionResult } from "@/lib/actions/types";

type Simple = { error?: string };

/** Refresh the pages where a relationship change is visible. */
function revalidatePeoplePaths(otherUserId: string) {
  revalidatePath(`/profile/${otherUserId}`);
  revalidatePath("/friends");
  revalidatePath("/people");
}

export async function sendFriendRequestAction(userId: string): Promise<Simple> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_friend_request", { p_recipient: userId });
  if (error) return { error: friendlyError(error) };
  revalidatePeoplePaths(userId);
  return {};
}

export async function respondFriendRequestAction(
  requestId: string,
  accept: boolean,
): Promise<Simple> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_friend_request", {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/friends");
  revalidatePath("/notifications");
  return {};
}

export async function cancelFriendRequestAction(requestId: string): Promise<Simple> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_friend_request", {
    p_request_id: requestId,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/friends");
  return {};
}

export async function removeFriendAction(userId: string): Promise<Simple> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_friend", { p_other: userId });
  if (error) return { error: friendlyError(error) };
  revalidatePeoplePaths(userId);
  return {};
}

export async function sendBuddyRequestAction(userId: string): Promise<Simple> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_buddy_request", { p_recipient: userId });
  if (error) return { error: friendlyError(error) };
  revalidatePeoplePaths(userId);
  return {};
}

export async function respondBuddyRequestAction(
  requestId: string,
  accept: boolean,
): Promise<Simple> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_buddy_request", {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/friends");
  revalidatePath("/notifications");
  return {};
}

export async function cancelBuddyRequestAction(requestId: string): Promise<Simple> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_buddy_request", {
    p_request_id: requestId,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/friends");
  return {};
}

export async function disconnectBuddyAction(userId: string): Promise<Simple> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("disconnect_buddy", { p_other: userId });
  if (error) return { error: friendlyError(error) };
  revalidatePeoplePaths(userId);
  return {};
}

export async function blockUserAction(userId: string): Promise<Simple> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("block_user", { p_target: userId });
  if (error) return { error: friendlyError(error) };
  revalidatePeoplePaths(userId);
  revalidatePath("/messages");
  return {};
}

export async function unblockUserAction(userId: string): Promise<Simple> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unblock_user", { p_target: userId });
  if (error) return { error: friendlyError(error) };
  revalidatePeoplePaths(userId);
  return {};
}

/**
 * File a report (spec §5.14). Stored for team review always; ALSO emailed
 * to the admin inbox when email is configured — and silently not when it
 * isn't (optional integrations must never crash the flow).
 */
export async function reportUserAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = reportSchema.safeParse({
    reported_user_id: formData.get("reported_user_id"),
    category: formData.get("category"),
    description: String(formData.get("description") ?? "") || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: reportId, error } = await supabase.rpc("report_user", {
    p_user: parsed.data.reported_user_id,
    p_category: parsed.data.category,
    p_description: parsed.data.description ?? null,
  });
  if (error) return { error: friendlyError(error) };

  const admin = adminEmail();
  if (admin) {
    await sendEmail({
      to: admin,
      subject: `[Goldy's Study Buddies] New ${parsed.data.category} report`,
      text:
        `A new report was filed (id ${reportId}).\n\n` +
        `Category: ${parsed.data.category}\n` +
        `Description: ${parsed.data.description ?? "(none)"}\n\n` +
        `Review it in the Supabase dashboard (reports table).`,
    });
  }

  return {
    success:
      "Thanks — your report is in. The team reviews every report; you won't hear back unless we need more details.",
  };
}
