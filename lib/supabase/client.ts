/**
 * Supabase client for CLIENT components ("use client" files).
 *
 * Used by the realtime features (chat, DMs, the notification bell) and
 * anything else that talks to Supabase from the browser. It carries the
 * user's session automatically, and everything it can do is bounded by
 * row-level security — the anon key it uses is public by design.
 *
 * Server components/actions must use lib/supabase/server.ts instead
 * (browser clients can't read httpOnly auth cookies on the server).
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
