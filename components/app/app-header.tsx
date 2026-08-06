/**
 * Header for every signed-in page: logo → dashboard, nav links (desktop),
 * the notification bell, and the avatar menu. The mobile bottom bar is
 * rendered by the app layout, not here.
 *
 * Server component: it fetches the initial unread-notification count so
 * the bell renders correct on first paint; realtime keeps it live after.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoLockup } from "@/components/gopher-logo";
import { AppNavLinks } from "@/components/app/app-nav";
import { NotificationBell } from "@/components/app/notification-bell";
import { UserMenu } from "@/components/app/user-menu";
import type { ProfileRow } from "@/lib/types";

export async function AppHeader({ profile }: { profile: ProfileRow }) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link
          href="/dashboard"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
        >
          <LogoLockup className="text-lg" />
        </Link>
        <div className="flex-1">
          <AppNavLinks />
        </div>
        <NotificationBell userId={profile.id} initialUnread={count ?? 0} />
        <UserMenu
          userId={profile.id}
          displayName={profile.display_name}
          avatarUrl={profile.avatar_url}
        />
      </div>
    </header>
  );
}
