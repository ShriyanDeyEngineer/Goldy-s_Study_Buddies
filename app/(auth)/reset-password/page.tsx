/**
 * Set-a-new-password page, reached from the emailed reset link (the link
 * signs the user into a temporary recovery session; this page sets the
 * new password inside it). Uses the same live checklist as registration.
 */
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardContent>
        <h1 className="font-display text-2xl text-ink">Choose a new password</h1>
        <p className="mt-1 mb-6 text-sm text-ink-muted">
          Make it one you haven&rsquo;t used elsewhere.
        </p>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
