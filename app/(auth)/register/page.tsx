/**
 * "Sign up" page. Since auth is Google-only (product decision,
 * 2026-08-06), signing up IS signing in — the first Google sign-in
 * creates the account and drops the student into onboarding. This page
 * exists because every marketing CTA says "Get started", and those
 * clicks deserve welcome copy, not a login form's "welcome back".
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleButton } from "@/components/auth/google-button";

export const metadata: Metadata = { title: "Sign up" };

export default function RegisterPage() {
  return (
    <Card>
      <CardContent>
        <h1 className="font-display text-2xl text-ink">Join Goldy&rsquo;s Study Buddies</h1>
        <p className="mt-1 mb-6 text-sm text-ink-muted">
          For University of Minnesota students — continue with your UMN
          Google account (the one ending in @umn.edu).
        </p>

        <GoogleButton next="/onboarding" />

        <p className="mt-6 text-center text-sm text-ink-muted">
          Been here before?{" "}
          <Link href="/login" className="font-medium text-maroon underline underline-offset-2">
            Sign in
          </Link>{" "}
          — it&rsquo;s the same button either way.
        </p>
      </CardContent>
    </Card>
  );
}
