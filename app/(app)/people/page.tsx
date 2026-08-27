/**
 * People search + study-buddy discovery (/people) — spec §5.10.
 *
 * One page serves both: the shared filter panel narrows by course,
 * major, college, standing, grad year, and the "study buddies only"
 * toggle (that toggle IS the discovery page). Filters live entirely in
 * the URL — bookmarkable, shareable, refresh-proof.
 *
 * Privacy inheritance: this page just forwards validated filters to
 * search_people(), which enforces the hidden-field rules in-database.
 * Nothing privacy-critical happens in this file, by design.
 */
import { getSessionProfile } from "@/lib/supabase/server";
import {
  filtersToRpcParams,
  filtersToSearchParams,
  hasActiveFilters,
  parsePeopleFilters,
  PAGE_SIZE,
} from "@/lib/people/filters";
import { courseCode, type CourseRow, type PersonSearchResult } from "@/lib/types";
import { FilterPanel } from "./filter-panel";
import { PersonCard } from "./person-card";
import { BuddyPromo } from "./buddy-promo";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { pluralize } from "@/lib/utils";

export const metadata = { title: "Find people" };

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parsePeopleFilters(params);

  const { supabase, profile } = await getSessionProfile();
  if (!profile) return null;

  const [resultsRes, coursesRes, majorsRes] = await Promise.all([
    supabase.rpc("search_people", filtersToRpcParams(filters)),
    supabase
      .from("courses")
      .select("id, department_code, course_number, course_name")
      .eq("is_active", true)
      .order("department_code")
      .order("course_number"),
    supabase.rpc("get_major_options"),
  ]);

  const results = (resultsRes.data ?? []) as PersonSearchResult[];
  const totalCount = results[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const courseOptions = ((coursesRes.data ?? []) as CourseRow[]).map((course) => ({
    id: course.id,
    label: `${courseCode(course)} — ${course.course_name}`,
    short: courseCode(course),
  }));
  const majorOptions = (majorsRes.data ?? []) as string[];

  /** Page links preserve every filter, only changing `page`. */
  function pageHref(page: number): string {
    const params = filtersToSearchParams(filters);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/people${qs ? `?${qs}` : ""}`;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-ink">Connect with Your Fellow Students</h1>
        <p className="mt-1 text-ink-muted">
          Search classmates, filter by course or college, or find a 1 on 1 study buddy.
        </p>
      </div>

      <BuddyPromo available={profile.is_available_for_buddies} />

      <FilterPanel
        filters={filters}
        courseOptions={courseOptions}
        majorOptions={majorOptions}
      />

      {/* Result count — always visible so filtering feels responsive. */}
      <p className="mb-4 mt-6 text-sm text-ink-muted" aria-live="polite">
        {pluralize(totalCount, "person", "people")} found
        {filters.buddiesOnly && " looking for a study buddy"}
      </p>

      {results.length === 0 ? (
        <EmptyState
          title="Nobody matches those filters"
          description={
            hasActiveFilters(filters) || filters.query
              ? "Try removing a filter or two — smaller nets catch fewer fish."
              : "Looks like it's quiet in here. Check back as more Gophers join!"
          }
          action={
            hasActiveFilters(filters) ? (
              <Button asChild variant="outline">
                <Link href="/people">Clear all filters</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((person) => (
              <li key={person.id}>
                <PersonCard person={person} />
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav aria-label="Pages" className="mt-8 flex items-center justify-center gap-3">
              {filters.page > 1 && (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(filters.page - 1)}>Previous</Link>
                </Button>
              )}
              <span className="text-sm text-ink-muted">
                Page {filters.page} of {totalPages}
              </span>
              {filters.page < totalPages && (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(filters.page + 1)}>Next</Link>
                </Button>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
