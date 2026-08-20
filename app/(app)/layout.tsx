/**
 * Layout for every SIGNED-IN page (dashboard, courses, groups, people,
 * messages, notifications, settings, profiles).
 *
 * This is the account checkpoint. In order:
 *   1. No session            → /login (middleware already does this;
 *                              repeated here so the rule holds even if
 *                              the middleware matcher misses a path)
 *   2. Session but NO profile → "sign out and start over" screen —
 *                              NEVER redirect to login (infinite bounce,
 *                              spec pitfall #4)
 *   3. Suspended / banned    → lockout screen with sign-out (§5.14)
 *   4. Not onboarded yet     → /onboarding (it lives OUTSIDE this route
 *                              group precisely so this redirect can't
 *                              loop)
 * Then: header, page content, mobile bottom nav.
 */
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app/app-header";
import { MobileNav } from "@/components/app/app-nav";
import {
  ProfileMissingScreen,
  SuspendedScreen,
} from "@/components/app/account-screens";
import type { ProfileRow } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await getSessionProfile();

  if (!user) redirect("/login");
  if (!profile) return <ProfileMissingScreen />;

  const typedProfile = profile as ProfileRow;
  if (typedProfile.account_status !== "active") {
    return <SuspendedScreen status={typedProfile.account_status} />;
  }
  if (!typedProfile.display_name) redirect("/onboarding");

  // Initial unread counts for the bell and the Messages badge. Fetched in
  // parallel, once, here — see AppHeader's header comment for why.
  const [notificationsRes, messagesRes] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
    supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", typedProfile.id)
      .eq("is_read", false),
  ]);
  const unreadNotifications = notificationsRes.count ?? 0;
  const unreadMessages = messagesRes.count ?? 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        profile={typedProfile}
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
      />
      {/* pb-20 keeps content clear of the mobile bottom bar. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-20 md:pb-8">
        {children}
      </main>
      <MobileNav userId={typedProfile.id} initialUnreadMessages={unreadMessages} />
    </div>
  );
}
