/**
 * "Add to Google Calendar" link builder (spec §5.8).
 *
 * Uses Google's plain calendar-template URL — a prefilled event the
 * student confirms in their own Google Calendar. Deliberately NOT the
 * Calendar API: no OAuth, no API key, nothing to configure or leak.
 *
 * Pure function, unit-tested (including the UTC formatting).
 */

/** 2026-03-07T19:30:00.000Z → "20260307T193000Z" (the format Google's
 *  `dates` parameter requires: basic ISO-8601, UTC, no punctuation). */
function toGoogleUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export interface CalendarEvent {
  title: string;
  /** Absolute instant (we store meetups in UTC — see lib/validation/meetup.ts). */
  startsAt: Date;
  /** Optional; defaults to one hour after start — meetups have no duration
   *  field, and an hour is the least-wrong guess (noted in README). */
  endsAt?: Date;
  /** Physical location or meeting link, shown in the event's "where". */
  location?: string;
  /** Free-text description. */
  details?: string;
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const start = event.startsAt;
  const end = event.endsAt ?? new Date(start.getTime() + 60 * 60 * 1000);

  // URLSearchParams handles all escaping — never hand-concatenate user
  // text (a "&" in a group name would otherwise break the URL).
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toGoogleUtcStamp(start)}/${toGoogleUtcStamp(end)}`,
  });
  if (event.location) params.set("location", event.location);
  if (event.details) params.set("details", event.details);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
