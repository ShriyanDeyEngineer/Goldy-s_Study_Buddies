/**
 * Course detail page (/courses/[courseId]) — every active study group for
 * the course, each with the smart join button, plus the prominent
 * "Create a group for this course" action (spec §5.5).
 *
 * The join button's state is computed here on the server (membership +
 * pending request + capacity), so what you see is always true at render
 * time — the state machine itself is the unit-tested pure function.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import { courseCode, type CourseRow, type StudyGroupRow } from "@/lib/types";
import { getJoinState } from "@/lib/groups/join-state";
import { JoinButton } from "@/components/groups/join-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ existing?: string }>;
}) {
  const { courseId } = await params;
  const { existing } = await searchParams;
  // Validate before it ever reaches a query filter (spec pitfall #5).
  if (!UUID_RE.test(courseId)) notFound();

  const { supabase, profile } = await getSessionProfile();
  if (!profile) return null;

  const [courseRes, groupsRes, membershipRes, requestsRes] = await Promise.all([
    supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
    supabase
      .from("study_groups")
      .select("*")
      .eq("course_id", courseId)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase.from("study_group_members").select("group_id").eq("user_id", profile.id),
    supabase
      .from("join_requests")
      .select("group_id")
      .eq("user_id", profile.id)
      .eq("status", "pending"),
  ]);

  const course = courseRes.data as CourseRow | null;
  if (!course) notFound();

  const groups = (groupsRes.data ?? []) as StudyGroupRow[];
  const myGroupIds = new Set((membershipRes.data ?? []).map((m) => m.group_id as string));
  const myPendingIds = new Set((requestsRes.data ?? []).map((r) => r.group_id as string));

  return (
    <div>
      {existing && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-gold-light/60 px-4 py-2.5 text-sm text-maroon"
        >
          Good news — that course was already in the catalog. Here it is.
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-maroon">
            {courseCode(course)}
          </p>
          <h1 className="font-display text-3xl text-ink">{course.course_name}</h1>
        </div>
        <Button asChild>
          <Link href={`/groups/new?course=${course.id}`}>
            <Plus aria-hidden className="h-4 w-4" />
            Create a group for this course
          </Link>
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No study groups here yet"
          description="Be the icebreaker — create the first group for this course. Open groups fill up fast once they exist."
          action={
            <Button asChild>
              <Link href={`/groups/new?course=${course.id}`}>Create the first group</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => {
            const state = getJoinState({
              groupStatus: group.status,
              mode: group.mode,
              memberCount: group.member_count,
              capacity: group.capacity,
              isManager: group.manager_id === profile.id,
              isMember: myGroupIds.has(group.id),
              hasPendingRequest: myPendingIds.has(group.id),
            });
            return (
              <li key={group.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/groups/${group.id}`}
                        className="truncate font-display text-lg text-ink hover:underline focus-visible:outline-2 focus-visible:outline-gold"
                      >
                        {group.name}
                      </Link>
                      <div className="mt-1.5 flex items-center gap-3 text-sm text-ink-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Users aria-hidden className="h-4 w-4" />
                          {group.member_count}/{group.capacity}
                        </span>
                        <Badge variant={group.mode === "open" ? "success" : "warning"}>
                          {group.mode === "open" ? "Open — join instantly" : "Closed — request to join"}
                        </Badge>
                      </div>
                    </div>
                    <JoinButton groupId={group.id} state={state} />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
