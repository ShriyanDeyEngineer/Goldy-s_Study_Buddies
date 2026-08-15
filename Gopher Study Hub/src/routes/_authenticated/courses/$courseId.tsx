import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Unlock, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/site/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { groupsForCourseQuery, myGroupsQuery } from "@/lib/queries";
import { createGroup, joinGroup } from "@/lib/api.functions";
import { groupSchema, GROUP_CAPACITY_MAX, GROUP_CAPACITY_MIN } from "@/lib/validation";
import { friendlyError } from "@/lib/errors";
import { JOIN_STATE_LABEL, joinState } from "@/lib/groups";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  head: () => ({
    meta: [
      { title: "Course groups — Goldy's Study Buddies" },
      {
        name: "description",
        content: "Browse and join study groups for this University of Minnesota course.",
      },
      { property: "og:title", content: "Study groups for this course" },
      { property: "og:description", content: "Join an open group or start your own." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CourseGroups,
});

function CourseGroups() {
  const { courseId } = Route.useParams();
  const { user, loading } = useSession();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();

  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, department, number, name")
        .eq("id", courseId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const groups = useQuery(groupsForCourseQuery(courseId));
  const mine = useQuery({ ...myGroupsQuery(userId), enabled: Boolean(userId) });
  const myGroupIds = new Set((mine.data ?? []).map((row) => row.group_id));

  async function join(groupId: string) {
    try {
      const { result } = await joinGroup({ data: { groupId } });
      toast.success(result === "requested" ? "Request sent to the manager" : "You're in");
      queryClient.invalidateQueries();
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  if (loading || !userId) return <div className="min-h-screen bg-cream" />;

  return (
    <div className="min-h-screen bg-cream">
      <AppNav userId={userId} />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-sm text-ink-muted">
          <Link to="/courses" className="text-maroon underline">
            My courses
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl text-ink">
              {course.data?.department} {course.data?.number}
            </h1>
            <p className="text-ink-muted">{course.data?.name}</p>
          </div>
          <CreateGroupDialog courseId={courseId} />
        </div>

        <div className="mt-8 space-y-4">
          {groups.isLoading ? <p className="text-sm text-ink-muted">Loading groups…</p> : null}
          {groups.data?.length === 0 ? (
            <Card className="shadow-[var(--shadow-card)]">
              <CardContent className="py-10 text-center">
                <p className="text-ink">No groups for this course yet.</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Start one — people usually join within a day or two.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {groups.data?.map((group) => {
            const state = joinState({
              status: group.status,
              mode: group.mode,
              memberCount: group.member_count,
              capacity: group.capacity,
              isMember: myGroupIds.has(group.id),
              isManager: group.manager_id === userId,
              hasPendingRequest: false,
            });
            const isMemberish = state === "member" || state === "manager";
            return (
              <Card key={group.id} className="shadow-[var(--shadow-card)]">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                  <CardTitle className="font-display text-xl">
                    <Link to="/groups/$groupId" params={{ groupId: group.id }}>
                      {group.name}
                    </Link>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      {group.mode === "open" ? (
                        <Unlock className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Lock className="h-3 w-3" aria-hidden="true" />
                      )}
                      {group.mode === "open" ? "Open" : "Approval needed"}
                    </Badge>
                    <span className="text-sm text-ink-muted">
                      {group.member_count}/{group.capacity}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex justify-end">
                  {isMemberish ? (
                    <Button asChild variant="secondary">
                      <Link to="/groups/$groupId" params={{ groupId: group.id }}>
                        Open group
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      disabled={state === "full" || state === "unavailable" || state === "requested"}
                      onClick={() => join(group.id)}
                    >
                      {JOIN_STATE_LABEL[state]}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function CreateGroupDialog({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("8");
  const [mode, setMode] = useState<"open" | "closed">("open");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const parsed = groupSchema.safeParse({
      courseId,
      name,
      capacity: Number(capacity),
      mode,
      invitees: [],
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the group details.");
      return;
    }
    try {
      await createGroup({ data: parsed.data });
      queryClient.invalidateQueries();
      toast.success("Group created — you're the manager");
      setOpen(false);
      setName("");
      setError(null);
    } catch (submitError) {
      setError(friendlyError(submitError));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create group
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Create a study group</DialogTitle>
          <DialogDescription>
            You&apos;ll be the manager. Open groups let anyone join instantly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Tuesday night problem sets"
            />
          </div>
          <div>
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              type="number"
              min={GROUP_CAPACITY_MIN}
              max={GROUP_CAPACITY_MAX}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
            />
            <p className="mt-1 text-xs text-ink-muted">
              Between {GROUP_CAPACITY_MIN} and {GROUP_CAPACITY_MAX} people.
            </p>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Who can join?</legend>
            <div className="mt-2 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "open"}
                  onChange={() => setMode("open")}
                />
                Anyone in the course (instant)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "closed"}
                  onChange={() => setMode("closed")}
                />
                I approve each request
              </label>
            </div>
          </fieldset>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={submit}>Create group</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
