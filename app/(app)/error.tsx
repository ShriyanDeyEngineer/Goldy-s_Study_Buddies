/**
 * Error boundary for every signed-in page: the required "message +
 * retry" third state. Next.js renders this when a page throws; reset()
 * re-attempts the render.
 */
"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      title="This page hit a snag"
      description="Something on our end broke while loading. Your data is fine — try again."
      onRetry={reset}
    />
  );
}
