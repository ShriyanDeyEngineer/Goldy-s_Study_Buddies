/**
 * Registration page — both sign-up methods, clearly separated:
 * UMN Google on top, email + password below (with the live checklist).
 * The interactive form lives in register-form.tsx; this server component
 * just frames it.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleButton, AuthDivider } from "@/components/auth/google-button";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Sign up" };

export default function RegisterPage() {
  return (
    <Card>
      <CardContent>
        <h1 className="font-display text-2xl text-ink">Join Goldy&rsquo;s Study Buddies</h1>
        <p className="mt-1 mb-6 text-sm text-ink-muted">
          For University of Minnesota students — sign up with your @umn.edu account.
        </p>

        <GoogleButton next="/onboarding" />
        <AuthDivider />
        <RegisterForm />

        <p className="mt-6 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-maroon underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
