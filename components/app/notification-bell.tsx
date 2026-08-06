/**
 * The header notification bell: live unread badge, dropdown preview of
 * the latest notifications, "see all" link. Clicking an item marks it
 * read and navigates to the relevant page (spec §5.13).
 *
 * Realtime: subscribes to INSERTs on MY notifications (server-side
 * filter; RLS also guards delivery). Subscribed on mount, UNSUBSCRIBED on
 * unmount — and this component is mounted exactly once in the app header,
 * never duplicated for mobile (spec §8's duplicate-subscription rule).
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { renderNotification } from "@/lib/notifications";
import { markNotificationReadAction } from "@/lib/actions/notifications";
import type { NotificationRow } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function NotificationBell({
  userId,
  initialUnread,
}: {
  userId: string;
  initialUnread: number;
}) {
  const router = useRouter();
  const [unread, setUnread] = React.useState(initialUnread);
  const [items, setItems] = React.useState<NotificationRow[] | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const fresh = payload.new as NotificationRow;
          setUnread((count) => count + 1);
          // If the dropdown is already populated, prepend so an open
          // panel updates live too.
          setItems((existing) => (existing ? [fresh, ...existing].slice(0, 8) : existing));
        },
      )
      .subscribe();

    // Unsubscribe on unmount — a leaked channel would double-count
    // every future notification.
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  /** Load the dropdown's contents the first time it opens (not before —
   *  most page views never open the bell). */
  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && items === null) {
      const supabase = createClient();
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      setItems((data ?? []) as NotificationRow[]);
    }
  }

  async function handleClick(notification: NotificationRow) {
    const { href } = renderNotification(notification);
    setOpen(false);
    if (!notification.read_at) {
      setUnread((count) => Math.max(0, count - 1));
      setItems((existing) =>
        existing
          ? existing.map((n) =>
              n.id === notification.id
                ? { ...n, read_at: new Date().toISOString() }
                : n,
            )
          : existing,
      );
      await markNotificationReadAction(notification.id);
    }
    router.push(href);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
          }
        >
          <Bell aria-hidden className="h-5 w-5" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-sm font-medium text-ink">Notifications</span>
          <Link
            href="/notifications"
            className="text-xs text-maroon underline underline-offset-2"
            onClick={() => setOpen(false)}
          >
            See all
          </Link>
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {items === null ? (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">Loading…</li>
          ) : items.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">
              Nothing yet — when groups invite you or meetups change, it shows up here.
            </li>
          ) : (
            items.map((notification) => {
              const { message } = renderNotification(notification);
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(notification)}
                    className={cn(
                      "w-full px-4 py-3 text-left text-sm hover:bg-cream focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold",
                      !notification.read_at && "bg-gold-light/30",
                    )}
                  >
                    <span className="block text-ink">{message}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
