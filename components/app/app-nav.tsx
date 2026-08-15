/**
 * Signed-in navigation, rendered twice from ONE source of truth:
 *   - <AppNavLinks>  — inline links in the desktop header
 *   - <MobileNav>    — the fixed bottom bar on phones (the spec's "top
 *                      nav collapses to a bottom row of links")
 * Both highlight the active section.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/people", label: "People", icon: UsersRound },
  { href: "/messages", label: "Messages", icon: MessageSquare },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppNavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(pathname, link.href) ? "page" : undefined}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-gold",
            isActive(pathname, link.href)
              ? "bg-maroon text-white"
              : "text-ink-muted hover:bg-line/50 hover:text-ink",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(pathname, link.href) ? "page" : undefined}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold",
            isActive(pathname, link.href) ? "text-maroon" : "text-ink-muted",
          )}
        >
          <link.icon aria-hidden className="h-5 w-5" />
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
