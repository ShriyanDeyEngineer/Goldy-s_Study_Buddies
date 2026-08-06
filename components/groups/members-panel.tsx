/**
 * Members panel (spec §5.8): the roster with avatars and a crown on the
 * manager; for the manager, the pending join-request queue (Approve /
 * Deny) and per-member Remove buttons; for everyone, Leave group behind
 * a confirmation that spells out the consequence.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Crown, LogOut, UserX } from "lucide-react";
import { toast } from "sonner";
import {
  approveJoinRequestAction,
  denyJoinRequestAction,
  leaveGroupAction,
  removeMemberAction,
} from "@/lib/actions/groups";
import type { GroupMemberRow, JoinRequestRow, PublicProfile } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import Link from "next/link";

export function MembersPanel({
  groupId,
  groupName,
  currentUserId,
  managerId,
  members,
  profiles,
  pendingRequests,
  isManager,
}: {
  groupId: string;
  groupName: string;
  currentUserId: string;
  managerId: string;
  members: GroupMemberRow[];
  profiles: Record<string, PublicProfile>;
  pendingRequests: JoinRequestRow[];
  isManager: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function approve(request: JoinRequestRow) {
    setBusyId(request.id);
    const { result, error } = await approveJoinRequestAction(request.id, groupId);
    setBusyId(null);
    if (error) toast.error(error);
    else if (result === "cancelled_full") {
      // The invariant-#2 message: the group filled while this waited.
      toast.warning("Your group is now full — that request was cancelled and the student was told.");
    } else {
      toast.success("Approved — they're in!");
    }
    router.refresh();
  }

  async function deny(request: JoinRequestRow) {
    setBusyId(request.id);
    const { error } = await denyJoinRequestAction(request.id, groupId);
    setBusyId(null);
    if (error) toast.error(error);
    router.refresh();
  }

  return (
    <section
      aria-label="Members"
      className="flex flex-col gap-4 self-start rounded-xl border border-line bg-surface p-4 shadow-sm"
    >
      <h2 className="font-display text-lg text-ink">Members</h2>

      {/* Manager-only: the request queue. */}
      {isManager && pendingRequests.length > 0 && (
        <div className="rounded-xl bg-gold-light/40 p-3">
          <h3 className="mb-2 text-sm font-medium text-maroon">
            Waiting to join ({pendingRequests.length})
          </h3>
          <ul className="space-y-2">
            {pendingRequests.map((request) => {
              const requester = profiles[request.user_id];
              return (
                <li key={request.id} className="flex items-center gap-2">
                  <Avatar
                    src={requester?.avatar_url}
                    name={requester?.display_name}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {requester?.display_name ?? "A student"}
                    </p>
                    <p className="text-xs text-ink-muted">
                      asked {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    loading={busyId === request.id}
                    onClick={() => approve(request)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === request.id}
                    onClick={() => deny(request)}
                  >
                    Deny
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ul className="space-y-2">
        {members.map((member) => {
          const memberProfile = profiles[member.user_id];
          const isRowManager = member.user_id === managerId;
          const isSelf = member.user_id === currentUserId;
          return (
            <li key={member.user_id} className="flex items-center gap-2.5">
              <Avatar
                src={memberProfile?.avatar_url}
                name={memberProfile?.display_name}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/profile/${member.user_id}`}
                  className="block truncate text-sm font-medium text-ink hover:underline"
                >
                  {memberProfile?.display_name ?? "A student"}
                  {isSelf && <span className="text-ink-muted"> (you)</span>}
                </Link>
              </div>
              {isRowManager && (
                <span title="Group manager" aria-label="Group manager">
                  <Crown aria-hidden className="h-4 w-4 text-gold" fill="currentColor" />
                </span>
              )}
              {/* Manager can remove anyone but themselves (they leave via
                  Leave group, which triggers succession). */}
              {isManager && !isSelf && (
                <ConfirmDialog
                  title={`Remove ${memberProfile?.display_name ?? "this member"}?`}
                  description="They'll lose access to this group's chat and meetups, and they'll be notified that they were removed. They can ask to join again later."
                  confirmLabel="Remove"
                  onConfirm={async () => {
                    const { error } = await removeMemberAction(groupId, member.user_id);
                    if (error) toast.error(error);
                    router.refresh();
                  }}
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-ink-muted hover:text-danger"
                    aria-label={`Remove ${memberProfile?.display_name ?? "member"} from group`}
                  >
                    <UserX aria-hidden className="h-4 w-4" />
                  </Button>
                </ConfirmDialog>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        title="Leave this group?"
        description={
          currentUserId === managerId
            ? `You're the manager: if other members remain, the longest-tenured one takes over ${groupName}; if you're the last member, the group is disbanded for good.`
            : `You'll lose access to ${groupName}'s chat and meetups. You can rejoin later if there's room.`
        }
        confirmLabel="Leave group"
        onConfirm={async () => {
          // On success this action redirects to the dashboard.
          const result = await leaveGroupAction(groupId);
          if (result?.error) toast.error(result.error);
        }}
      >
        <Button variant="outline" className="w-full text-danger">
          <LogOut aria-hidden className="h-4 w-4" />
          Leave group
        </Button>
      </ConfirmDialog>
    </section>
  );
}
