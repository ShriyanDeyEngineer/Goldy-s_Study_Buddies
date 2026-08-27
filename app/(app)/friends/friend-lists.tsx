/**
 * The interactive lists on the Friends page: accept/decline incoming
 * requests, cancel outgoing ones, unfriend/disconnect, unblock.
 * Declines are silent — the other person is never notified (spec §5.12).
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  cancelBuddyRequestAction,
  cancelFriendRequestAction,
  disconnectBuddyAction,
  removeFriendAction,
  respondBuddyRequestAction,
  respondFriendRequestAction,
  unblockUserAction,
} from "@/lib/actions/people";
import type { PublicProfile } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card, CardContent } from "@/components/ui/card";

interface RequestRow {
  id: string;
  sender_id: string;
  recipient_id: string;
}

export function FriendLists({
  currentUserId,
  friendIds,
  buddyIds,
  friendRequests,
  buddyRequests,
  blockedIds,
  profiles,
}: {
  currentUserId: string;
  friendIds: string[];
  buddyIds: string[];
  friendRequests: RequestRow[];
  buddyRequests: RequestRow[];
  blockedIds: string[];
  profiles: Record<string, PublicProfile>;
}) {
  const router = useRouter();
  const [running, setRunning] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  // Stay busy through the refresh, not just the action — see the note in
  // profile-actions.tsx. Otherwise the buttons go idle while the lists
  // still show the pre-action state.
  const busy = running || refreshing;

  async function run(action: () => Promise<{ error?: string }>, successNote?: string) {
    setRunning(true);
    const { error } = await action();
    setRunning(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (successNote) toast.success(successNote);
    startRefresh(() => router.refresh());
  }

  const incomingFriend = friendRequests.filter((r) => r.recipient_id === currentUserId);
  const outgoingFriend = friendRequests.filter((r) => r.sender_id === currentUserId);
  const incomingBuddy = buddyRequests.filter((r) => r.recipient_id === currentUserId);
  const outgoingBuddy = buddyRequests.filter((r) => r.sender_id === currentUserId);

  function PersonRow({
    userId,
    children,
  }: {
    userId: string;
    children: React.ReactNode;
  }) {
    const person = profiles[userId];
    return (
      <li className="flex items-center gap-3 py-2.5">
        <Avatar src={person?.avatar_url} name={person?.display_name} />
        <Link
          href={`/profile/${userId}`}
          className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:underline"
        >
          {person?.display_name ?? "A student"}
        </Link>
        <div className="flex shrink-0 gap-2">{children}</div>
      </li>
    );
  }

  function Section({
    title,
    children,
    count,
  }: {
    title: string;
    count: number;
    children: React.ReactNode;
  }) {
    if (count === 0) return null;
    return (
      <Card>
        <CardContent>
          <h2 className="font-display text-lg text-ink">
            {title} <span className="text-sm text-ink-muted">({count})</span>
          </h2>
          <ul className="mt-2 divide-y divide-line">{children}</ul>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Section title="Friend requests for you" count={incomingFriend.length}>
        {incomingFriend.map((request) => (
          <PersonRow key={request.id} userId={request.sender_id}>
            <Button
              size="sm"
              loading={busy}
              onClick={() => run(() => respondFriendRequestAction(request.id, true), "Friend request accepted.")}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => run(() => respondFriendRequestAction(request.id, false), "Request declined.")}
            >
              Decline
            </Button>
          </PersonRow>
        ))}
      </Section>

      <Section title="Buddy requests for you" count={incomingBuddy.length}>
        {incomingBuddy.map((request) => (
          <PersonRow key={request.id} userId={request.sender_id}>
            <Button
              size="sm"
              loading={busy}
              onClick={() => run(() => respondBuddyRequestAction(request.id, true), "Study buddy request accepted.")}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => run(() => respondBuddyRequestAction(request.id, false), "Request declined.")}
            >
              Decline
            </Button>
          </PersonRow>
        ))}
      </Section>

      <Section title="Friends" count={friendIds.length}>
        {friendIds.map((id) => (
          <PersonRow key={id} userId={id}>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/messages/${id}`}>Message</Link>
            </Button>
            <ConfirmDialog
              title={`Unfriend ${profiles[id]?.display_name ?? "this person"}?`}
              description="You'll disappear from each other's friend lists. They won't be notified."
              confirmLabel="Unfriend"
              onConfirm={() => run(() => removeFriendAction(id), "Unfriended.")}
            >
              <Button size="sm" variant="ghost" className="text-ink-muted">
                Unfriend &#62;&#58;&#40;
              </Button>
            </ConfirmDialog>
          </PersonRow>
        ))}
      </Section>

      <Section title="Study buddies" count={buddyIds.length}>
        {buddyIds.map((id) => (
          <PersonRow key={id} userId={id}>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/messages/${id}`}>Message</Link>
            </Button>
            <ConfirmDialog
              title={`End your buddy connection with ${profiles[id]?.display_name ?? "this person"}?`}
              description="You can reconnect later if you both want to."
              confirmLabel="Disconnect"
              onConfirm={() => run(() => disconnectBuddyAction(id), "Buddy connection ended.")}
            >
              <Button size="sm" variant="ghost" className="text-ink-muted">
                Disconnect
              </Button>
            </ConfirmDialog>
          </PersonRow>
        ))}
      </Section>

      <Section title="Requests you sent" count={outgoingFriend.length + outgoingBuddy.length}>
        {outgoingFriend.map((request) => (
          <PersonRow key={request.id} userId={request.recipient_id}>
            <span className="text-xs text-ink-muted">friend request</span>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => run(() => cancelFriendRequestAction(request.id), "Request cancelled.")}
            >
              Cancel
            </Button>
          </PersonRow>
        ))}
        {outgoingBuddy.map((request) => (
          <PersonRow key={request.id} userId={request.recipient_id}>
            <span className="text-xs text-ink-muted">buddy request</span>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => run(() => cancelBuddyRequestAction(request.id), "Request cancelled.")}
            >
              Cancel
            </Button>
          </PersonRow>
        ))}
      </Section>

      <Section title="Blocked" count={blockedIds.length}>
        {blockedIds.map((id) => (
          <PersonRow key={id} userId={id}>
            <Button
              size="sm"
              variant="outline"
              loading={busy}
              onClick={() => run(() => unblockUserAction(id), "Unblocked.")}
            >
              Unblock
            </Button>
          </PersonRow>
        ))}
      </Section>
    </div>
  );
}
