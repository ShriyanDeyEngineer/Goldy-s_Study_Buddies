/**
 * The "Resend verification email" button. If we arrived here without an
 * email in the URL (deep link, cleared history), it asks for the address
 * first. Always answers with the same neutral confirmation.
 */
"use client";

import { useActionState } from "react";
import { resendVerificationAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResendForm({ email }: { email?: string }) {
  const [state, formAction, pending] = useActionState(resendVerificationAction, {});

  return (
    <form action={formAction} className="space-y-3">
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <div className="text-left">
          <Label htmlFor="email">Your UMN email</Label>
          <Input id="email" name="email" type="email" placeholder="goldy@umn.edu" required />
        </div>
      )}

      {state.success && (
        <p role="status" className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
          {state.success}
        </p>
      )}
      {state.error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <Button type="submit" variant="secondary" loading={pending}>
        Resend verification email
      </Button>
    </form>
  );
}
