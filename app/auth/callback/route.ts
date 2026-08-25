/**
 * /auth/callback — where Google sends the student back after sign-in.
 *
 * Two kinds of traffic arrive here:
 *   1. Success: a ?code we exchange for a session, then redirect to
 *      wherever the student was headed (?next, laundered for safety).
 *   2. Failure params — most importantly the DATABASE TRIGGER rejecting
 *      a non-@umn.edu Google account (spec pitfall #10): when someone
 *      picks a personal Gmail in Google's chooser, Supabase can't create
 *      the user because our trigger raises EMAIL_DOMAIN_NOT_ALLOWED, and
 *      masks it as "Database error saving new user". We translate that
 *      to the friendly "Only @umn.edu accounts" message on the login
 *      page — a raw database error must never be what a student sees.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/site";
import { FRIENDLY_MESSAGES } from "@/lib/errors";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeInternalPath(searchParams.get("next"));

  // ── Failure branch ─────────────────────────────────────────────────
  const errorDescription = searchParams.get("error_description") ?? "";
  if (searchParams.get("error") || errorDescription) {
    // The domain trigger firing during a Google signup:
    if (
      errorDescription.includes("Database error saving new user") ||
      errorDescription.includes("EMAIL_DOMAIN_NOT_ALLOWED")
    ) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(FRIENDLY_MESSAGES.EMAIL_DOMAIN_NOT_ALLOWED)}`,
      );
    }
    // Anything else (student cancelled at Google, provider hiccup…).
    console.error(
      `[auth/callback] provider error: ${searchParams.get("error")} — ${errorDescription}`,
    );
    return NextResponse.redirect(`${origin}/auth/auth-error`);
  }

  // ── Success branch: trade the one-time code for a session ──────────
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // A code that won't exchange: already used, stale, or (most often)
    // the verifier cookie lives on a different host/browser than this
    // request — the log line is what tells those apart in production.
    console.error(`[auth/callback] code exchange failed on ${origin}: ${error.message}`);
    return NextResponse.redirect(`${origin}/auth/auth-error`);
  }

  // No code and no error — someone opened the URL by hand.
  return NextResponse.redirect(`${origin}/login`);
}
