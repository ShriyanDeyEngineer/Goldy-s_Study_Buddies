/**
 * My courses (/settings/courses): manage the three lists — taking now,
 * already taken, planning to take. Current classes drive matching
 * (groups, invites, filters, suggestions), so this page links back to
 * wherever sent you here.
 */
import { getSessionProfile } from "@/lib/supabase/server";
import type { CourseRow } from "@/lib/types";
import { CourseListManager } from "./course-list-manager";

export const metadata = { title: "My courses" };

export default async function CourseSettingsPage() {
  const { supabase, profile } = await getSessionProfile();
  if (!profile) return null;

  const [coursesRes, enrollmentsRes] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("is_active", true)
      .order("department_code")
      .order("course_number"),
    supabase.from("user_courses").select("course_id, enrollment_type").eq("user_id", profile.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl text-ink">My courses</h1>
      <p className="mt-1 mb-6 text-ink-muted">
        Your <span className="font-medium text-ink">current</span> classes power
        everything — group suggestions, classmate invites, and people filters. The
        other two lists just show on your profile.
      </p>
      <CourseListManager
        courses={(coursesRes.data ?? []) as CourseRow[]}
        enrollments={
          (enrollmentsRes.data ?? []) as {
            course_id: string;
            enrollment_type: "current" | "taken" | "future";
          }[]
        }
      />
    </div>
  );
}
