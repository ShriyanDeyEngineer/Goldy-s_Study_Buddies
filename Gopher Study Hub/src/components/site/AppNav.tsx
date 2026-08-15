import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notificationsQuery } from "@/lib/queries";
import { Wordmark } from "./Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { notificationText } from "@/lib/notifications";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/courses", label: "My courses" },
  { to: "/groups", label: "My groups" },
  { to: "/profile", label: "Profile" },
] as const;

export function AppNav({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: notifications = [] } = useQuery(notificationsQuery(userId));
  const unread = notifications.filter((item) => !item.read_at).length;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  async function markRead() {
    if (!unread) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/dashboard" aria-label="Dashboard">
          <Wordmark />
        </Link>

        <nav aria-label="Application" className="hidden items-center gap-5 text-sm md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-ink-muted transition-colors hover:text-maroon"
              activeProps={{ className: "text-maroon font-medium" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <DropdownMenu onOpenChange={(next) => next && markRead()}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Notifications (${unread} unread)`}>
                <span className="relative">
                  <Bell className="h-5 w-5" aria-hidden="true" />
                  {unread > 0 ? (
                    <Badge className="absolute -top-2 -right-2 h-4 min-w-4 justify-center px-1 text-[10px]">
                      {unread}
                    </Badge>
                  ) : null}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              {notifications.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-ink-muted">
                  Nothing yet. Join a group and it&apos;ll fill up.
                </p>
              ) : (
                notifications.slice(0, 10).map((item) => (
                  <DropdownMenuItem key={item.id} className="whitespace-normal text-sm">
                    {notificationText(item.type, item.payload)}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {open ? (
        <nav aria-label="Mobile" className="border-t border-line px-4 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm text-ink-muted"
              activeProps={{ className: "block py-2 text-sm text-maroon font-medium" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
