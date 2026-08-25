/**
 * The group page (/groups/[groupId]) — spec §5.8.
 *
 * NON-MEMBERS get only the preview: name, course, member count, manager,
 * open/closed, and the join control. No chat, no meetups, no member
 * emails — and that's enforced twice: this page doesn't render them, and
 * the database's RLS wouldn't hand the rows to a non-member anyway.
 *
 * MEMBERS get the three panels — Chat, Meetups, Members — side by side
 * on desktop, stacked on mobile. Each panel is rendered exactly ONCE and
 * reflowed with CSS (never a desktop copy + hidden mobile copy — that
 * would open duplicate realtime subscriptions, spec §8).
 */
import { notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { getJoinState } from "@/lib/groups/join-state";
import {
  courseCode,
  type AvailabilityPollRow,
  type AvailabilitySlotRow,
  type CourseRow,
  type GroupMemberRow,
  type GroupResourceRow,
  type GroupMessageRow,
  type JoinRequestRow,
  type MeetupAttendanceRow,
  type MeetupRow,
  type PublicProfile,
  type StudyGroupRow,
} from "@/lib/types";
import { JoinButton } from "@/components/groups/join-button";
import { InvitationBanner } from "@/components/groups/invitation-banner";
import { GroupChat } from "@/components/groups/group-chat";
import { MeetupsPanel } from "@/components/groups/meetups-panel";
import { MembersPanel } from "@/components/groups/members-panel";
import { PollsSection } from "@/components/groups/polls-section";
import { ResourcesPanel } from "@/components/groups/resources-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Users } from "lucide-react";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  if (!UUID_RE.test(groupId)) notFound();

  const { supabase, profile } = await getSessionProfile();
  if (!profile) return null;

  const groupRes = await supabase
    .from("study_groups")
    .select("*, courses(*)")
    .eq("id", groupId)
    .maybeSingle();
  const group = groupRes.data as (StudyGroupRow & { courses: CourseRow }) | null;
  if (!group) notFound();

  // Membership decides which page this is. (RLS lets me see my own row.)
  const membershipRes = await supabase
    .from("study_group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", profile.id)
    .maybeSingle();
  const isMember = !!membershipRes.data;
  const isManager = group.manager_id === profile.id;

  /* ── Non-member: the preview ──────────────────────────────────────── */
  if (!isMember) {
    const [managerRes, myRequestRes, myInvitationRes] = await Promise.all([
      supabase
        .from("public_profiles")
        .select("*")
        .eq("id", group.manager_id)
        .maybeSingle(),
      supabase
        .from("join_requests")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", profile.id)
        .eq("status", "pending")
        .maybeSingle(),
      supabase
        .from("group_invitations")
        .select("id, inviter_id")
        .eq("group_id", groupId)
        .eq("invited_user_id", profile.id)
        .eq("status", "pending")
        .maybeSingle(),
    ]);
    const manager = managerRes.data as PublicProfile | null;
    const invitation = myInvitationRes.data as { id: string; inviter_id: string } | null;

    // Resolve the inviter's name for the invitation banner.
    let inviterName: string | null = null;
    if (invitation) {
      const inviterRes = await supabase
        .from("public_profiles")
        .select("display_name")
        .eq("id", invitation.inviter_id)
        .maybeSingle();
      inviterName = (inviterRes.data?.display_name as string | null) ?? null;
    }

    const state = getJoinState({
      groupStatus: group.status,
      mode: group.mode,
      memberCount: group.member_count,
      capacity: group.capacity,
      isManager: false,
      isMember: false,
      hasPendingRequest: !!myRequestRes.data,
    });

    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardContent className="text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-maroon">
              {courseCode(group.courses)}
            </p>
            <h1 className="mt-1 font-display text-3xl text-ink">{group.name}</h1>

            <div className="mt-4 flex items-center justify-center gap-4 text-sm text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <Users aria-hidden className="h-4 w-4" />
                {group.member_count}/{group.capacity} members
              </span>
              <Badge variant={group.mode === "open" ? "success" : "warning"}>
                {group.mode === "open" ? "Open" : "Closed"}
              </Badge>
            </div>

            {manager && (
              <div className="mt-5 flex items-center justify-center gap-2 text-sm text-ink-muted">
                <Avatar src={manager.avatar_url} name={manager.display_name} size="sm" />
                Managed by <span className="font-medium text-ink">{manager.display_name}</span>
              </div>
            )}

            {/* A pending invitation replaces the ordinary join control —
                accepting seats you even in a closed group. */}
            {invitation && group.status === "active" ? (
              <div className="mt-6">
                <InvitationBanner
                  invitationId={invitation.id}
                  inviterName={inviterName}
                />
              </div>
            ) : (
              <div className="mt-6 flex justify-center">
                <JoinButton groupId={group.id} state={state} size="md" />
              </div>
            )}
            <p className="mt-4 text-xs text-ink-muted">
              Chat, meetups, and the member list unlock when you join.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Member: the full page ────────────────────────────────────────── */
  // Everything the three panels need, fetched in parallel.
  const [messagesRes, membersRes, meetupsRes, pollsRes, resourcesRes, requestsRes] =
    await Promise.all([
      supabase
        .from("group_messages")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true }),
      supabase
        .from("study_group_members")
        .select("*")
        .eq("group_id", groupId)
        .order("joined_at", { ascending: true }),
      supabase
        .from("meetups")
        .select("*")
        .eq("group_id", groupId)
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("availability_polls")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false }),
      supabase
        .from("group_resources")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false }),
      isManager
        ? supabase
            .from("join_requests")
            .select("*")
            .eq("group_id", groupId)
            .eq("status", "pending")
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

  const messages = (messagesRes.data ?? []) as GroupMessageRow[];
  const members = (membersRes.data ?? []) as GroupMemberRow[];
  const meetups = (meetupsRes.data ?? []) as MeetupRow[];
  const polls = (pollsRes.data ?? []) as AvailabilityPollRow[];
  const resources = (resourcesRes.data ?? []) as GroupResourceRow[];
  const pendingRequests = (requestsRes.data ?? []) as JoinRequestRow[];

  // Attendance + poll details depend on the ids we just fetched.
  const meetupIds = meetups.map((m) => m.id);
  const pollIds = polls.map((p) => p.id);
  const [attendanceRes, slotsRes] = await Promise.all([
    meetupIds.length
      ? supabase.from("meetup_attendance").select("*").in("meetup_id", meetupIds)
      : Promise.resolve({ data: [] }),
    pollIds.length
      ? supabase.from("availability_slots").select("*").in("poll_id", pollIds)
      : Promise.resolve({ data: [] }),
  ]);
  const attendance = (attendanceRes.data ?? []) as MeetupAttendanceRow[];
  const slots = (slotsRes.data ?? []) as AvailabilitySlotRow[];

  const slotIds = slots.map((s) => s.id);
  const votesRes = slotIds.length
    ? await supabase.from("availability_votes").select("*").in("slot_id", slotIds)
    : { data: [] };
  const votes = (votesRes.data ?? []) as { slot_id: string; user_id: string }[];

  // One name/avatar lookup for everyone who appears anywhere on the page
  // (members, message senders who might have left, requesters).
  const everyoneIds = [
    ...new Set([
      ...members.map((m) => m.user_id),
      ...messages.map((m) => m.sender_id),
      ...pendingRequests.map((r) => r.user_id),
      ...resources.map((r) => r.author_id),
    ]),
  ];
  const profilesRes = everyoneIds.length
    ? await supabase.from("public_profiles").select("*").in("id", everyoneIds)
    : { data: [] };
  const profileList = (profilesRes.data ?? []) as PublicProfile[];
  const profilesById = Object.fromEntries(profileList.map((p) => [p.id, p]));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-maroon">
            {courseCode(group.courses)} · {group.courses.course_name}
          </p>
          <h1 className="font-display text-3xl text-ink">{group.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={group.mode === "open" ? "success" : "warning"}>
            {group.mode === "open" ? "Open" : "Closed"}
          </Badge>
          {isManager && (
            <a
              href={`/groups/${group.id}/settings`}
              className="text-sm font-medium text-maroon underline underline-offset-2"
            >
              Group settings
            </a>
          )}
        </div>
      </div>

      {/* One render of each panel; CSS handles desktop vs mobile. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <GroupChat
          groupId={group.id}
          currentUserId={profile.id}
          initialMessages={messages}
          initialProfiles={profilesById}
        />
        <MeetupsPanel
          groupId={group.id}
          currentUserId={profile.id}
          isManager={isManager}
          meetups={meetups}
          attendance={attendance}
          groupName={group.name}
          courseLabel={courseCode(group.courses)}
        />
        <MembersPanel
          groupId={group.id}
          groupName={group.name}
          currentUserId={profile.id}
          managerId={group.manager_id}
          members={members}
          profiles={profilesById}
          pendingRequests={pendingRequests}
          isManager={isManager}
        />
      </div>

      {/* Availability polls get the FULL page width — a day × time grid
          needs room to breathe. Up to 7 days fit without any horizontal
          scroll on a laptop; the grid only scrolls sideways past that. */}
      <section className="mt-6 rounded-xl border border-line bg-surface p-4 shadow-sm">
        <PollsSection
          groupId={group.id}
          currentUserId={profile.id}
          isManager={isManager}
          polls={polls}
          slots={slots}
          votes={votes}
          members={members.map((m) => ({
            id: m.user_id,
            display_name: profilesById[m.user_id]?.display_name ?? null,
          }))}
        />
      </section>

      {/* Shared notes & links — full width like the polls. */}
      <section className="mt-6 rounded-xl border border-line bg-surface p-4 shadow-sm">
        <ResourcesPanel
          groupId={group.id}
          currentUserId={profile.id}
          isManager={isManager}
          resources={resources}
          profiles={profilesById}
        />
      </section>
    </div>
  );
}
