/**
 * One DM thread (/messages/[userId]). Loads the full history (RLS only
 * returns messages where you're sender or recipient), marks incoming
 * ones read, and hands off to the realtime thread component.
 */
import { notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { markThreadReadAction } from "@/lib/actions/messages";
import type { DirectMessageRow, PublicProfile } from "@/lib/types";
import { DmThread } from "./dm-thread";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DmThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  if (!UUID_RE.test(userId)) notFound();

  const { supabase, profile } = await getSessionProfile();
  if (!profile) return null;
  if (userId === profile.id) notFound(); // no self-threads

  const [otherRes, messagesRes] = await Promise.all([
    supabase.from("public_profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("direct_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${profile.id},recipient_id.eq.${userId}),` +
          `and(sender_id.eq.${userId},recipient_id.eq.${profile.id})`,
      )
      .order("created_at", { ascending: true }),
  ]);

  const other = otherRes.data as PublicProfile | null;
  if (!other) notFound(); // gone or suspended

  // Opening the thread clears its unread badge (spec §5.12).
  await markThreadReadAction(userId);

  return (
    <DmThread
      currentUserId={profile.id}
      other={other}
      initialMessages={(messagesRes.data ?? []) as DirectMessageRow[]}
    />
  );
}
