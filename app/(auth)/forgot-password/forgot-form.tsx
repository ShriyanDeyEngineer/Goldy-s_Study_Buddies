/** The forgot-password form itself — see page.tsx for the privacy rule. */
"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, {});

  return (
    <form action={formAction} noValidate>
      <div className="mb-4">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="goldy@umn.edu"
          required
          aria-invalid={!!state.fieldErrors?.email}
          aria-describedby="email-error"
        />
        <FieldError id="email-error" error={state.fieldErrors?.email} />
      </div>

      {state.success && (
        <p role="status" className="mb-4 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
          {state.success}
        </p>
      )}

      <Button type="submit" className="w-full" loading={pending}>
        Send reset link
      </Button>
    </form>
  );
}
