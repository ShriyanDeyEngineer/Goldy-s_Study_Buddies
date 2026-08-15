/**
 * The banner above people search asking whether YOU are open to being a
 * study buddy — flipping it on is what makes you discoverable in the
 * buddies-only filter (spec §5.10).
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { setBuddyAvailabilityAction } from "@/lib/actions/profile";
import { Switch } from "@/components/ui/switch";

export function BuddyPromo({ available }: { available: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-xl bg-gold-light/50 px-4 py-3">
      <p className="flex items-center gap-2 text-sm text-maroon">
        <Sparkles aria-hidden className="h-4 w-4" />
        {available
          ? "You're discoverable as a study buddy — classmates can send you buddy requests."
          : "Want a 1-on-1 study partner? Flip this on to appear in buddy searches."}
      </p>
      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-maroon">
        <Switch
          checked={available}
          disabled={pending}
          onCheckedChange={(checked) => {
            startTransition(async () => {
              await setBuddyAvailabilityAction(checked === true);
              toast.success(
                checked
                  ? "You're in the study-buddy pool!"
                  : "Okay — you won't appear in buddy searches.",
              );
              router.refresh();
            });
          }}
          aria-label="Available for study buddy sessions"
        />
        {available ? "Available" : "Not available"}
      </label>
    </div>
  );
}
