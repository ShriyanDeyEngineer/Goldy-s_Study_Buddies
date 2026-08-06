/**
 * Email/password sign-in form. A failed attempt shows ONE generic
 * message no matter which field was wrong — never "no such account",
 * never "wrong password" (spec §5.2, anti-enumeration).
 */
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, {});

  return (
    <form action={formAction} noValidate>
      {/* Carry the post-login destination through the round trip. */}
      {next && <input type="hidden" name="next" value={next} />}

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

      <div className="mb-1">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!state.fieldErrors?.password}
          aria-describedby="password-error"
        />
        <FieldError id="password-error" error={state.fieldErrors?.password} />
      </div>

      <div className="mb-4 text-right">
        <Link
          href="/forgot-password"
          className="text-sm text-maroon underline underline-offset-2"
        >
          Forgot your password?
        </Link>
      </div>

      {state.error && (
        <p role="alert" className="mb-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
