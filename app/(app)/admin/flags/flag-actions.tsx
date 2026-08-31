/** Status controls for one content-flag row (open → reviewing →
 *  resolved/dismissed). Mirrors report-actions.tsx. */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  setContentFlagStatusAction,
  type FlagStatus,
} from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const NEXT_STEPS: Record<FlagStatus, FlagStatus[]> = {
  open: ["reviewing", "resolved", "dismissed"],
  reviewing: ["resolved", "dismissed"],
  resolved: [],
  dismissed: [],
};

const BADGE_VARIANT = {
  open: "danger",
  reviewing: "warning",
  resolved: "success",
  dismissed: "outline",
} as const;

export function FlagStatusButtons({
  flagId,
  status,
}: {
  flagId: string;
  status: FlagStatus;
}) {
  const router = useRouter();
  const [shown, setShown] = React.useState(status);
  React.useEffect(() => setShown(status), [status]);

  async function move(next: FlagStatus) {
    const previous = shown;
    setShown(next);
    const { error } = await setContentFlagStatusAction(flagId, next);
    if (error) {
      setShown(previous);
      toast.error(error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Badge variant={BADGE_VARIANT[shown]}>{shown}</Badge>
      {NEXT_STEPS[shown].map((next) => (
        <Button key={next} size="sm" variant="outline" onClick={() => move(next)}>
          {next === "reviewing" ? "Start review" : next === "resolved" ? "Resolve" : "Dismiss"}
        </Button>
      ))}
    </div>
  );
}
