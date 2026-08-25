/**
 * Group-resource server actions (Resources section): thin validate →
 * RPC → revalidate, same pattern as every other write path.
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resourceSchema } from "@/lib/validation/resource";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/actions/types";

export async function addResourceAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resourceSchema.safeParse({
    group_id: formData.get("group_id"),
    kind: formData.get("kind"),
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_group_resource", {
    p_group_id: parsed.data.group_id,
    p_kind: parsed.data.kind,
    p_title: parsed.data.title,
    p_content: parsed.data.content,
  });
  if (error) return { error: friendlyError(error) };

  revalidatePath(`/groups/${parsed.data.group_id}`);
  return { success: "Added to the group's resources." };
}

export async function deleteResourceAction(
  resourceId: string,
  groupId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_group_resource", {
    p_resource_id: resourceId,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/groups/${groupId}`);
  return {};
}
