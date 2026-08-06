/**
 * Forgot-password page. Submitting always shows the same "if that email
 * has an account…" message — success and unknown-account are deliberately
 * indistinguishable (spec §5.2, no account enumeration).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardContent>
        <h1 className="font-display text-2xl text-ink">Reset your password</h1>
        <p className="mt-1 mb-6 text-sm text-ink-muted">
          Enter your UMN email and we&rsquo;ll send you a reset link.
        </p>
        <ForgotPasswordForm />
        <p className="mt-6 text-center text-sm text-ink-muted">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-maroon underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
