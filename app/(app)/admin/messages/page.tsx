/**
 * /admin/messages — the uncensored log. Every chat/DM message the filter
 * masked keeps its ORIGINAL text in message_originals (0017); this page
 * is where admins see what the person actually tried to say. What other
 * users see stays censored.
 */
import { getSessionProfile } from "@/lib/supabase/server";
import type { MessageOriginalRow } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export const metadata = { title: "Flagged messages · Admin" };

type NameRow = { id: string; display_name: string | null; account_status: string };

export default async function AdminMessagesPage() {
  const { supabase } = await getSessionProfile();

  const originalsRes = await supabase
    .from("message_originals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const originals = (originalsRes.data ?? []) as MessageOriginalRow[];

  const senderIds = [...new Set(originals.map((o) => o.sender_id))];
  const namesRes = senderIds.length
    ? await supabase.from("profiles").select("id, display_name, account_status").in("id", senderIds)
    : { data: [] };
  const names = Object.fromEntries(
    ((namesRes.data ?? []) as NameRow[]).map((p) => [p.id, p]),
  );

  return (
    <div>
      <p className="mb-4 text-sm text-ink-muted">
        Messages the profanity filter masked, shown here UNCENSORED — other
        users only ever see the masked version. Latest 200.
      </p>
      {originals.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing has been masked yet.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          {originals.map((original) => {
            const sender = names[original.sender_id];
            return (
              <li key={original.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <Link
                    href={`/profile/${original.sender_id}`}
                    className="font-medium text-maroon underline underline-offset-2"
                  >
                    {sender?.display_name ?? "Deleted User"}
                  </Link>
                  <Badge variant={original.message_kind === "group" ? "gold" : "outline"}>
                    {original.message_kind === "group" ? "group chat" : "DM"}
                  </Badge>
                  {formatDistanceToNow(new Date(original.created_at), { addSuffix: true })}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">
                  {original.original_content}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
