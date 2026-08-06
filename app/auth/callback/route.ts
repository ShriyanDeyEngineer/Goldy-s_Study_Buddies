/**
 * /auth/callback — where every external auth hop lands.
 *
 * Three kinds of traffic arrive here:
 *   1. Google OAuth returning with a ?code            → exchange for session
 *   2. Email links (confirm signup / reset password)  → same code exchange
 *   3. Failures — expired links, or the DATABASE TRIGGER rejecting a
 *      non-@umn.edu Google account → arrive as ?error… params
 *
 * The third case is the one to understand (spec pitfall #10): when
 * someone signs in with a personal Gmail, Supabase can't create the user
 * because our trigger raises EMAIL_DOMAIN_NOT_ALLOWED. Supabase masks
 * that as "Database error saving new user" in error_description. We
 * translate it to the friendly "Only @umn.edu accounts" message on the
 * login page — a raw database error must never be what a student sees.
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
  const errorCode = searchParams.get("error_code") ?? "";
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
    // Expired / already-used email links get the dedicated explainer page.
    if (errorCode === "otp_expired" || errorDescription.toLowerCase().includes("expired")) {
      return NextResponse.redirect(`${origin}/auth/auth-error?reason=expired`);
    }
    return NextResponse.redirect(`${origin}/auth/auth-error?reason=failed`);
  }

  // ── Success branch: trade the one-time code for a session ──────────
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // A code that won't exchange = link already used or expired.
    return NextResponse.redirect(`${origin}/auth/auth-error?reason=expired`);
  }

  // No code and no error — someone opened the URL by hand.
  return NextResponse.redirect(`${origin}/login`);
}
