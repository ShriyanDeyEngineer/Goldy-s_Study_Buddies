/**
 * New-password form: live checklist while typing; on failure the server
 * returns exactly the unmet rules (same contract as registration).
 */
"use client";

import * as React from "react";
import { useActionState } from "react";
import { resetPasswordAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordChecklist } from "@/components/auth/password-checklist";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, {});
  const [password, setPassword] = React.useState("");

  return (
    <form action={formAction} noValidate>
      <div className="mb-4">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!state.fieldErrors?.password}
          aria-describedby="password-errors"
        />
        <PasswordChecklist password={password} />
        {state.fieldErrors?.password && state.fieldErrors.password.length > 0 && (
          <ul id="password-errors" role="alert" className="mt-2 space-y-1">
            {state.fieldErrors.password.map((message) => (
              <li key={message} className="text-sm text-danger">
                {message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {state.error && (
        <p role="alert" className="mb-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" loading={pending}>
        Save new password
      </Button>
    </form>
  );
}
