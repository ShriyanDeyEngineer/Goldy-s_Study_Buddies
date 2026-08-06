/**
 * Auth server actions: register, sign in (password + Google), sign out,
 * resend verification, forgot/reset password.
 *
 * Security decisions encoded here (each is a spec requirement):
 *   - Login failures return ONE generic message, whichever field was
 *     wrong — nobody can probe which emails have accounts.
 *   - Forgot-password answers identically whether or not the account
 *     exists, for the same reason.
 *   - The Google `hd` hint is UX only; the database trigger is the real
 *     domain gate, and its rejection surfaces as friendly copy.
 *   - `next` redirect targets are laundered through safeInternalPath so
 *     auth flows can't be used as an open redirect.
 */
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl, safeInternalPath } from "@/lib/site";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/actions/types";

/** Spec §5.2: the one message every failed login gets. */
const LOGIN_FAILED = "Email or password is incorrect.";

/** Spec §5.2: the one answer every forgot-password request gets. */
const RESET_SENT =
  "If that email has an account, a reset link is on its way. Check your inbox.";

export async function signUpAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // After clicking the confirmation email, land in onboarding.
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    // friendlyError translates the domain-trigger rejection; anything else
    // gets the generic apology (never raw Supabase text).
    return { error: friendlyError(error) };
  }

  // Anti-enumeration quirk worth knowing: when the email ALREADY has a
  // confirmed account, Supabase doesn't error — `data` comes back with a
  // user that has no identities, and no email is sent. We proceed to the
  // "check your email" screen either way, so the register form can't be
  // used to test which addresses have accounts.
  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function signInAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Unverified accounts are the one case we do distinguish: the owner
    // proved control of the inbox is pending, and a dead-end "incorrect"
    // message would strand them. This doesn't leak existence to attackers
    // any more than the verification email itself does.
    if (error.message.toLowerCase().includes("not confirmed")) {
      redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
    }
    return { error: LOGIN_FAILED };
  }

  // Best-effort bookkeeping; never block a login over it.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id);
  }

  redirect(safeInternalPath(formData.get("next") as string | null));
}

/**
 * "Continue with UMN Google." Sends the hosted-domain hint so Google's
 * chooser surfaces university accounts first — but that hint is COSMETIC
 * (a student can click "use another account"). If a non-@umn.edu account
 * comes back, the database trigger rejects the signup and the callback
 * route shows the friendly domain message.
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

/** Re-send the confirmation email (verification links die after 24h). */
export async function resendVerificationAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address." };

  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/onboarding`,
    },
  });
  // Same reply whether or not the address exists — no enumeration.
  return { success: "If that email needs verifying, a fresh link is on its way." };
}

export async function forgotPasswordAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  // Deliberately ignoring the response: success and "no such account"
  // must be indistinguishable to the person asking (spec §5.2).
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password`,
  });

  return { success: RESET_SENT };
}

export async function resetPasswordAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    // Exactly the unmet password rules, nothing else.
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        "This reset link is no longer valid. Request a fresh one from the sign-in page.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.message.toLowerCase().includes("different from the old")) {
      return { error: "That's already your password — pick a new one." };
    }
    return { error: friendlyError(error) };
  }

  redirect("/dashboard");
}
