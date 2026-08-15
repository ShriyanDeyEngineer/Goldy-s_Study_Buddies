/**
 * Error state — the third of the three required list/page states
 * (loading, empty, error). Shows a human apology plus a Retry button.
 *
 * Used by error.tsx boundary files and by client components whose fetch
 * failed. `onRetry` for client-side retries; `retryHref` when a plain
 * navigation is the retry.
 */
"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ErrorState({
  title = "Something went wrong",
  description = "That's on us, not you. Give it another try.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center rounded-xl border border-danger/30 bg-danger/5 px-6 py-10 text-center",
        className,
      )}
    >
      <AlertTriangle aria-hidden className="mb-3 h-8 w-8 text-danger" />
      <h3 className="font-display text-lg text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
