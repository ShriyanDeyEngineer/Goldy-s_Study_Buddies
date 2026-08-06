/**
 * Loading placeholder blocks. Every list/page/panel is required by the
 * design spec to have a designed loading state — these gray pulsing
 * shapes are it. Use them in loading.tsx files and Suspense fallbacks,
 * roughly matching the shape of the content they stand in for.
 */
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-xl bg-line/70", className)}
    />
  );
}

/** A ready-made skeleton shaped like a card with a few text lines. */
export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <Skeleton className="mb-3 h-5 w-2/3" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/** A page-level skeleton: heading bar plus a grid of card skeletons. */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <Skeleton className="mb-6 h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
