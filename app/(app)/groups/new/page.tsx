/**
 * Create-a-group page (/groups/new). Two paths (spec §5.6):
 *
 *   1. ?course=<id> — the normal path from a course page. The invite
 *      picker is offered, listing ONLY classmates currently enrolled in
 *      that course (fetched here via get_course_classmates, which also
 *      applies privacy + block rules).
 *   2. No course / "my course isn't listed" — the student supplies the
 *      course's department, number, and name, and we find-or-create the
 *      course before creating the group. No picker in this path: a
 *      brand-new course has no enrolled classmates to invite.
 */
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { courseCode, type CourseRow, type PublicProfile } from "@/lib/types";
import { CreateGroupForm } from "./create-group-form";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: "Create a study group" };

export default async function NewGroupPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { course: courseParam } = await searchParams;
  const supabase = await createClient();

  // No course chosen yet → send them to pick one first (the spec makes
  // creation reachable "only with a course selected"; the custom-course
  // form is the explicit exception, reached via ?course=custom).
  if (!courseParam) redirect("/courses");

  if (courseParam === "custom") {
    return <CreateGroupForm course={null} classmates={[]} />;
  }

  if (!UUID_RE.test(courseParam)) notFound();

  const [courseRes, classmatesRes] = await Promise.all([
    supabase.from("courses").select("*").eq("id", courseParam).maybeSingle(),
    supabase.rpc("get_course_classmates", { p_course_id: courseParam }),
  ]);

  const course = courseRes.data as CourseRow | null;
  if (!course) notFound();

  return (
    <CreateGroupForm
      course={{ id: course.id, label: `${courseCode(course)} — ${course.course_name}` }}
      classmates={(classmatesRes.data ?? []) as PublicProfile[]}
    />
  );
}
