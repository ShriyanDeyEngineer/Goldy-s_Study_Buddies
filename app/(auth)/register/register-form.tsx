/**
 * The email/password registration form.
 *
 * What it does beyond a plain form:
 *   - live password checklist (each rule greens as you type)
 *   - show/hide password toggle
 *   - on failure, the server returns EXACTLY the unmet rules and they
 *     render under the password field, one per line
 */
"use client";

import * as React from "react";
import { useActionState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { signUpAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { FieldError } from "@/components/ui/field-error";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(signUpAction, {});
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <form action={formAction} noValidate>
      <div className="mb-4">
        <Label htmlFor="email">UMN email</Label>
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

      <div className="mb-4">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            className="pr-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!state.fieldErrors?.password}
            aria-describedby="password-errors"
          />
          {/* Our Button defaults to type="button", so this can never
              accidentally submit the form (spec pitfall #2). */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-10 w-10 text-ink-muted"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>

        <PasswordChecklist password={password} />

        {/* Submission failed? List exactly the unmet rules, nothing else. */}
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
        Create account
      </Button>
      <p className="mt-3 text-center text-xs text-ink-muted">
        We&rsquo;ll send a verification link to your inbox — it&rsquo;s valid for 24 hours.
      </p>
    </form>
  );
}
