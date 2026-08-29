/**
 * Cached reads for data that's IDENTICAL for every signed-in student —
 * the course catalog, and each course's list of active study groups.
 * Neither `courses` nor `study_groups` SELECT policies filter by caller
 * identity (`using (true)` for any authenticated user — migrations
 * 0002/0004: "Any signed-in student can browse the whole catalog" /
 * "Groups are previewable by any signed-in student"), so unlike almost
 * everything else in this app, this data has nothing per-user to merge
 * in — it's safe to fetch once and share across every viewer.
 *
 * Every page under app/(app) reads cookies() (auth), which forces that
 * whole route to render dynamically on every request — so this can't be
 * ISR at the route level. What unstable_cache buys instead: the
 * EXPENSIVE PART (the actual Postgres round trips) gets reused across
 * requests/users up to the revalidate window, even though the page
 * around it still re-renders every time. That's why this uses the
 * ADMIN client (lib/supabase/admin.ts) rather than the normal per-
 * request client — a cookie-bound client can't be called from inside
 * unstable_cache at all (Next.js forbids reading cookies() in a cached
 * function), and this data was never filtered by the caller's identity
 * in the first place, so bypassing RLS here doesn't expose anything an
 * ordinary authenticated read wouldn't already return.
 *
 * Freshness: revalidated every 60s as a self-healing floor, PLUS
 * revalidateTag(COURSE_CATALOG_TAG) is called on-demand from every
 * action that actually changes this data (course approval, group
 * create/disband/settings — see lib/actions/groups.ts and
 * lib/actions/course-requests.ts) for near-instant updates on the
 * common paths. If some future write path forgets to invalidate, the
 * 60s window is the backstop, not a single point of failure.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CourseRow, StudyGroupRow } from "@/lib/types";

export const COURSE_CATALOG_TAG = "course-catalog";

interface GroupCountRow {
  course_id: string;
  mode: "open" | "closed";
}

/**
 * Every active course, plus a raw list of (course_id, mode) for every
 * active study group — callers derive per-course counts from the latter
 * (courses/page.tsx counts groups AND open-groups in one pass over it).
 */
export const getCourseCatalog = unstable_cache(
  async (): Promise<{ courses: CourseRow[]; groupRows: GroupCountRow[] }> => {
    const supabase = createAdminClient();
    const [coursesRes, groupsRes] = await Promise.all([
      supabase
        .from("courses")
        .select("*")
        .eq("is_active", true)
        .order("department_code")
        .order("course_number"),
      supabase.from("study_groups").select("course_id, mode").eq("status", "active"),
    ]);
    return {
      courses: (coursesRes.data ?? []) as CourseRow[],
      groupRows: (groupsRes.data ?? []) as GroupCountRow[],
    };
  },
  ["course-catalog"],
  { tags: [COURSE_CATALOG_TAG], revalidate: 60 },
);

/** One course plus its active study groups — the shared half of
 *  /courses/[courseId]; membership/pending-request state is per-viewer
 *  and stays on the normal request-scoped client in the page itself. */
export const getCourseWithGroups = unstable_cache(
  async (courseId: string): Promise<{ course: CourseRow | null; groups: StudyGroupRow[] }> => {
    const supabase = createAdminClient();
    const [courseRes, groupsRes] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
      supabase
        .from("study_groups")
        .select("*")
        .eq("course_id", courseId)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
    ]);
    return {
      course: (courseRes.data ?? null) as CourseRow | null,
      groups: (groupsRes.data ?? []) as StudyGroupRow[],
    };
  },
  ["course-with-groups"],
  { tags: [COURSE_CATALOG_TAG], revalidate: 60 },
);
