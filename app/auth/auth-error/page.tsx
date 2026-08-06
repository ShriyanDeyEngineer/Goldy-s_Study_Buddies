/**
 * Friendly dead-end for broken auth links — expired (they die after 24
 * hours), already used, or malformed. Required by spec §5.2: expired and
 * used links get a clear explanation and a way to try again, not a
 * cryptic redirect.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { TimerOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogoLockup } from "@/components/gopher-logo";

export const metadata: Metadata = { title: "Link problem" };

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const expired = reason === "expired";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8">
        <LogoLockup />
      </Link>
      <Card className="w-full max-w-md">
        <CardContent className="text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning/15">
            <TimerOff aria-hidden className="h-7 w-7 text-warning" />
          </span>
          <h1 className="font-display text-2xl text-ink">
            {expired ? "That link has expired" : "That link didn't work"}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {expired
              ? "Email links are valid for 24 hours and can only be used once. No worries — grab a fresh one below."
              : "The link may be incomplete or already used. Request a fresh one and you'll be on your way."}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button asChild variant="secondary">
              <Link href="/verify-email">Resend verification email</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/forgot-password">Request a password reset</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
