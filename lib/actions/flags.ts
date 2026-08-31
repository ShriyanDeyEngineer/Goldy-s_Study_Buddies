/**
 * Content-flag server actions (migration 0040): thin validate → RPC →
 * translate-error, same pattern as every other write path. No
 * revalidatePath — the flag toggle is per-viewer optimistic state, and
 * the admin queue re-reads on its own load.
 */
"use server";

import { createClient } from "@/lib/supabase/server";
import { flagSchema } from "@/lib/validation/flag";
import { friendlyError } from "@/lib/errors";
import type { FlagContentType } from "@/lib/constants";

export async function flagContentAction(input: {
  contentType: FlagContentType;
  contentId: string;
  reason?: string;
}): Promise<{ error?: string }> {
  const parsed = flagSchema.safeParse({
    content_type: input.contentType,
    content_id: input.contentId,
    reason: input.reason?.trim() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Couldn't flag that." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("flag_content", {
    p_content_type: parsed.data.content_type,
    p_content_id: parsed.data.content_id,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) return { error: friendlyError(error) };
  return {};
}

export async function unflagContentAction(input: {
  contentType: FlagContentType;
  contentId: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unflag_content", {
    p_content_type: input.contentType,
    p_content_id: input.contentId,
  });
  if (error) return { error: friendlyError(error) };
  return {};
}
