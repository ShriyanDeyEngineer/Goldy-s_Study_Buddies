/**
 * "Check your inbox" screen, shown right after registering (and when an
 * unverified user tries to sign in). Explains the 24-hour expiry and
 * offers a resend.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ResendForm } from "./resend-form";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <Card>
      <CardContent className="text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-light">
          <MailCheck aria-hidden className="h-7 w-7 text-maroon" />
        </span>
        <h1 className="font-display text-2xl text-ink">Check your inbox</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {email ? (
            <>
              We sent a verification link to <span className="font-medium text-ink">{email}</span>.
            </>
          ) : (
            "We sent a verification link to your UMN email."
          )}{" "}
          Click it within <span className="font-medium text-ink">24 hours</span> to activate your
          account — after that it expires and you&rsquo;ll need a new one.
        </p>

        <div className="mt-6">
          <ResendForm email={email} />
        </div>

        <p className="mt-6 text-sm text-ink-muted">
          Wrong address?{" "}
          <Link href="/register" className="font-medium text-maroon underline underline-offset-2">
            Sign up again
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
