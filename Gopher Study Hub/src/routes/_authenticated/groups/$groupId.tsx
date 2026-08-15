import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { toast } from "sonner";
import { CalendarPlus, Send, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/site/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  groupMembersQuery,
  groupMessagesQuery,
  groupQuery,
  meetupsQuery,
  pendingRequestsQuery,
} from "@/lib/queries";
import {
  cancelMeetup,
  createMeetup,
  decideRequest,
  disbandGroup,
  leaveGroup,
  removeMember,
  renameGroup,
  sendGroupMessage,
  setGroupMode,
  setRsvp,
} from "@/lib/api.functions";
import { MESSAGE_MAX, meetupSchema } from "@/lib/validation";
import { friendlyError } from "@/lib/errors";
import { googleCalendarUrl, localInputToUtcIso } from "@/lib/groups";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  head: () => ({
    meta: [
      { title: "Study group — Goldy's Study Buddies" },
      {
        name: "description",
        content: "Chat with your group, schedule meetups, and manage members.",
      },
      { property: "og:title", content: "Your study group" },
      { property: "og:description", content: "Chat, meetups, and members in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GroupDetail,
});

function GroupDetail() {
  const { groupId } = Route.useParams();
  const { user, loading } = useSession();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const group = useQuery(groupQuery(groupId));
  const members = useQuery(groupMembersQuery(groupId));
  const isManager = group.data?.manager_id === userId;
  const requests = useQuery({ ...pendingRequestsQuery(groupId), enabled: isManager });

  async function decide(requestId: string, approve: boolean) {
    try {
      await decideRequest({ data: { requestId, approve } });
      toast.success(approve ? "Member added" : "Request declined");
      queryClient.invalidateQueries();
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  async function leave() {
    try {
      await leaveGroup({ data: { groupId } });
      toast.success("You left the group");
      navigate({ to: "/groups" });
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  if (loading || !userId) return <div className="min-h-screen bg-cream" />;

  if (!group.isLoading && !group.data) {
    return (
      <div className="min-h-screen bg-cream">
        <AppNav userId={userId} />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-2xl text-ink">This group isn&apos;t available.</h1>
          <p className="mt-2 text-ink-muted">It may have been disbanded, or you&apos;re not a member.</p>
          <Button asChild className="mt-6">
            <Link to="/groups">Back to my groups</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <AppNav userId={userId} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl text-ink">{group.data?.name}</h1>
            <p className="mt-1 text-ink-muted">
              {group.data?.courses?.department} {group.data?.courses?.number} —{" "}
              {group.data?.courses?.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {group.data?.member_count}/{group.data?.capacity} members
            </Badge>
            {isManager ? (
              <ManageDialog
                groupId={groupId}
                currentName={group.data?.name ?? ""}
                currentMode={group.data?.mode ?? "open"}
              />
            ) : (
              <Button variant="ghost" onClick={leave}>
                Leave group
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="chat" className="mt-6">
          <TabsList>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="meetups">Meetups</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            {isManager ? (
              <TabsTrigger value="requests">
                Requests{requests.data?.length ? ` (${requests.data.length})` : ""}
              </TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="chat">
            <GroupChat groupId={groupId} userId={userId} />
          </TabsContent>

          <TabsContent value="meetups">
            <Meetups groupId={groupId} userId={userId} isManager={isManager} />
          </TabsContent>

          <TabsContent value="members">
            <Card className="shadow-[var(--shadow-card)]">
              <CardContent className="pt-6">
                <ul className="divide-y divide-line">
                  {members.data?.map((member) => (
                    <li key={member.user_id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {member.profiles?.display_name ?? "Student"}
                          {member.user_id === group.data?.manager_id ? (
                            <Badge className="ml-2">Manager</Badge>
                          ) : null}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {member.profiles?.major ?? "Undeclared"} · joined{" "}
                          {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
                        </p>
                      </div>
                      {isManager && member.user_id !== userId ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await removeMember({ data: { groupId, memberId: member.user_id } });
                              toast.success("Member removed");
                              queryClient.invalidateQueries();
                            } catch (error) {
                              toast.error(friendlyError(error));
                            }
                          }}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {isManager ? (
            <TabsContent value="requests">
              <Card className="shadow-[var(--shadow-card)]">
                <CardContent className="pt-6">
                  {requests.data && requests.data.length > 0 ? (
                    <ul className="divide-y divide-line">
                      {requests.data.map((request) => (
                        <li key={request.id} className="flex items-center justify-between py-3">
                          <div>
                            <p className="text-sm font-medium text-ink">
                              {request.profiles?.display_name ?? "Student"}
                            </p>
                            <p className="text-xs text-ink-muted">
                              {request.profiles?.major ?? "Undeclared"} · asked{" "}
                              {formatDistanceToNow(new Date(request.created_at), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => decide(request.id, true)}>
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => decide(request.id, false)}
                            >
                              Decline
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-6 text-center text-sm text-ink-muted">
                      No pending requests right now.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ) : null}
        </Tabs>
      </main>
    </div>
  );
}

function GroupChat({ groupId, userId }: { groupId: string; userId: string }) {
  const queryClient = useQueryClient();
  const messages = useQuery(groupMessagesQuery(groupId));
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["group-messages", groupId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data?.length]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setBusy(true);
    try {
      await sendGroupMessage({ data: { groupId, content } });
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["group-messages", groupId] });
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardContent className="pt-6">
        <div className="h-96 space-y-3 overflow-y-auto pr-1" role="log" aria-label="Group chat">
          {messages.data?.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-muted">
              No messages yet. Someone has to go first — &ldquo;hey, anyone starting the homework?&rdquo;
              works fine.
            </p>
          ) : null}
          {messages.data?.map((message) => {
            const mine = message.sender_id === userId;
            return (
              <div key={message.id} className={mine ? "text-right" : "text-left"}>
                <p className="text-xs text-ink-muted">
                  {mine ? "You" : (message.profiles?.display_name ?? "Student")} ·{" "}
                  {format(new Date(message.created_at), "MMM d, h:mm a")}
                </p>
                <p
                  className={`mt-1 inline-block max-w-[85%] rounded-lg px-3 py-2 text-left text-sm ${
                    mine ? "bg-maroon text-white" : "bg-cream text-ink"
                  }`}
                >
                  {message.content}
                </p>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="mt-4 flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="chat-input" className="sr-only">
              Message
            </Label>
            <Textarea
              id="chat-input"
              value={draft}
              maxLength={MESSAGE_MAX}
              rows={2}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a message…"
            />
            <p className="mt-1 text-right text-xs text-ink-muted">
              {draft.length}/{MESSAGE_MAX}
            </p>
          </div>
          <Button type="submit" disabled={busy || !draft.trim()} aria-label="Send message">
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Meetups({
  groupId,
  userId,
  isManager,
}: {
  groupId: string;
  userId: string;
  isManager: boolean;
}) {
  const queryClient = useQueryClient();
  const meetups = useQuery(meetupsQuery(groupId));

  async function rsvp(meetupId: string, status: "attending" | "maybe" | "not_attending") {
    try {
      await setRsvp({ data: { meetupId, status } });
      queryClient.invalidateQueries({ queryKey: ["meetups", groupId] });
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateMeetupDialog groupId={groupId} />
      </div>
      {meetups.data?.length === 0 ? (
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="py-12 text-center text-sm text-ink-muted">
            No meetups scheduled. Pick a time and people will RSVP.
          </CardContent>
        </Card>
      ) : null}
      {meetups.data?.map((meetup) => {
        const mine = meetup.meetup_attendance?.find((row) => row.user_id === userId);
        const going = meetup.meetup_attendance?.filter((row) => row.status === "attending").length ?? 0;
        const past = isPast(new Date(meetup.scheduled_at));
        return (
          <Card key={meetup.id} className="shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="font-display text-lg">
                {meetup.title}
                {meetup.cancelled ? <Badge className="ml-2">Cancelled</Badge> : null}
              </CardTitle>
              <p className="text-sm text-ink-muted">
                {format(new Date(meetup.scheduled_at), "EEE, MMM d 'at' h:mm a")} ·{" "}
                {meetup.format === "online" ? "Online" : meetup.location}
              </p>
              {meetup.cancelled && meetup.cancellation_reason ? (
                <p className="text-sm text-destructive">{meetup.cancellation_reason}</p>
              ) : null}
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted">{going} going</p>
              {!meetup.cancelled && !past ? (
                <div className="flex flex-wrap gap-2">
                  {(["attending", "maybe", "not_attending"] as const).map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={mine?.status === status ? "default" : "secondary"}
                      onClick={() => rsvp(meetup.id, status)}
                    >
                      {status === "attending" ? "Going" : status === "maybe" ? "Maybe" : "Can't make it"}
                    </Button>
                  ))}
                  <Button asChild size="sm" variant="ghost">
                    <a
                      href={googleCalendarUrl({
                        title: meetup.title,
                        scheduledAt: meetup.scheduled_at,
                        location: meetup.location ?? meetup.meeting_link ?? "",
                      })}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                      Add to calendar
                    </a>
                  </Button>
                  {(isManager || meetup.creator_id === userId) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await cancelMeetup({ data: { meetupId: meetup.id } });
                          toast.success("Meetup cancelled");
                          queryClient.invalidateQueries({ queryKey: ["meetups", groupId] });
                        } catch (error) {
                          toast.error(friendlyError(error));
                        }
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CreateMeetupDialog({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [meetupFormat, setMeetupFormat] = useState<"online" | "in_person">("in_person");
  const [location, setLocation] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const iso = localInputToUtcIso(when);
    const parsed = meetupSchema.safeParse({
      title,
      scheduledAt: iso ?? "",
      format: meetupFormat,
      location,
      meetingLink: link,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the meetup details.");
      return;
    }
    try {
      await createMeetup({ data: { groupId, ...parsed.data } });
      queryClient.invalidateQueries({ queryKey: ["meetups", groupId] });
      toast.success("Meetup scheduled");
      setOpen(false);
      setTitle("");
      setWhen("");
      setError(null);
    } catch (submitError) {
      setError(friendlyError(submitError));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          Schedule meetup
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Schedule a meetup</DialogTitle>
          <DialogDescription>Everyone in the group gets notified.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="meetup-title">Title</Label>
            <Input
              id="meetup-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Exam 2 review"
            />
          </div>
          <div>
            <Label htmlFor="meetup-when">Date and time</Label>
            <Input
              id="meetup-when"
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Format</legend>
            <div className="mt-2 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="format"
                  checked={meetupFormat === "in_person"}
                  onChange={() => setMeetupFormat("in_person")}
                />
                In person
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="format"
                  checked={meetupFormat === "online"}
                  onChange={() => setMeetupFormat("online")}
                />
                Online
              </label>
            </div>
          </fieldset>
          {meetupFormat === "in_person" ? (
            <div>
              <Label htmlFor="meetup-location">Location</Label>
              <Input
                id="meetup-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Walter Library, 3rd floor"
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="meetup-link">Meeting link</Label>
              <Input
                id="meetup-link"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                placeholder="https://umn.zoom.us/j/…"
              />
            </div>
          )}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={submit}>Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageDialog({
  groupId,
  currentName,
  currentMode,
}: {
  groupId: string;
  currentName: string;
  currentMode: "open" | "closed";
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Settings className="h-4 w-4" aria-hidden="true" />
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Manage group</DialogTitle>
          <DialogDescription>Only you can see these controls.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <Label htmlFor="rename">Group name</Label>
            <div className="mt-1 flex gap-2">
              <Input id="rename" value={name} onChange={(event) => setName(event.target.value)} />
              <Button
                onClick={async () => {
                  try {
                    await renameGroup({ data: { groupId, name: name.trim() } });
                    toast.success("Group renamed");
                    queryClient.invalidateQueries({ queryKey: ["group", groupId] });
                  } catch (renameError) {
                    setError(friendlyError(renameError));
                  }
                }}
              >
                Save
              </Button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">Joining</p>
            <p className="mt-1 text-xs text-ink-muted">
              Currently {currentMode === "open" ? "open to anyone in the course" : "approval only"}.
            </p>
            <Button
              variant="secondary"
              className="mt-2"
              onClick={async () => {
                try {
                  const { approved } = await setGroupMode({
                    data: { groupId, mode: currentMode === "open" ? "closed" : "open" },
                  });
                  toast.success(
                    currentMode === "open"
                      ? "Group now requires approval"
                      : approved > 0
                        ? `Group opened — ${approved} pending request(s) approved`
                        : "Group is now open",
                  );
                  queryClient.invalidateQueries();
                } catch (modeError) {
                  setError(friendlyError(modeError));
                }
              }}
            >
              Switch to {currentMode === "open" ? "approval only" : "open"}
            </Button>
          </div>

          <div>
            <p className="text-sm font-medium text-destructive">Disband group</p>
            <p className="mt-1 text-xs text-ink-muted">
              Removes everyone and closes the chat. This can&apos;t be undone.
            </p>
            <Button
              variant="destructive"
              className="mt-2"
              onClick={async () => {
                try {
                  await disbandGroup({ data: { groupId } });
                  toast.success("Group disbanded");
                  navigate({ to: "/groups" });
                } catch (disbandError) {
                  setError(friendlyError(disbandError));
                }
              }}
            >
              Disband
            </Button>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
