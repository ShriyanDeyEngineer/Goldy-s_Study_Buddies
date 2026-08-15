import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { AppNav } from "@/components/site/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSession } from "@/hooks/useSession";
import { coursesQuery, myCoursesQuery } from "@/lib/queries";
import { addCourse, setEnrollment } from "@/lib/api.functions";
import { courseSchema } from "@/lib/validation";
import { friendlyError } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/courses/")({
  head: () => ({
    meta: [
      { title: "My courses — Goldy's Study Buddies" },
      {
        name: "description",
        content: "Add or remove the University of Minnesota courses you're taking this semester.",
      },
      { property: "og:title", content: "Manage your UMN courses" },
      { property: "og:description", content: "Your course list drives which groups you can join." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CoursesPage,
});

function CoursesPage() {
  const { user, loading } = useSession();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const courses = useQuery(coursesQuery());
  const mine = useQuery({ ...myCoursesQuery(userId), enabled: Boolean(userId) });
  const [search, setSearch] = useState("");

  const enrolledIds = useMemo(
    () => new Set((mine.data ?? []).map((row) => row.course_id)),
    [mine.data],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = courses.data ?? [];
    if (!term) return list;
    return list.filter((course) =>
      `${course.department} ${course.number} ${course.name}`.toLowerCase().includes(term),
    );
  }, [courses.data, search]);

  async function toggle(courseId: string, enrolled: boolean) {
    try {
      await setEnrollment({ data: { courseId, enrolled: !enrolled, enrollment: "current" } });
      queryClient.invalidateQueries({ queryKey: ["my-courses", userId] });
      toast.success(enrolled ? "Course removed" : "Course added");
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  if (loading || !userId) return <div className="min-h-screen bg-cream" />;

  return (
    <div className="min-h-screen bg-cream">
      <AppNav userId={userId} />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl text-ink">My courses</h1>
          <AddCourseDialog />
        </div>

        <Card className="mt-6 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="font-display text-xl">This semester</CardTitle>
          </CardHeader>
          <CardContent>
            {mine.data && mine.data.length > 0 ? (
              <ul className="space-y-2">
                {mine.data.map((row) => (
                  <li
                    key={`${row.course_id}-${row.enrollment}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
                  >
                    <Link
                      to="/courses/$courseId"
                      params={{ courseId: row.course_id }}
                      className="text-sm"
                    >
                      <span className="font-medium text-maroon">
                        {row.courses?.department} {row.courses?.number}
                      </span>
                      <span className="text-ink-muted"> — {row.courses?.name}</span>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => toggle(row.course_id, true)}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">
                Nothing added yet. Find your classes in the catalog below.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="font-display text-xl">Course catalog</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="catalog-search">Search</Label>
            <Input
              id="catalog-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="PHYS 1301W, statistics, CSCI…"
            />
            <ul className="mt-4 max-h-[28rem] space-y-1 overflow-y-auto">
              {filtered.map((course) => {
                const enrolled = enrolledIds.has(course.id);
                return (
                  <li key={course.id}>
                    <button
                      type="button"
                      onClick={() => toggle(course.id, enrolled)}
                      aria-pressed={enrolled}
                      className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${
                        enrolled ? "bg-gold-light text-maroon-dark" : "hover:bg-cream"
                      }`}
                    >
                      <span>
                        <span className="font-medium">
                          {course.department} {course.number}
                        </span>{" "}
                        <span className="text-ink-muted">{course.name}</span>
                      </span>
                      {enrolled ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-ink-muted">
                  No matches — add it as a new course.
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function AddCourseDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [department, setDepartment] = useState("");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const parsed = courseSchema.safeParse({ department, number, name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the course details.");
      return;
    }
    try {
      await addCourse({ data: parsed.data });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course added to the catalog");
      setOpen(false);
      setDepartment("");
      setNumber("");
      setName("");
      setError(null);
    } catch (submitError) {
      setError(friendlyError(submitError));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add a course
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Add a course</DialogTitle>
          <DialogDescription>
            Can&apos;t find your class? Add it and it becomes available to everyone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dept">Department</Label>
              <Input
                id="dept"
                value={department}
                onChange={(event) => setDepartment(event.target.value.toUpperCase())}
                placeholder="CSCI"
              />
            </div>
            <div>
              <Label htmlFor="num">Number</Label>
              <Input
                id="num"
                value={number}
                onChange={(event) => setNumber(event.target.value.toUpperCase())}
                placeholder="1133"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="course-name">Course name</Label>
            <Input
              id="course-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Introduction to Programming Concepts"
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={submit}>Add course</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
