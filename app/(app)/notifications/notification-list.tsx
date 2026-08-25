/**
 * Clickable notification rows: clicking marks read (if needed) then
 * navigates to the destination renderNotification() decided. The icon at
 * the row's edge toggles read/unread without navigating; the page's
 * LiveRefresh picks up the change (and the bell recounts via realtime).
 */
"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Mail, MailOpen } from "lucide-react";
import {
  markNotificationReadAction,
  setNotificationReadAction,
} from "@/lib/actions/notifications";
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

  async function toggleRead(notification: NotificationRow) {
    await setNotificationReadAction(notification.id, !notification.read_at);
    router.refresh();
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      {notifications.map((notification) => {
        const { message } = renderNotification(notification);
        return (
          <li
            key={notification.id}
            className={cn(
              "flex items-stretch",
              !notification.read_at && "bg-gold-light/30",
            )}
          >
            <button
              type="button"
              onClick={() => open(notification)}
              className="min-w-0 flex-1 px-4 py-3 text-left hover:bg-cream focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold"
            >
              <span className="block text-sm text-ink">{message}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                {!notification.read_at && (
                  <span className="ml-2 font-medium text-maroon">· new</span>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => toggleRead(notification)}
              aria-label={notification.read_at ? "Mark as unread" : "Mark as read"}
              title={notification.read_at ? "Mark as unread" : "Mark as read"}
              className="flex shrink-0 items-center px-4 text-ink-muted hover:text-maroon focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold"
            >
              {notification.read_at ? (
                <Mail aria-hidden className="h-4 w-4" />
              ) : (
                <MailOpen aria-hidden className="h-4 w-4" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
