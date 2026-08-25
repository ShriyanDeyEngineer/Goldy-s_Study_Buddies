/** Skeleton for the group page — its three panels are the heaviest fetch
 *  in the app, so navigating here without one showed a blank screen. */
import { PageSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <PageSkeleton cards={3} />;
}
