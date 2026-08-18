/**
 * Meetups panel (spec §5.8): upcoming and past meetups, RSVP with a live
 * attendee count, Add-to-Google-Calendar, cancel (creator/manager).
 *
 * The availability POLLS used to live at the bottom of this panel. They
 * moved to their own full-width row on the group page: a day × time grid
 * squeezed into a one-third column was unreadable past ~4 days.
 *
 * "Upcoming" vs "past" is decided by comparing scheduled_at to now AT
 * RENDER TIME — there is no status column and no background job, on
 * purpose (spec: derive it at query time).
 *
 * The attendee count is COUNTED from the RSVP rows passed in — never a
 * stored number (counter-drift pitfall #7).
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  CalendarPlus,
  ExternalLink,
  MapPin,
  Video,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cancelMeetupAction, rsvpAction } from "@/lib/actions/meetups";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatDuration } from "@/lib/format";
import type {
  MeetupAttendanceRow,
  MeetupRow,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MeetupFormDialog } from "@/components/groups/meetup-form-dialog";
import { cn, pluralize } from "@/lib/utils";

const RSVP_OPTIONS = [
  { value: "attending", label: "Attending" },
  { value: "maybe", label: "Maybe" },
  { value: "not_attending", label: "Can't make it" },
] as const;

export function MeetupsPanel({
  groupId,
  currentUserId,
  isManager,
  meetups,
  attendance,
  groupName,
  courseLabel,
}: {
  groupId: string;
  currentUserId: string;
  isManager: boolean;
  meetups: MeetupRow[];
  attendance: MeetupAttendanceRow[];
  groupName: string;
  courseLabel: string;
}) {
  const router = useRouter();
  const now = Date.now();

  const upcoming = meetups.filter((m) => new Date(m.scheduled_at).getTime() > now);
  const past = meetups
    .filter((m) => new Date(m.scheduled_at).getTime() <= now)
    .reverse(); // newest past first

  return (
    <section
      aria-label="Meetups"
      className="flex flex-col gap-4 self-start rounded-xl border border-line bg-surface p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Meetups</h2>
        <MeetupFormDialog groupId={groupId} />
      </div>

      {upcoming.length === 0 && past.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">
          Nothing scheduled yet. Plan the first session — or open a poll below to
          find a time that works for everyone.
        </p>
      ) : (
        <>
          {upcoming.length > 0 && (
            <ul className="space-y-3">
              {upcoming.map((meetup) => (
                <MeetupCard
                  key={meetup.id}
                  meetup={meetup}
                  attendance={attendance}
                  currentUserId={currentUserId}
                  canCancel={isManager || meetup.creator_id === currentUserId}
                  groupId={groupId}
                  groupName={groupName}
                  courseLabel={courseLabel}
                  isPast={false}
                  onChanged={() => router.refresh()}
                />
              ))}
            </ul>
          )}
          {past.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-ink-muted">
                Past meetups ({past.length})
              </summary>
              <ul className="mt-3 space-y-3">
                {past.map((meetup) => (
                  <MeetupCard
                    key={meetup.id}
                    meetup={meetup}
                    attendance={attendance}
                    currentUserId={currentUserId}
                    canCancel={false}
                    groupId={groupId}
                    groupName={groupName}
                    courseLabel={courseLabel}
                    isPast
                    onChanged={() => router.refresh()}
                  />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function MeetupCard({
  meetup,
  attendance,
  currentUserId,
  canCancel,
  groupId,
  groupName,
  courseLabel,
  isPast,
  onChanged,
}: {
  meetup: MeetupRow;
  attendance: MeetupAttendanceRow[];
  currentUserId: string;
  canCancel: boolean;
  groupId: string;
  groupName: string;
  courseLabel: string;
  isPast: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");

  const rows = attendance.filter((a) => a.meetup_id === meetup.id);
  // Derived, never stored: the count always equals the rows (pitfall #7).
  const attendingCount = rows.filter((a) => a.status === "attending").length;
  const myRsvp = rows.find((a) => a.user_id === currentUserId)?.status ?? null;

  async function setRsvp(status: "attending" | "maybe" | "not_attending") {
    if (busy) return;
    setBusy(true);
    const { error } = await rsvpAction(meetup.id, groupId, status);
    setBusy(false);
    if (error) toast.error(error);
    onChanged();
  }

  // Real end time from the stored duration (bug report #2) — the calendar
  // event now matches what the group actually planned instead of a
  // one-hour guess.
  const startsAt = new Date(meetup.scheduled_at);
  const durationMinutes = meetup.duration_minutes ?? 60;
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  const calendarHref = googleCalendarUrl({
    title: `${groupName} — ${meetup.title}`,
    startsAt,
    endsAt,
    location: meetup.format === "online" ? (meetup.meeting_link ?? "") : (meetup.location ?? ""),
    details: `Study session for ${courseLabel} with ${groupName} (via Goldy's Study Buddies).`,
  });

  return (
    <li
      className={cn(
        "rounded-xl border border-line p-3",
        meetup.is_cancelled && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {/* Cancelled meetups render struck through (spec §5.8). */}
          <h3
            className={cn(
              "font-medium text-ink",
              meetup.is_cancelled && "line-through decoration-danger/60",
            )}
          >
            {meetup.title}
          </h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            {/* Stored in UTC; format() renders the viewer's local time.
                Shows the full window + how long, e.g.
                "Tue, Sep 9 · 3:00 – 4:30 PM (1 h 30 min)". */}
            {format(startsAt, "EEE, MMM d · h:mm")}
            {" – "}
            {format(endsAt, "h:mm a")}
            <span className="text-ink-muted/80"> ({formatDuration(durationMinutes)})</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
            {meetup.format === "online" ? (
              <>
                <Video aria-hidden className="h-4 w-4 shrink-0" />
                {meetup.meeting_link && !meetup.is_cancelled ? (
                  <a
                    href={meetup.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-maroon underline underline-offset-2"
                  >
                    Join online <ExternalLink aria-hidden className="inline h-3 w-3" />
                  </a>
                ) : (
                  "Online"
                )}
              </>
            ) : (
              <>
                <MapPin aria-hidden className="h-4 w-4 shrink-0" />
                <span className="truncate">{meetup.location}</span>
              </>
            )}
          </p>
        </div>
        {!meetup.is_cancelled && !isPast && (
          <a
            href={calendarHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Add to Google Calendar"
            aria-label="Add to Google Calendar"
            className="rounded-lg p-1.5 text-ink-muted hover:bg-cream hover:text-maroon focus-visible:outline-2 focus-visible:outline-gold"
          >
            <CalendarPlus aria-hidden className="h-4 w-4" />
          </a>
        )}
      </div>

      {meetup.is_cancelled ? (
        <p className="mt-2 text-sm text-danger">
          Cancelled{meetup.cancellation_reason ? ` — ${meetup.cancellation_reason}` : "."}
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm font-medium text-ink" aria-live="polite">
            {pluralize(attendingCount, "person", "people")} attending
          </p>
          {!isPast && (
            <div
              className="mt-2 flex flex-wrap gap-1.5"
              role="group"
              aria-label={`RSVP for ${meetup.title}`}
            >
              {RSVP_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={myRsvp === option.value ? "primary" : "outline"}
                  disabled={busy}
                  onClick={() => setRsvp(option.value)}
                  aria-pressed={myRsvp === option.value}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          )}
          {canCancel && !isPast && (
            <ConfirmDialog
              title={`Cancel "${meetup.title}"?`}
              description="Everyone in the group will be notified and the meetup will show as cancelled. Optionally say why below — it'll be included in the notification."
              confirmLabel="Cancel meetup"
              body={
                <input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  maxLength={300}
                  placeholder="Reason (optional)"
                  aria-label="Cancellation reason (optional)"
                  className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-gold"
                />
              }
              onConfirm={async () => {
                const { error } = await cancelMeetupAction(
                  meetup.id,
                  groupId,
                  cancelReason.trim() || undefined,
                );
                if (error) toast.error(error);
                setCancelReason("");
                onChanged();
              }}
            >
              <Button size="sm" variant="ghost" className="mt-2 text-ink-muted hover:text-danger">
                <XCircle aria-hidden className="h-3.5 w-3.5" />
                Cancel meetup
              </Button>
            </ConfirmDialog>
          )}
        </>
      )}
    </li>
  );
}
