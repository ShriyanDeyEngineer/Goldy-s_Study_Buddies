/**
 * People-filter construction: turns raw URL query strings into validated,
 * safe parameters for the search_people database function — and back into
 * URLs for the removable filter chips.
 *
 * Filters live in the URL (spec §5.10) so a filtered view can be
 * bookmarked, shared, and survives refresh:
 *   /people?course=<uuid>,<uuid>&college=cse&gradMin=2027&buddies=1
 *
 * SECURITY (spec pitfall #5): everything here is untrusted text from the
 * address bar. Course ids must be real UUIDs, colleges/standings must be
 * on the whitelist, years must be in range — anything else is silently
 * DROPPED, never passed through to the database. Unit-tested, including
 * the drop behavior.
 *
 * The privacy rule ("hidden field excludes you from that filter") is NOT
 * implemented here — it lives in search_people() in the database, where
 * it cannot be bypassed. This file only shapes the request.
 */
import {
  COLLEGE_VALUES,
  GRAD_YEAR_MAX,
  GRAD_YEAR_MIN,
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  STANDING_VALUES,
} from "@/lib/constants";

export interface PeopleFilters {
  query: string | null;
  courseIds: string[];
  majors: string[];
  colleges: string[];
  standings: string[];
  gradMin: number | null;
  gradMax: number | null;
  buddiesOnly: boolean;
  page: number;
}

export const PAGE_SIZE = 24;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Next.js hands searchParams values as string | string[] | undefined —
 *  normalize to the first string. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Split a comma-separated param, trim entries, drop empties + dupes. */
function splitParam(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((v) => v.trim()).filter(Boolean))];
}

function parseYear(value: string | undefined): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= GRAD_YEAR_MIN && year <= GRAD_YEAR_MAX ? year : null;
}

export function parsePeopleFilters(
  searchParams: Record<string, string | string[] | undefined>,
): PeopleFilters {
  const rawQuery = (first(searchParams.q) ?? "").trim().slice(0, SEARCH_MAX_LENGTH);

  let gradMin = parseYear(first(searchParams.gradMin));
  let gradMax = parseYear(first(searchParams.gradMax));
  // A shared link with the bounds backwards shouldn't show "no results" —
  // swapping is clearly what the person meant.
  if (gradMin !== null && gradMax !== null && gradMin > gradMax) {
    [gradMin, gradMax] = [gradMax, gradMin];
  }

  const rawPage = Number(first(searchParams.page) ?? "1");
  const page =
    Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 1000 ? rawPage : 1;

  return {
    // Below the 2-character minimum the query is treated as absent.
    query: rawQuery.length >= SEARCH_MIN_LENGTH ? rawQuery : null,
    courseIds: splitParam(first(searchParams.course)).filter((id) => UUID_RE.test(id)),
    // Majors are free text (they come from profiles), but capped in count
    // and length so a hostile URL can't build a monster query.
    majors: splitParam(first(searchParams.major))
      .slice(0, 10)
      .map((m) => m.slice(0, 100)),
    colleges: splitParam(first(searchParams.college)).filter((c) =>
      (COLLEGE_VALUES as readonly string[]).includes(c),
    ),
    standings: splitParam(first(searchParams.standing)).filter((s) =>
      (STANDING_VALUES as readonly string[]).includes(s),
    ),
    gradMin,
    gradMax,
    buddiesOnly: first(searchParams.buddies) === "1",
    page,
  };
}

/** The exact argument object for supabase.rpc("search_people", …). */
export function filtersToRpcParams(filters: PeopleFilters) {
  return {
    p_query: filters.query,
    p_course_ids: filters.courseIds.length ? filters.courseIds : null,
    p_majors: filters.majors.length ? filters.majors : null,
    p_colleges: filters.colleges.length ? filters.colleges : null,
    p_standings: filters.standings.length ? filters.standings : null,
    p_grad_min: filters.gradMin,
    p_grad_max: filters.gradMax,
    p_buddy_only: filters.buddiesOnly,
    p_limit: PAGE_SIZE,
    p_offset: (filters.page - 1) * PAGE_SIZE,
  };
}

/** Rebuild the query string from filters — the inverse of parsing. Used
 *  by chips (remove one value) and "Clear all". Omits page (a filter
 *  change always returns you to page 1 on purpose). */
export function filtersToSearchParams(filters: PeopleFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.courseIds.length) params.set("course", filters.courseIds.join(","));
  if (filters.majors.length) params.set("major", filters.majors.join(","));
  if (filters.colleges.length) params.set("college", filters.colleges.join(","));
  if (filters.standings.length) params.set("standing", filters.standings.join(","));
  if (filters.gradMin !== null) params.set("gradMin", String(filters.gradMin));
  if (filters.gradMax !== null) params.set("gradMax", String(filters.gradMax));
  if (filters.buddiesOnly) params.set("buddies", "1");
  return params;
}

export function hasActiveFilters(filters: PeopleFilters): boolean {
  return (
    filters.courseIds.length > 0 ||
    filters.majors.length > 0 ||
    filters.colleges.length > 0 ||
    filters.standings.length > 0 ||
    filters.gradMin !== null ||
    filters.gradMax !== null ||
    filters.buddiesOnly
  );
}
