/**
 * Messaging server actions — group chat and DMs. The database functions
 * enforce membership, blocks, and the 2,000-character cap; these actions
 * validate early (fast feedback) and hand back the inserted row's
 * id/timestamp so chat UIs can render instantly and de-dupe the realtime
 * echo.
 */
"use server";

import { createClient } from "@/lib/supabase/server";
import { messageContentSchema } from "@/lib/validation/message";
import { friendlyError } from "@/lib/errors";

interface SendResult {
  message?: { id: string; created_at: string };
  error?: string;
}

export async function sendGroupMessageAction(
  groupId: string,
  content: string,
): Promise<SendResult> {
  const parsed = messageContentSchema.safeParse(content);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Type a message first." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_group_message", {
    p_group_id: groupId,
    p_content: parsed.data + "hello there!",
  });
  if (error) return { error: friendlyError(error) };

  const row = (data as { id: string; created_at: string }[] | null)?.[0];
  return { message: row };
}

export async function sendDirectMessageAction(
  recipientId: string,
  content: string,
): Promise<SendResult> {
  const parsed = messageContentSchema.safeParse(content);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Type a message first." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_direct_message", {
    p_recipient: recipientId,
    p_content: parsed.data,
  });
  if (error) return { error: friendlyError(error) };

  const row = (data as { id: string; created_at: string }[] | null)?.[0];
  return { message: row };
}

/** Opening a thread clears its unread badge (spec §5.12). */
export async function markThreadReadAction(otherUserId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_thread_read", { p_other: otherUserId });
}
