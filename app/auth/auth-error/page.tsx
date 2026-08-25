/**
 * Friendly dead-end for a Google sign-in that didn't complete —
 * cancelled at the account chooser, a stale callback, or a provider
 * hiccup. Nothing here is the student's fault; the fix is always just
 * "try again", so that's the only real button.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogoLockup } from "@/components/gopher-logo";

export const metadata: Metadata = { title: "Sign-in problem" };

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8">
        <LogoLockup />
      </Link>
      <Card className="w-full max-w-md">
        <CardContent className="text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning/15">
            <RotateCcw aria-hidden className="h-7 w-7 text-warning" />
          </span>
          <h1 className="font-display text-2xl text-ink">That sign-in didn&rsquo;t finish</h1>
          <p className="mt-2 text-sm text-ink-muted">
            The Google sign-in was interrupted — the window may have been closed,
            or the link already used. Try again.
          </p>
          <ul className="mx-auto mt-3 max-w-sm list-disc space-y-1 pl-5 text-left text-sm text-ink-muted">
            <li>
              Finish in the same browser you started in. If this page opened
              inside another app (Instagram, Discord, GroupMe), open the site
              in Chrome or Safari and sign in there.
            </li>
            <li>Start fresh from the Sign in page — don&rsquo;t reuse an old tab.</li>
          </ul>
          <div className="mt-6 flex flex-col gap-3">
            <Button asChild variant="secondary">
              <Link href="/login">Try signing in again</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/">Back to the home page</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
