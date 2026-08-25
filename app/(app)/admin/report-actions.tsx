/** Status controls for one report row (open → reviewing → resolved/dismissed). */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setReportStatusAction, type ReportStatus } from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const NEXT_STEPS: Record<ReportStatus, ReportStatus[]> = {
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

export function ReportStatusButtons({
  reportId,
  status,
}: {
  reportId: string;
  status: ReportStatus;
}) {
  const router = useRouter();
  // The chip and the available next steps flip immediately; the refresh
  // that follows only reconciles the rest of the row.
  const [shown, setShown] = React.useState(status);
  React.useEffect(() => setShown(status), [status]);

  async function move(next: ReportStatus) {
    const previous = shown;
    setShown(next);
    const { error } = await setReportStatusAction(reportId, next);
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
