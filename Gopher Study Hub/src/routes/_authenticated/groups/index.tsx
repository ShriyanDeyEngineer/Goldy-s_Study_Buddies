import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock, Unlock } from "lucide-react";
import { AppNav } from "@/components/site/AppNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/hooks/useSession";
import { myGroupsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/groups/")({
  head: () => ({
    meta: [
      { title: "My groups — Goldy's Study Buddies" },
      {
        name: "description",
        content: "Every study group you belong to, with member counts and quick access to chat.",
      },
      { property: "og:title", content: "Your study groups" },
      { property: "og:description", content: "Jump back into the chat or schedule a meetup." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const { user, loading } = useSession();
  const userId = user?.id ?? "";
  const groups = useQuery({ ...myGroupsQuery(userId), enabled: Boolean(userId) });

  if (loading || !userId) return <div className="min-h-screen bg-cream" />;

  return (
    <div className="min-h-screen bg-cream">
      <AppNav userId={userId} />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl text-ink">My groups</h1>

        {groups.data && groups.data.length > 0 ? (
          <div className="mt-6 space-y-4">
            {groups.data.map((row) => {
              const group = row.study_groups;
              if (!group) return null;
              return (
                <Card key={row.group_id} className="shadow-[var(--shadow-card)]">
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="font-display text-xl">
                        <Link to="/groups/$groupId" params={{ groupId: row.group_id }}>
                          {group.name}
                        </Link>
                      </CardTitle>
                      <p className="mt-1 text-sm text-ink-muted">
                        {group.courses?.department} {group.courses?.number} — {group.courses?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {group.manager_id === userId ? <Badge>Manager</Badge> : null}
                      <Badge variant="secondary" className="gap-1">
                        {group.mode === "open" ? (
                          <Unlock className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <Lock className="h-3 w-3" aria-hidden="true" />
                        )}
                        {group.member_count}/{group.capacity}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex justify-end">
                    <Button asChild variant="secondary">
                      <Link to="/groups/$groupId" params={{ groupId: row.group_id }}>
                        Open
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="mt-6 shadow-[var(--shadow-card)]">
            <CardContent className="py-12 text-center">
              <p className="text-ink">You&apos;re not in any groups yet.</p>
              <p className="mt-1 text-sm text-ink-muted">
                Head to a course and join one — it takes one click for open groups.
              </p>
              <Button asChild className="mt-6">
                <Link to="/courses">Browse my courses</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
