/**
 * Admin-only actions. Every one relies on database-side enforcement
 * (is_admin() in RLS policies / functions) — the server action is just
 * the doorway, same as everywhere else.
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

const REPORT_STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Move a report through its lifecycle. RLS's "admins update reports"
 *  policy (0007) is the enforcement; non-admins match zero rows. */
export async function setReportStatusAction(
  reportId: string,
  status: ReportStatus,
): Promise<{ error?: string }> {
  if (!REPORT_STATUSES.includes(status)) {
    return { error: friendlyError(null) };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", reportId);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin");
  return {};
}
