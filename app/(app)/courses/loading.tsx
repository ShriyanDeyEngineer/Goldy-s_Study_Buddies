/** Catalog + course pages loading state. */
import { PageSkeleton } from "@/components/ui/skeleton";

export default function CoursesLoading() {
  return <PageSkeleton cards={6} />;
}
