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
      title="Something went wrong"
      description="Something broke while loading this page. Try again."
      onRetry={reset}
    />
  );
}
