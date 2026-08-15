/**
 * Auth server actions. Sign-in is GOOGLE-ONLY by product decision
 * (2026-08-06, documented in the README): students use their UMN Google
 * account, so there are no passwords, no verification emails, and no
 * reset flows to maintain.
 *
 * Security decisions encoded here:
 *   - The Google `hd` hint below is UX only — a student can click
 *     "use another account" and pick a personal Gmail. The DATABASE
 *     TRIGGER (supabase/migrations/0001) is the real @umn.edu gate; its
 *     rejection surfaces as friendly copy via /auth/callback.
 *   - `next` redirect targets are laundered through safeInternalPath so
 *     the auth flow can't be used as an open redirect.
 */
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl, safeInternalPath } from "@/lib/site";
import { friendlyError } from "@/lib/errors";

/**
 * "Continue with UMN Google." Sends the hosted-domain hint so Google's
 * account chooser surfaces university accounts first, then hands off to
 * Google; the return trip lands in /auth/callback with a one-time code.
 */
export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const next = safeInternalPath(formData.get("next") as string | null);
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        hd: "umn.edu", // UX hint only — never a security boundary
        prompt: "select_account",
      },
    },
  });

  if (error || !data?.url) {
    redirect(`/login?error=${encodeURIComponent(friendlyError(error ?? ""))}`);
  }
  redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
