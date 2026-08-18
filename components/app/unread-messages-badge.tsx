/**
 * The little red count on the "Messages" nav item — how many DMs are
 * waiting for you, updated live.
 *
 * WHY THIS IS ITS OWN COMPONENT: the nav is rendered twice (desktop
 * header + mobile bottom bar) from one LINKS array, and each copy needs
 * the same number. Putting the subscription HERE — and rendering the
 * component once per nav copy — would open two websocket channels. So
 * instead the count lives in a tiny shared store (a module-level
 * subscription + React's useSyncExternalStore) that both copies read
 * from, and only ONE channel is ever opened per page, no matter how many
 * badges are on screen. That honors the spec's "exactly one realtime
 * subscription per concern" rule.
 *
 * How the number stays right:
 *   - initial value: counted server-side and passed in (no flash of 0)
 *   - +1 on every INSERT into direct_messages addressed to me
 *   - re-counted whenever an UPDATE arrives (that's a message being
 *     marked read when I open a thread) — cheaper to recount than to
 *     track which ids I've seen
 *   - re-counted when the tab regains focus, as a belt-and-braces catch
 *     for anything the socket missed while the laptop was asleep
 *   - re-counted on EVERY route change. Opening a thread marks it read on
 *     the server; a fresh count on navigation reflects that instantly,
 *     without waiting on (or trusting) a websocket round-trip. Found in
 *     testing: with the socket blocked, the badge stayed at 3 after the
 *     thread was opened. One cheap HEAD query per navigation fixes it.
 */
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ── The shared store ─────────────────────────────────────────────────────

let currentCount = 0;
let currentUserId: string | null = null;
let listeners = new Set<() => void>();
let channelCleanup: (() => void) | null = null;

function emit() {
  for (const l of listeners) l();
}

async function recount(userId: string) {
  const supabase = createClient();
  const { count } = await supabase
    .from("direct_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .eq("is_read", false);
  currentCount = count ?? 0;
  emit();
}

/** Opens the single realtime channel the first time anyone subscribes;
 *  tears it down when the last badge unmounts. */
function ensureChannel(userId: string) {
  if (channelCleanup && currentUserId === userId) return;
  channelCleanup?.();
  currentUserId = userId;

  const supabase = createClient();
  const channel = supabase
    .channel(`dm-unread:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "direct_messages",
        filter: `recipient_id=eq.${userId}`,
      },
      () => {
        currentCount += 1;
        emit();
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "direct_messages",
        filter: `recipient_id=eq.${userId}`,
      },
      () => void recount(userId),
    )
    .subscribe();

  const onFocus = () => void recount(userId);
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onFocus);

  channelCleanup = () => {
    supabase.removeChannel(channel);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onFocus);
    channelCleanup = null;
    currentUserId = null;
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) channelCleanup?.();
  };
}

/** Read the live unread count. Safe to call from any number of
 *  components — they all share one subscription. */
export function useUnreadMessages(userId: string, initial: number): number {
  // Seed the store once so the very first paint shows the server's count.
  if (currentUserId !== userId) {
    currentCount = initial;
  }
  React.useEffect(() => {
    ensureChannel(userId);
  }, [userId]);

  // Recount on navigation (see header comment). Skipped on the very first
  // render because `initial` is already fresh from the server.
  const pathname = usePathname();
  const firstPath = React.useRef(pathname);
  React.useEffect(() => {
    if (pathname === firstPath.current) return;
    void recount(userId);
  }, [pathname, userId]);
  return React.useSyncExternalStore(
    subscribe,
    () => currentCount,
    () => initial,
  );
}

// ── The badge itself ─────────────────────────────────────────────────────

export function UnreadMessagesBadge({
  userId,
  initial,
  className,
}: {
  userId: string;
  initial: number;
  className?: string;
}) {
  const count = useUnreadMessages(userId, initial);
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} unread ${count === 1 ? "message" : "messages"}`}
      className={cn(
        "inline-flex min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4.5 text-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
