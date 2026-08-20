/**
 * Full-screen "you can't use the app right now" states, rendered by the
 * app layout INSTEAD of the page when something is wrong with the
 * account itself:
 *
 *   <SuspendedScreen>      — account_status is suspended/banned (spec
 *                            §5.14: explanatory screen + sign out).
 *   <ProfileMissingScreen> — session exists but its profile row doesn't.
 *                            Redirecting to login would BOUNCE FOREVER
 *                            (middleware sends signed-in users right
 *                            back) — spec pitfall #4 — so we break the
 *                            loop with a sign-out screen instead.
 */
import { Ban, TriangleAlert } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogoLockup } from "@/components/gopher-logo";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="mb-8">
        <LogoLockup />
      </div>
      <Card className="w-full max-w-md">
        <CardContent className="text-center">{children}</CardContent>
      </Card>
    </div>
  );
}

export function SuspendedScreen({ status }: { status: "suspended" | "banned" }) {
  return (
    <Shell>
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
        <Ban aria-hidden className="h-7 w-7 text-danger" />
      </span>
      <h1 className="font-display text-2xl text-ink">
        {status === "banned" ? "Your account has been banned" : "Your account is suspended"}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        {status === "banned"
          ? "A review found activity that breaks our community rules, and this account can no longer use Goldy's Study Buddies."
          : "Your account was suspended after a report was reviewed. If you believe this is a mistake, contact the team using the address on our home page footer."}
      </p>
      <form action={signOutAction} className="mt-6">
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </Shell>
  );
}

export function ProfileMissingScreen() {
  return (
    <Shell>
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning/15">
        <TriangleAlert aria-hidden className="h-7 w-7 text-warning" />
      </span>
      <h1 className="font-display text-2xl text-ink">There was a problem setting up your account</h1>
      <p className="mt-2 text-sm text-ink-muted">
        You're signed in, but your profile didn't finish setting up. Sign out and
        register again. If it keeps happening, contact the team.
      </p>
      <form action={signOutAction} className="mt-6">
        <Button type="submit" variant="outline">
          Sign out and start over
        </Button>
      </form>
    </Shell>
  );
}
