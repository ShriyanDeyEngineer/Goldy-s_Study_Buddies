/**
 * Notification actions: marking read (single + all). Reads happen in
 * server components / the bell's realtime subscription; these are the
 * only writes users can make to notifications (RLS allows exactly the
 * read_at column on their own rows).
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const supabase = await createClient();
  // RLS scopes the update to the caller's own rows — a crafted id
  // belonging to someone else simply matches nothing.
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null);
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);
  revalidatePath("/notifications");
}
