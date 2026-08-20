/**
 * Friends & connections (/friends): your friends, incoming/outgoing
 * friend requests, study buddies, buddy requests, and your block list
 * (with unblock). Linked from notifications and profiles.
 */
import { getSessionProfile } from "@/lib/supabase/server";
import type { PublicProfile } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FriendLists } from "./friend-lists";

export const metadata = { title: "Friends & Buddies" };

interface RequestRow {
  id: string;
  sender_id: string;
  recipient_id: string;
}

export default async function FriendsPage() {
  const { supabase, profile } = await getSessionProfile();
  if (!profile) return null;

  const [friendsRes, friendReqRes, buddiesRes, buddyReqRes, blocksRes] =
    await Promise.all([
      supabase
        .from("friends")
        .select("user_id_a, user_id_b")
        .or(`user_id_a.eq.${profile.id},user_id_b.eq.${profile.id}`),
      supabase
        .from("friend_requests")
        .select("id, sender_id, recipient_id")
        .eq("status", "pending")
        .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`),
      supabase
        .from("study_buddy_connections")
        .select("user_id_a, user_id_b")
        .or(`user_id_a.eq.${profile.id},user_id_b.eq.${profile.id}`),
      supabase
        .from("study_buddy_requests")
        .select("id, sender_id, recipient_id")
        .eq("status", "pending")
        .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`),
      supabase.from("blocks").select("blocked_id").eq("blocker_id", profile.id),
    ]);

  const friendIds = (friendsRes.data ?? []).map((f) =>
    f.user_id_a === profile.id ? (f.user_id_b as string) : (f.user_id_a as string),
  );
  const buddyIds = (buddiesRes.data ?? []).map((b) =>
    b.user_id_a === profile.id ? (b.user_id_b as string) : (b.user_id_a as string),
  );
  const friendRequests = (friendReqRes.data ?? []) as RequestRow[];
  const buddyRequests = (buddyReqRes.data ?? []) as RequestRow[];
  const blockedIds = (blocksRes.data ?? []).map((b) => b.blocked_id as string);

  // One identity lookup for every face on the page.
  const everyone = [
    ...new Set([
      ...friendIds,
      ...buddyIds,
      ...blockedIds,
      ...friendRequests.flatMap((r) => [r.sender_id, r.recipient_id]),
      ...buddyRequests.flatMap((r) => [r.sender_id, r.recipient_id]),
    ]),
  ].filter((id) => id !== profile.id);

  const profilesRes = everyone.length
    ? await supabase.from("public_profiles").select("*").in("id", everyone)
    : { data: [] };
  const profiles = Object.fromEntries(
    ((profilesRes.data ?? []) as PublicProfile[]).map((p) => [p.id, p]),
  );

  const nothingAnywhere =
    friendIds.length === 0 &&
    buddyIds.length === 0 &&
    friendRequests.length === 0 &&
    buddyRequests.length === 0 &&
    blockedIds.length === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-display text-3xl text-ink">Friends &amp; Buddies</h1>
      {nothingAnywhere ? (
        <EmptyState
          title="No connections yet"
          description="Added study buddies will show up here."
          action={
            <Button asChild>
              <Link href="/people">Find people</Link>
            </Button>
          }
        />
      ) : (
        <FriendLists
          currentUserId={profile.id}
          friendIds={friendIds}
          buddyIds={buddyIds}
          friendRequests={friendRequests}
          buddyRequests={buddyRequests}
          blockedIds={blockedIds}
          profiles={profiles}
        />
      )}
    </div>
  );
}
