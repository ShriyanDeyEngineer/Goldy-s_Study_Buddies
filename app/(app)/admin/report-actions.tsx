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
  const [busy, setBusy] = React.useState(false);

  async function move(next: ReportStatus) {
    setBusy(true);
    const { error } = await setReportStatusAction(reportId, next);
    setBusy(false);
    if (error) toast.error(error);
    else router.refresh();
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Badge variant={BADGE_VARIANT[status]}>{status}</Badge>
      {NEXT_STEPS[status].map((next) => (
        <Button
          key={next}
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => move(next)}
        >
          {next === "reviewing" ? "Start review" : next === "resolved" ? "Resolve" : "Dismiss"}
        </Button>
      ))}
    </div>
  );
}
