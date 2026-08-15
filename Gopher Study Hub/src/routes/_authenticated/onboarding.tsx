import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { AppNav } from "@/components/site/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/hooks/useSession";
import { coursesQuery } from "@/lib/queries";
import { saveOnboarding } from "@/lib/api.functions";
import { GRAD_YEAR_MAX, GRAD_YEAR_MIN, onboardingSchema } from "@/lib/validation";
import { friendlyError } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your profile — Goldy's Study Buddies" },
      {
        name: "description",
        content: "Tell classmates who you are and add the UMN courses you're taking this term.",
      },
      { property: "og:title", content: "Set up your profile" },
      { property: "og:description", content: "Two steps and you're in." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Onboarding,
});

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function Onboarding() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const userId = user?.id ?? "";
  const courses = useQuery(coursesQuery());

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [major, setMajor] = useState("");
  const [college, setCollege] = useState("");
  const [bio, setBio] = useState("");
  const [gradMonth, setGradMonth] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = courses.data ?? [];
    if (!term) return list.slice(0, 40);
    return list
      .filter((course) =>
        `${course.department} ${course.number} ${course.name}`.toLowerCase().includes(term),
      )
      .slice(0, 40);
  }, [courses.data, search]);

  function toggle(courseId: string) {
    setSelected((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    );
  }

  async function submit() {
    const parsed = onboardingSchema.safeParse({
      displayName,
      major,
      college,
      bio,
      graduationMonth: gradMonth ? Number(gradMonth) : undefined,
      graduationYear: gradYear ? Number(gradYear) : undefined,
      courseIds: selected,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details.");
      setStep(1);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await saveOnboarding({ data: parsed.data });
      toast.success("Profile saved");
      navigate({ to: "/dashboard" });
    } catch (submitError) {
      setError(friendlyError(submitError));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !userId) return <div className="min-h-screen bg-cream" />;

  return (
    <div className="min-h-screen bg-cream">
      <AppNav userId={userId} />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-ink-muted">Step {step} of 2</p>
        <Card className="mt-3 shadow-[var(--shadow-card)]">
          {step === 1 ? (
            <>
              <CardHeader>
                <CardTitle className="font-display text-2xl">Who are you?</CardTitle>
                <CardDescription>
                  This is what classmates see when you join a group.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="display-name">Display name</Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Alex R."
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="major">Major</Label>
                    <Input
                      id="major"
                      value={major}
                      onChange={(event) => setMajor(event.target.value)}
                      placeholder="Biology"
                    />
                  </div>
                  <div>
                    <Label htmlFor="college">College</Label>
                    <Input
                      id="college"
                      value={college}
                      onChange={(event) => setCollege(event.target.value)}
                      placeholder="CBS"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="grad-month">Graduation month</Label>
                    <select
                      id="grad-month"
                      value={gradMonth}
                      onChange={(event) => setGradMonth(event.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                      <option value="">Not sure yet</option>
                      {MONTHS.map((month, index) => (
                        <option key={month} value={index + 1}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="grad-year">Graduation year</Label>
                    <Input
                      id="grad-year"
                      type="number"
                      min={GRAD_YEAR_MIN}
                      max={GRAD_YEAR_MAX}
                      value={gradYear}
                      onChange={(event) => setGradYear(event.target.value)}
                      placeholder="2027"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="bio">Short bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="Night owl, prefers Walter over Coffman, happy to explain recursion."
                    rows={3}
                  />
                </div>
                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <Button className="w-full" onClick={() => setStep(2)}>
                  Continue
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="font-display text-2xl">What are you taking?</CardTitle>
                <CardDescription>
                  Pick your current courses. You can change these any time.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="course-search">Search courses</Label>
                  <Input
                    id="course-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="CSCI 1133 or Calculus"
                  />
                </div>
                <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-line p-2">
                  {filtered.map((course) => {
                    const active = selected.includes(course.id);
                    return (
                      <li key={course.id}>
                        <button
                          type="button"
                          onClick={() => toggle(course.id)}
                          aria-pressed={active}
                          className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${
                            active ? "bg-gold-light text-maroon-dark" : "hover:bg-cream"
                          }`}
                        >
                          <span>
                            <span className="font-medium">
                              {course.department} {course.number}
                            </span>{" "}
                            <span className="text-ink-muted">{course.name}</span>
                          </span>
                          {active ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                        </button>
                      </li>
                    );
                  })}
                  {filtered.length === 0 ? (
                    <li className="px-3 py-6 text-center text-sm text-ink-muted">
                      No matches. Try a department code like PSY.
                    </li>
                  ) : null}
                </ul>
                <p className="text-sm text-ink-muted">{selected.length} selected</p>
                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button className="flex-1" onClick={submit} disabled={busy}>
                    Finish setup
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
