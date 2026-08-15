/** Dashboard loading state — skeletons shaped like the real sections. */
import { PageSkeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return <PageSkeleton cards={6} />;
}
