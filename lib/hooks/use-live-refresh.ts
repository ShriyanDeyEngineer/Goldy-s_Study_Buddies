/**
 * useLiveRefresh — makes a SERVER-rendered page update in real time.
 *
 * THE PROBLEM IT SOLVES: most of our lists (notifications page,
 * conversation list, dashboard cards) are fetched by Server Components.
 * That is the right architecture — no client state to keep in sync — but
 * it means the page shows whatever was true when it was requested. The
 * bell badge was live (it owns its own state) while the notifications
 * page behind it wasn't, which read as "notifications don't update until
 * I refresh." Same story for the messages list. This hook closes that
 * gap without abandoning server rendering.
 *
 * HOW: subscribe to Postgres change events on the given table (filtered
 * server-side to rows that concern the current user), and on every event
 * call router.refresh(). refresh() re-runs the Server Components for the
 * current route and swaps in the new HTML — no full reload, scroll
 * position kept, form inputs kept. RLS still governs which events the
 * socket can deliver, so nothing leaks.
 *
 * Debounced (250 ms) so a burst — e.g. disband notifying 12 members —
 * causes one refresh, not twelve.
 *
 * Also refreshes when the tab regains focus: a laptop that slept through
 * a socket disconnect catches up the moment you come back.
 *
 * Usage (in a client component mounted on the page):
 *   useLiveRefresh({ table: "notifications", filter: `recipient_id=eq.${userId}` });
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function useLiveRefresh({
  table,
  filter,
  /** Which change kinds to react to. Default: any. */
  event = "*",
  /** Set false to pause (e.g. while a form is mid-edit). */
  enabled = true,
}: {
  table: string;
  filter?: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  enabled?: boolean;
}) {
  const router = useRouter();

  React.useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    // Unique per (table, filter) so two hooks on one page never collide.
    const channel = supabase
      .channel(`live:${table}:${filter ?? "all"}`)
      .on(
        "postgres_changes",
        { event, schema: "public", table, ...(filter ? { filter } : {}) },
        scheduleRefresh,
      )
      .subscribe();

    const onWake = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    document.addEventListener("visibilitychange", onWake);

    return () => {
      // Unsubscribe on unmount — a leaked channel keeps refreshing a page
      // the user has already left.
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onWake);
      supabase.removeChannel(channel);
    };
  }, [table, filter, event, enabled, router]);
}

/**
 * Drop-in component form for Server Component pages that have no client
 * component of their own to host the hook:
 *   <LiveRefresh table="notifications" filter={`recipient_id=eq.${userId}`} />
 * Renders nothing.
 */
export function LiveRefresh(props: Parameters<typeof useLiveRefresh>[0]) {
  useLiveRefresh(props);
  return null;
}
