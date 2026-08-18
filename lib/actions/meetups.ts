/**
 * Meetup + availability-poll server actions. Same shape as groups:
 * zod validates the form, the database function owns the rule.
 *
 * Timezone note (spec pitfall #8): scheduled_at arrives here as a UTC
 * ISO string — the browser already converted the student's local
 * datetime-local input (see meetup-form-dialog.tsx). The server NEVER
 * interprets wall-clock text.
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  availabilityPollSchema,
  cancelMeetupSchema,
  meetupSchema,
  rsvpSchema,
} from "@/lib/validation/meetup";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/actions/types";

export async function createMeetupAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = meetupSchema.safeParse({
    group_id: formData.get("group_id"),
    title: formData.get("title"),
    scheduled_at: formData.get("scheduled_at"),
    duration_minutes: formData.get("duration_minutes"),
    format: formData.get("format"),
    location: String(formData.get("location") ?? "") || undefined,
    meeting_link: String(formData.get("meeting_link") ?? "") || undefined,
  });
  if (!parsed.success) {
    // superRefine reported every invalid field separately — pass them all
    // through so the form shows every error simultaneously (§5.8).
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_meetup", {
    p_group_id: parsed.data.group_id,
    p_title: parsed.data.title,
    p_scheduled_at: parsed.data.scheduled_at,
    p_format: parsed.data.format,
    p_location: parsed.data.location ?? null,
    p_meeting_link: parsed.data.meeting_link ?? null,
    p_duration_minutes: parsed.data.duration_minutes,
  });
  if (error) return { error: friendlyError(error) };

  revalidatePath(`/groups/${parsed.data.group_id}`);
  return { success: "Meetup scheduled!" };
}

export async function cancelMeetupAction(
  meetupId: string,
  groupId: string,
  reason?: string,
): Promise<{ error?: string }> {
  const parsed = cancelMeetupSchema.safeParse({ meetup_id: meetupId, reason });
  if (!parsed.success) return { error: "Something went wrong." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_meetup", {
    p_meetup_id: parsed.data.meetup_id,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/groups/${groupId}`);
  return {};
}

export async function rsvpAction(
  meetupId: string,
  groupId: string,
  status: "attending" | "maybe" | "not_attending",
): Promise<{ error?: string }> {
  const parsed = rsvpSchema.safeParse({ meetup_id: meetupId, status });
  if (!parsed.success) return { error: "Something went wrong." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_meetup_rsvp", {
    p_meetup_id: parsed.data.meetup_id,
    p_status: parsed.data.status,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/groups/${groupId}`);
  return {};
}

export async function createAvailabilityPollAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  // Slots travel as one JSON field (variable count doesn't map cleanly
  // onto flat FormData).
  let slots: unknown;
  try {
    slots = JSON.parse(String(formData.get("slots") ?? "[]"));
  } catch {
    return { fieldErrors: { slots: ["Add at least two time options."] } };
  }

  const parsed = availabilityPollSchema.safeParse({
    group_id: formData.get("group_id"),
    title: formData.get("title"),
    slots,
  });
  if (!parsed.success) {
    // Slot errors carry index paths (slots.2.…); flatten() folds them into
    // the "slots" key, which the poll form shows as its shared error line.
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_availability_poll", {
    p_group_id: parsed.data.group_id,
    p_title: parsed.data.title,
    p_slots: parsed.data.slots,
  });
  if (error) return { error: friendlyError(error) };

  revalidatePath(`/groups/${parsed.data.group_id}`);
  return { success: "Poll created — time to vote!" };
}

export async function voteAvailabilityAction(
  slotId: string,
  groupId: string,
  available: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("vote_availability", {
    p_slot_id: slotId,
    p_available: available,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/groups/${groupId}`);
  return {};
}

export async function closeAvailabilityPollAction(
  pollId: string,
  groupId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_availability_poll", { p_poll_id: pollId });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/groups/${groupId}`);
  return {};
}
