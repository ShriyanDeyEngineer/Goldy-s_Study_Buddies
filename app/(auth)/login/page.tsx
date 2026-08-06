/**
 * Sign-in page — both methods again (Google, then email/password).
 *
 * Also where OAuth failures land: /auth/callback redirects here with
 * ?error=<friendly text> (most importantly the "Only @umn.edu accounts"
 * message when someone tried a personal Gmail).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleButton, AuthDivider } from "@/components/auth/google-button";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <Card>
      <CardContent>
        <h1 className="font-display text-2xl text-ink">Welcome back</h1>
        <p className="mt-1 mb-6 text-sm text-ink-muted">Sign in to find your people.</p>

        {/* OAuth error handoff (e.g. non-UMN Google account rejected). */}
        {params.error && (
          <p role="alert" className="mb-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
            {params.error}
          </p>
        )}

        <GoogleButton next={params.next} />
        <AuthDivider />
        <LoginForm next={params.next} />

        <p className="mt-6 text-center text-sm text-ink-muted">
          New here?{" "}
          <Link href="/register" className="font-medium text-maroon underline underline-offset-2">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
