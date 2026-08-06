/**
 * The three course lists (current / taken / future) with a shared
 * search-and-add box per list. Each check/uncheck saves immediately.
 * The same course may sit on two lists (retakes happen) — the database
 * allows it deliberately, one row per (course, list).
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { setCourseEnrollmentAction } from "@/lib/actions/profile";
import { courseCode, type CourseRow } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LISTS = [
  { key: "current", title: "Taking now", empty: "Add the classes you're in this term." },
  { key: "taken", title: "Already taken", empty: "Add classes you've finished — they show on your profile." },
  { key: "future", title: "Planning to take", empty: "Add classes you're eyeing for later." },
] as const;

export function CourseListManager({
  courses,
  enrollments,
}: {
  courses: CourseRow[];
  enrollments: { course_id: string; enrollment_type: "current" | "taken" | "future" }[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const coursesById = new Map(courses.map((c) => [c.id, c]));
  const byList = {
    current: enrollments.filter((e) => e.enrollment_type === "current"),
    taken: enrollments.filter((e) => e.enrollment_type === "taken"),
    future: enrollments.filter((e) => e.enrollment_type === "future"),
  };

  function setEnrollment(
    courseId: string,
    list: "current" | "taken" | "future",
    enrolled: boolean,
  ) {
    startTransition(async () => {
      const { error } = await setCourseEnrollmentAction(courseId, list, enrolled);
      if (error) toast.error(error);
      router.refresh();
    });
  }

  const matches = query.trim()
    ? courses
        .filter((course) => {
          const q = query.trim().toLowerCase();
          return (
            courseCode(course).toLowerCase().includes(q) ||
            course.course_name.toLowerCase().includes(q)
          );
        })
        .slice(0, 8)
    : [];

  return (
    <Tabs defaultValue="current">
      <TabsList>
        {LISTS.map((list) => (
          <TabsTrigger key={list.key} value={list.key}>
            {list.title} ({byList[list.key].length})
          </TabsTrigger>
        ))}
      </TabsList>

      {LISTS.map((list) => (
        <TabsContent key={list.key} value={list.key}>
          <Card>
            <CardContent>
              {/* Add box */}
              <div className="relative mb-3">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search the catalog to add…"
                  aria-label={`Add a course to "${list.title}"`}
                  className="pl-9"
                />
              </div>
              {matches.length > 0 && (
                <ul className="mb-4 overflow-hidden rounded-xl border border-line">
                  {matches.map((course) => {
                    const already = byList[list.key].some(
                      (e) => e.course_id === course.id,
                    );
                    return (
                      <li key={course.id}>
                        <button
                          type="button"
                          disabled={already || pending}
                          onClick={() => {
                            setEnrollment(course.id, list.key, true);
                            setQuery("");
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-cream disabled:opacity-50"
                        >
                          <span>
                            <span className="font-medium text-ink">{courseCode(course)}</span>{" "}
                            <span className="text-ink-muted">{course.course_name}</span>
                          </span>
                          <span className="text-xs text-maroon">
                            {already ? "Added" : "+ Add"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Current list contents */}
              {byList[list.key].length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-muted">{list.empty}</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {byList[list.key].map((enrollment) => {
                    const course = coursesById.get(enrollment.course_id);
                    if (!course) return null;
                    return (
                      <li
                        key={enrollment.course_id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-cream px-3 py-1.5 text-sm text-ink"
                      >
                        <span title={course.course_name}>{courseCode(course)}</span>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setEnrollment(course.id, list.key, false)}
                          aria-label={`Remove ${courseCode(course)} from "${list.title}"`}
                          className="rounded-full p-0.5 text-ink-muted hover:text-danger focus-visible:outline-2 focus-visible:outline-gold"
                        >
                          <X aria-hidden className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}
