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

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl, safeInternalPath, TERMS_VERSION } from "@/lib/site";

/**
 * The origin the CURRENT request arrived on — not the canonical
 * NEXT_PUBLIC_SITE_URL. The OAuth code exchange needs a verifier cookie
 * set on the host where sign-in STARTED, so the round trip must end on
 * that same host: a student on the LAN URL or a preview deployment who
 * got bounced back to the canonical host had no cookie there, and their
 * sign-in died as "interrupted". Supabase's redirect allow-list still
 * has the final say — an unlisted origin falls back to the Site URL,
 * which is today's behavior, never anything worse.
 */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return getSiteUrl();
  const proto =
    h.get("x-forwarded-proto") ??
    (/^(localhost|127\.|192\.168\.|10\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
import { friendlyError } from "@/lib/errors";

/**
 * "Continue with UMN Google." Sends the hosted-domain hint so Google's
 * account chooser surfaces university accounts first, then hands off to
 * Google; the return trip lands in /auth/callback with a one-time code.
 */
export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const next = safeInternalPath(formData.get("next") as string | null);

  // Terms acceptance is checked HERE, not just by the disabled button —
  // a form post without accept_terms=yes never reaches Google.
  if (formData.get("accept_terms") !== "yes") {
    const errorPath = safeInternalPath(
      formData.get("error_path") as string | null,
      "/login",
    );
    redirect(
      `${errorPath}?error=${encodeURIComponent("Please accept the Terms of Service to continue.")}`,
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
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

/**
 * "I agree" on the re-consent screen the app layout shows when a signed-in
 * user's stored terms_version is behind the current TERMS_VERSION (the
 * legal documents changed since they last accepted). Records the fresh
 * acceptance and drops them back into the app.
 */
export async function acceptCurrentTermsAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase.rpc("record_terms_acceptance", { p_version: TERMS_VERSION });
  redirect("/dashboard");
}
