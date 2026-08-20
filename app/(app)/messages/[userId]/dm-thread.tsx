/**
 * The realtime DM thread. Same chat mechanics as group chat (dedupe by
 * id, 2,000-char counter, chronological order with date separators,
 * auto-scroll) with one difference: the subscription filters on
 * "messages TO me" — my own sends render from the action's response, so
 * I only need to hear about incoming ones. Messages that arrive while
 * the thread is open are marked read immediately.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { format, isSameDay } from "date-fns";
import { ArrowLeft, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  markThreadReadAction,
  sendDirectMessageAction,
} from "@/lib/actions/messages";
import { MESSAGE_MAX_LENGTH } from "@/lib/constants";
import { censorProfanity } from "@/lib/profanity";
import type { DirectMessageRow, PublicProfile } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function DmThread({
  currentUserId,
  other,
  initialMessages,
}: {
  currentUserId: string;
  other: PublicProfile;
  initialMessages: DirectMessageRow[];
}) {
  const [messages, setMessages] = React.useState<DirectMessageRow[]>(initialMessages);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const seenIds = React.useRef(new Set(initialMessages.map((m) => m.id)));
  const listRef = React.useRef<HTMLDivElement>(null);

  const overLimit = draft.length > MESSAGE_MAX_LENGTH;
  const empty = draft.trim().length === 0;

  const appendMessage = React.useCallback(
    (message: DirectMessageRow) => {
      if (seenIds.current.has(message.id)) return;
      // This thread only shows messages with THIS person — the incoming
      // subscription hears about every sender, so filter here.
      if (message.sender_id !== other.id && message.sender_id !== currentUserId) return;
      seenIds.current.add(message.id);
      setMessages((current) => [...current, message]);
      if (message.sender_id === other.id) {
        // They messaged while I'm looking — it's read the moment it lands.
        void markThreadReadAction(other.id);
      }
    },
    [other.id, currentUserId],
  );

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`dm:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => appendMessage(payload.new as DirectMessageRow),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, appendMessage]);

  // Keep the newest message in view.
  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send() {
    if (empty || overLimit || sending) return;
    // Same masking the server applies, so the optimistic echo is honest.
    const content = censorProfanity(draft);
    setSending(true);
    const { message, error } = await sendDirectMessageAction(other.id, content);
    setSending(false);
    if (error) {
      toast.error(error);
      return;
    }
    setDraft("");
    if (message) {
      appendMessage({
        id: message.id,
        sender_id: currentUserId,
        recipient_id: other.id,
        content,
        is_read: false,
        created_at: message.created_at,
      });
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-11rem)] max-w-2xl flex-col rounded-xl border border-line bg-surface shadow-sm md:h-[calc(100dvh-10rem)]">
      {/* Thread header */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link
          href="/messages"
          aria-label="Back to all messages"
          className="rounded-lg p-1 text-ink-muted hover:bg-cream focus-visible:outline-2 focus-visible:outline-gold"
        >
          <ArrowLeft aria-hidden className="h-5 w-5" />
        </Link>
        <Avatar src={other.avatar_url} name={other.display_name} />
        <Link
          href={`/profile/${other.id}`}
          className="font-medium text-ink hover:underline"
        >
          {other.display_name ?? "A student"}
        </Link>
      </div>

      {/* History */}
      <div ref={listRef} aria-live="polite" className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            This is the very start of your conversation. Even a &ldquo;hey&rdquo; works.
          </p>
        ) : (
          messages.map((message, index) => {
            const prev = messages[index - 1];
            const mine = message.sender_id === currentUserId;
            const showDateSeparator =
              !prev ||
              !isSameDay(new Date(prev.created_at), new Date(message.created_at));
            return (
              <React.Fragment key={message.id}>
                {showDateSeparator && (
                  <div className="my-3 flex items-center gap-3" role="separator">
                    <span className="h-px flex-1 bg-line" />
                    <span className="text-xs text-ink-muted">
                      {format(new Date(message.created_at), "EEEE, MMMM d")}
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
                <div className={cn("mb-2 flex", mine && "justify-end")}>
                  <div className={cn("max-w-[80%]", mine && "text-right")}>
                    <div
                      className={cn(
                        "inline-block whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-left text-sm",
                        mine ? "bg-maroon text-white" : "bg-cream text-ink",
                      )}
                    >
                      {message.content}
                    </div>
                    <p className="mt-0.5 text-[10px] text-ink-muted">
                      {format(new Date(message.created_at), "h:mm a")}
                    </p>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-line p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder={`Message ${other.display_name ?? "them"}…`}
            aria-label={`Message ${other.display_name ?? "this person"}`}
            aria-describedby="dm-counter"
            className="min-h-0 resize-none"
          />
          <Button
            size="icon"
            onClick={() => void send()}
            disabled={empty || overLimit}
            loading={sending}
            aria-label="Send message"
          >
            {!sending && <SendHorizontal aria-hidden className="h-4 w-4" />}
          </Button>
        </div>
        <p
          id="dm-counter"
          aria-live="polite"
          className={cn(
            "mt-1 text-right text-xs",
            overLimit ? "font-medium text-danger" : "text-ink-muted",
          )}
        >
          {draft.length.toLocaleString()}/{MESSAGE_MAX_LENGTH.toLocaleString()}
          {overLimit && " — too long to send"}
        </p>
      </div>
    </div>
  );
}
