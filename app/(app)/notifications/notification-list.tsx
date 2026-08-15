/**
 * Clickable notification rows: clicking marks read (if needed) then
 * navigates to the destination renderNotification() decided.
 */
"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { markNotificationReadAction } from "@/lib/actions/notifications";
import { renderNotification } from "@/lib/notifications";
import type { NotificationRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NotificationList({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();

  async function open(notification: NotificationRow) {
    const { href } = renderNotification(notification);
    if (!notification.read_at) {
      await markNotificationReadAction(notification.id);
    }
    router.push(href);
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      {notifications.map((notification) => {
        const { message } = renderNotification(notification);
        return (
          <li key={notification.id}>
            <button
              type="button"
              onClick={() => open(notification)}
              className={cn(
                "w-full px-4 py-3 text-left hover:bg-cream focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold",
                !notification.read_at && "bg-gold-light/30",
              )}
            >
              <span className="block text-sm text-ink">{message}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                {!notification.read_at && (
                  <span className="ml-2 font-medium text-maroon">· new</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
