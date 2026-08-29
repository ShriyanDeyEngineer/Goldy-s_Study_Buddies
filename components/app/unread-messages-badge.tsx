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
 *     thread was opened. One cheap HEAD query per navigation fixes it —
 *     ONE, even though two badges are mounted (see lastRecountAt).
 *
 * The same channel also powers subscribeToMyDirectMessages() /
 * RefreshOnDirectMessages, so /messages can live-refresh its conversation
 * list without opening a second identical subscription on direct_messages.
 */
"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ── The shared store ─────────────────────────────────────────────────────

let currentCount = 0;
let currentUserId: string | null = null;
let listeners = new Set<() => void>();
let channelCleanup: (() => void) | null = null;

// Fired whenever the one shared channel sees a direct_messages change for
// the current user. Lets pages like /messages react to new DMs off the
// SAME subscription instead of opening a second identical one.
let changeListeners = new Set<() => void>();

// When the navigation-recount last actually ran. The nav renders TWO
// badges (desktop header + mobile bar) whose effects fire on the same
// route change microseconds apart; without this guard each runs its own
// COUNT. A real later navigation is always well outside the window, so it
// still recounts — even back to a path just visited.
let lastRecountAt = 0;

function emit() {
  for (const l of listeners) l();
}

function emitChange() {
  for (const l of changeListeners) l();
}

function teardownIfIdle() {
  if (listeners.size === 0 && changeListeners.size === 0) channelCleanup?.();
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
 *  tears it down once nothing is listening — no badge mounted AND no
 *  page-level DM-change subscriber (see teardownIfIdle). */
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
        emitChange();
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
      () => {
        void recount(userId);
        emitChange();
      },
    )
    .subscribe();

  const onFocus = () => {
    void recount(userId);
    emitChange();
  };
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
    teardownIfIdle();
  };
}

/**
 * Subscribe to "a direct message involving me just changed", riding the one
 * channel the unread badge already opens instead of a second identical
 * postgres_changes subscription. Returns an unsubscribe. A badge is always
 * mounted in the app nav, so the channel is already up — this just adds a
 * listener to it. Fires on: a new DM to me, one of mine to me being marked
 * read, and tab refocus (same triggers the old per-page channel had).
 */
export function subscribeToMyDirectMessages(userId: string, listener: () => void) {
  ensureChannel(userId);
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
    teardownIfIdle();
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
    // The sibling badge instance already recounted this same navigation.
    if (Date.now() - lastRecountAt < 200) return;
    lastRecountAt = Date.now();
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
  return (
    <>
      {/* Always mounted (unlike the visible pill below) so the live
          region's text actually changes on each update rather than
          mounting/unmounting, which some screen readers won't announce
          reliably. */}
      <span aria-live="polite" className="sr-only">
        {count > 0
          ? `${count} unread ${count === 1 ? "message" : "messages"}`
          : "No unread messages"}
      </span>
      {count > 0 && (
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4.5 text-white",
            className,
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </>
  );
}

/**
 * Drop-in for /messages: re-renders the server component when a DM to me
 * arrives or is marked read, reusing the unread badge's channel instead of
 * opening a second postgres_changes subscription on direct_messages with
 * the identical filter. Renders nothing. Debounced (250 ms) so a burst of
 * messages causes one refresh, matching the old useLiveRefresh behavior.
 */
export function RefreshOnDirectMessages({ userId }: { userId: string }) {
  const router = useRouter();
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToMyDirectMessages(userId, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [userId, router]);
  return null;
}
