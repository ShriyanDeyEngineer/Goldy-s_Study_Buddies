/**
 * The full notifications page (/notifications): everything, newest
 * first, unread highlighted, with "Mark all as read" (spec §5.13).
 * Clicking an item marks it read and navigates (same renderer as the
 * bell, so copy and destinations always match).
 */
import { getSessionProfile } from "@/lib/supabase/server";
import { markAllNotificationsReadAction } from "@/lib/actions/notifications";
import type { NotificationRow } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { NotificationList } from "./notification-list";
import { LiveRefresh } from "@/lib/hooks/use-live-refresh";
import Link from "next/link";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { supabase, profile } = await getSessionProfile();
  if (!profile) return null;

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const notifications = (data ?? []) as NotificationRow[];
  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Re-render this list the moment a notification for me is created
          or marked read — no manual refresh needed (bug report #8). */}
      <LiveRefresh table="notifications" filter={`recipient_id=eq.${profile.id}`} />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl text-ink">Notifications</h1>
        {hasUnread && (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="outline" size="sm">
              Mark all as read
            </Button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          title="All quiet for now"
          description="Group invitations, join requests, meetup changes, and friend requests will land here."
          action={
            <Button asChild>
              <Link href="/courses">Find a group</Link>
            </Button>
          }
        />
      ) : (
        <NotificationList notifications={notifications} />
      )}
    </div>
  );
}
