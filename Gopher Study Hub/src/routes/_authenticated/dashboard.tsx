import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { BookOpen, Users, CalendarDays } from "lucide-react";
import { AppNav } from "@/components/site/AppNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";
import { myCoursesQuery, myGroupsQuery, myInvitationsQuery, profileQuery } from "@/lib/queries";
import { respondInvitation } from "@/lib/api.functions";
import { friendlyError } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Goldy's Study Buddies" },
      {
        name: "description",
        content: "Your UMN courses, study groups, and pending invitations in one place.",
      },
      { property: "og:title", content: "Your study dashboard" },
      { property: "og:description", content: "Courses, groups, and invitations at a glance." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";

  const profile = useQuery({ ...profileQuery(userId), enabled: Boolean(userId) });
  const courses = useQuery({ ...myCoursesQuery(userId), enabled: Boolean(userId) });
  const groups = useQuery({ ...myGroupsQuery(userId), enabled: Boolean(userId) });
  const invitations = useQuery({ ...myInvitationsQuery(userId), enabled: Boolean(userId) });

  useEffect(() => {
    if (profile.data && !profile.data.onboarded_at) {
      navigate({ to: "/onboarding" });
    }
  }, [profile.data, navigate]);

  async function respond(invitationId: string, accept: boolean) {
    try {
      await respondInvitation({ data: { invitationId, accept } });
      toast.success(accept ? "You're in" : "Invitation declined");
      queryClient.invalidateQueries();
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  if (loading || !userId) {
    return <div className="min-h-screen bg-cream" />;
  }

  const displayName = profile.data?.display_name ?? "there";

  return (
    <div className="min-h-screen bg-cream">
      <AppNav userId={userId} />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl text-ink">Hey {displayName}.</h1>
        <p className="mt-1 text-ink-muted">
          {format(new Date(), "EEEE, MMMM d")} — here&apos;s where things stand.
        </p>

        {invitations.data && invitations.data.length > 0 ? (
          <section className="mt-8" aria-labelledby="invites-heading">
            <h2 id="invites-heading" className="text-xl text-ink">
              Invitations
            </h2>
            <div className="mt-3 space-y-3">
              {invitations.data.map((invite) => (
                <Card key={invite.id} className="shadow-[var(--shadow-card)]">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                    <p className="text-sm text-ink">
                      You&apos;ve been invited to{" "}
                      <span className="font-medium">{invite.study_groups?.name}</span>
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => respond(invite.id, true)}>
                        Accept
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => respond(invite.id, false)}>
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <BookOpen className="h-5 w-5 text-maroon" aria-hidden="true" />
                My courses
              </CardTitle>
              <Button asChild size="sm" variant="secondary">
                <Link to="/courses">Manage</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {courses.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : courses.data && courses.data.length > 0 ? (
                <ul className="space-y-2">
                  {courses.data.map((row) => (
                    <li key={`${row.course_id}-${row.enrollment}`} className="text-sm">
                      <Link
                        to="/courses/$courseId"
                        params={{ courseId: row.course_id }}
                        className="font-medium text-maroon hover:underline"
                      >
                        {row.courses?.department} {row.courses?.number}
                      </Link>
                      <span className="text-ink-muted"> — {row.courses?.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">
                  No courses yet.{" "}
                  <Link to="/courses" className="text-maroon underline">
                    Add the classes you&apos;re taking
                  </Link>{" "}
                  to see groups.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <Users className="h-5 w-5 text-maroon" aria-hidden="true" />
                My groups
              </CardTitle>
              <Button asChild size="sm" variant="secondary">
                <Link to="/groups">See all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {groups.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : groups.data && groups.data.length > 0 ? (
                <ul className="space-y-3">
                  {groups.data.map((row) => (
                    <li key={row.group_id} className="text-sm">
                      <Link
                        to="/groups/$groupId"
                        params={{ groupId: row.group_id }}
                        className="font-medium text-maroon hover:underline"
                      >
                        {row.study_groups?.name}
                      </Link>
                      <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                        <Badge variant="secondary">
                          {row.study_groups?.courses?.department} {row.study_groups?.courses?.number}
                        </Badge>
                        <span>
                          {row.study_groups?.member_count}/{row.study_groups?.capacity} members
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">
                  You&apos;re not in a group yet. Pick a course and join one — most groups take new
                  people instantly.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <CalendarDays className="h-5 w-5 text-maroon" aria-hidden="true" />
              Next steps
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-ink-muted">
            Meetups live inside each group. Open a group to schedule one, RSVP, or start the chat.
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
