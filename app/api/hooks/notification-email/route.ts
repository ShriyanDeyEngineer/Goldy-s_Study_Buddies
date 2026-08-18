/**
 * POST /api/hooks/notification-email — emails a student when they get an
 * important in-app notification (bug report #9).
 *
 * WHO CALLS THIS: a Supabase DATABASE WEBHOOK, configured once in the
 * dashboard (Database → Webhooks → notifications table → INSERT → this
 * URL, with the shared secret header). Every notification in this app is
 * created inside a Postgres function (app_notify), never by app code, so
 * a webhook on the table is the one place that sees ALL of them — group
 * invites, approvals, removals, disbands, meetups, friend requests…
 *
 * WHAT IT DOES: looks up the recipient's email + notification preference,
 * renders the same sentence the bell shows (lib/notifications.ts, so
 * email and in-app copy can never disagree), and sends it through
 * lib/email.ts. If RESEND_API_KEY isn't configured, sendEmail() is a
 * silent no-op and this route still returns 200 — email is optional
 * everywhere in this app (spec §10) and must never break anything.
 *
 * SECURITY: the request must carry our shared secret; anything else gets
 * a 401. Without that, anyone who found this URL could make us email
 * arbitrary students. The secret lives in NOTIFICATION_WEBHOOK_SECRET on
 * Vercel and is pasted into the webhook's headers in Supabase (SETUP.md).
 * The recipient's email is looked up with the service-role client (RLS
 * would otherwise hide it), which is exactly why the secret is required.
 *
 * WHAT WE DON'T EMAIL: chat messages and DMs. Those arrive by the second;
 * emailing each one would be spam. The bell/badge handle those live.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { renderNotification } from "@/lib/notifications";
import { getSiteUrl } from "@/lib/site";
import type { NotificationRow } from "@/lib/types";

/** Types worth an email. Everything else stays in-app only. */
const EMAIL_WORTHY = new Set([
  "group_invitation",
  "invitation_accepted",
  "join_request_received",
  "join_request_approved",
  "join_request_denied",
  "request_cancelled_group_full",
  "removed_from_group",
  "group_disbanded",
  "manager_transferred",
  "meetup_created",
  "meetup_cancelled",
  "friend_request",
  "friend_request_accepted",
  "buddy_request",
  "buddy_request_accepted",
]);

/** Shape Supabase Database Webhooks POST for an INSERT. */
interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: NotificationRow | null;
}

export async function POST(request: Request) {
  // ── Auth: shared secret, constant-time-ish compare ─────────────────
  const expected = process.env.NOTIFICATION_WEBHOOK_SECRET;
  const provided = request.headers.get("x-webhook-secret");
  if (!expected || !provided || provided.length !== expected.length) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  if (mismatch !== 0) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const notification = payload.record;
  if (payload.type !== "INSERT" || !notification || !EMAIL_WORTHY.has(notification.type)) {
    // Not our concern — acknowledge so Supabase doesn't retry.
    return NextResponse.json({ skipped: true });
  }

  // ── Recipient lookup (service role: profiles.email is RLS-hidden) ──
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email, display_name, account_status, email_notifications")
    .eq("id", notification.recipient_id)
    .maybeSingle();

  if (
    !profile ||
    profile.account_status !== "active" ||
    profile.email_notifications === false
  ) {
    return NextResponse.json({ skipped: true });
  }

  const { message, href } = renderNotification(notification);
  const link = `${getSiteUrl()}${href}`;

  await sendEmail({
    to: profile.email,
    subject: `Goldy's Study Buddies: ${message}`,
    text:
      `Hi ${profile.display_name ?? "there"},\n\n` +
      `${message}\n\n` +
      `Open it here: ${link}\n\n` +
      `— Goldy's Study Buddies\n` +
      `You're getting this because a group or classmate did something that involves you. ` +
      `Turn these emails off any time under Edit profile → Notifications.`,
  });

  return NextResponse.json({ sent: true });
}
