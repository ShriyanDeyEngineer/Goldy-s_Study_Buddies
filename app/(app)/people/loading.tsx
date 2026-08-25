/** Skeleton for people search — search_people() plus the filter options
 *  are two RPCs, so this route is never instant. */
import { PageSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <PageSkeleton cards={6} />;
}
