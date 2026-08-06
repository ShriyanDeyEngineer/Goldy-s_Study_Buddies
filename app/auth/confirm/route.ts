/**
 * /auth/confirm — verifies email links that carry a token_hash directly.
 *
 * Supabase's DEFAULT email templates route through /auth/callback (code
 * exchange) and most installs only ever use that. This route exists for
 * the alternate template style ({{ .TokenHash }} links, which SETUP.md
 * mentions as an option) so that whichever template the team ends up
 * with, verification works. Same outcomes either way: session on
 * success, friendly explainer on expiry.
 */
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/site";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeInternalPath(
    searchParams.get("next"),
    type === "recovery" ? "/reset-password" : "/onboarding",
  );

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // verifyOtp failing = the link expired (24h) or was already used.
    return NextResponse.redirect(`${origin}/auth/auth-error?reason=expired`);
  }

  return NextResponse.redirect(`${origin}/auth/auth-error?reason=failed`);
}
