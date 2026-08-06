/**
 * Onboarding's own minimal layout. It deliberately lives OUTSIDE the
 * (app) route group: the app layout redirects not-yet-onboarded users
 * HERE, so if this page were inside that layout the redirect would chase
 * its own tail.
 */
import { LogoLockup } from "@/components/gopher-logo";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-10">
      <div className="mb-8 text-center">
        <LogoLockup />
      </div>
      <main className="flex-1">{children}</main>
    </div>
  );
}
