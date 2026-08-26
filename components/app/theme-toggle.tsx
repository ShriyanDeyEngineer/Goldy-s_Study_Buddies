/**
 * The light/dark switch in the header avatar menu.
 *
 * Lives in the menu rather than on the header bar itself because it is a
 * set-once-and-forget preference, not something students flip mid-session
 * — the same reason it sits next to the other account settings.
 *
 * Saves immediately on click, like the privacy switches: a theme change
 * that waited behind a "Save" button would be a strange thing to explain.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { setThemeAction } from "@/lib/actions/profile";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function ThemeToggleItem({ theme }: { theme: "light" | "dark" }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const isDark = theme === "dark";
  const next = isDark ? "light" : "dark";

  return (
    <DropdownMenuItem
      disabled={pending}
      onSelect={(event) => {
        // Radix closes the menu on select by default. Hold it open so the
        // student sees the theme change land instead of the menu vanishing.
        event.preventDefault();
        startTransition(async () => {
          await setThemeAction(next);
          // The server action revalidates; this pulls the new layout
          // (and therefore the new .dark class) into the current view.
          router.refresh();
        });
      }}
    >
      {isDark ? (
        <Sun aria-hidden className="h-4 w-4" />
      ) : (
        <Moon aria-hidden className="h-4 w-4" />
      )}
      {isDark ? "Light mode" : "Dark mode"}
    </DropdownMenuItem>
  );
}
