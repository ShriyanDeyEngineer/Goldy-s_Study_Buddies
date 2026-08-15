import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppNav } from "@/components/site/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/hooks/useSession";
import { myCoursesQuery, profileQuery } from "@/lib/queries";
import { saveOnboarding } from "@/lib/api.functions";
import { GRAD_YEAR_MAX, GRAD_YEAR_MIN, onboardingSchema } from "@/lib/validation";
import { friendlyError } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Goldy's Study Buddies" },
      {
        name: "description",
        content: "Update your display name, major, graduation date, and bio for UMN classmates.",
      },
      { property: "og:title", content: "Your profile" },
      { property: "og:description", content: "Keep your study-buddy details current." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
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

function ProfilePage() {
  const { user } = useSession();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const profile = useQuery({ ...profileQuery(userId), enabled: Boolean(userId) });
  const myCourses = useQuery({ ...myCoursesQuery(userId), enabled: Boolean(userId) });

  const [displayName, setDisplayName] = useState("");
  const [major, setMajor] = useState("");
  const [college, setCollege] = useState("");
  const [bio, setBio] = useState("");
  const [gradMonth, setGradMonth] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const data = profile.data;
    if (!data) return;
    setDisplayName(data.display_name ?? "");
    setMajor(data.major ?? "");
    setCollege(data.college ?? "");
    setBio(data.bio ?? "");
    setGradMonth(data.graduation_month ? String(data.graduation_month) : "");
    setGradYear(data.graduation_year ? String(data.graduation_year) : "");
  }, [profile.data]);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = onboardingSchema.safeParse({
      displayName,
      major,
      college,
      bio,
      graduationMonth: gradMonth ? Number(gradMonth) : undefined,
      graduationYear: gradYear ? Number(gradYear) : undefined,
      courseIds: [],
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setBusy(true);
    try {
      await saveOnboarding({ data: parsed.data });
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success("Profile updated");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNav userId={userId} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl">Your profile</h1>
        <p className="mt-1 text-muted-foreground">
          This is what classmates see when they find you in a course or group.
        </p>

        {profile.isLoading ? (
          <Skeleton className="mt-6 h-72 w-full rounded-xl" />
        ) : (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="font-display text-xl">Details</CardTitle>
              <CardDescription>Signed in as {user?.email}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={onSave}>
                <div className="grid gap-2">
                  <Label htmlFor="displayName">Display name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    maxLength={50}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="major">Major</Label>
                    <Input id="major" value={major} onChange={(e) => setMajor(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="college">College</Label>
                    <Input
                      id="college"
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="gradMonth">Graduation month</Label>
                    <select
                      id="gradMonth"
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={gradMonth}
                      onChange={(e) => setGradMonth(e.target.value)}
                    >
                      <option value="">Not set</option>
                      {MONTHS.map((month, index) => (
                        <option key={month} value={index + 1}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gradYear">Graduation year</Label>
                    <Input
                      id="gradYear"
                      inputMode="numeric"
                      placeholder={`${GRAD_YEAR_MIN}–${GRAD_YEAR_MAX}`}
                      value={gradYear}
                      onChange={(e) => setGradYear(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    rows={4}
                    maxLength={500}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <div>
                  <Button type="submit" disabled={busy}>
                    {busy ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-display text-xl">Your courses</CardTitle>
            <CardDescription>Manage enrollment from the course catalog.</CardDescription>
          </CardHeader>
          <CardContent>
            {myCourses.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (myCourses.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No courses yet — add some from Courses to find study buddies.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(myCourses.data ?? []).map((row) => (
                  <Badge key={`${row.course_id}-${row.enrollment}`} variant="secondary">
                    {row.courses?.department} {row.courses?.number}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
