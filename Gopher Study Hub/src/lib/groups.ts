import { format } from "date-fns";

export type JoinState =
  | "join"
  | "request"
  | "requested"
  | "member"
  | "manager"
  | "full"
  | "unavailable";

export interface JoinStateInput {
  status: string;
  mode: "open" | "closed";
  memberCount: number;
  capacity: number;
  isMember: boolean;
  isManager: boolean;
  hasPendingRequest: boolean;
}

/** Exactly one control renders at a time — §4.7. */
export function joinState(input: JoinStateInput): JoinState {
  if (input.isManager) return "manager";
  if (input.isMember) return "member";
  if (input.status !== "active") return "unavailable";
  if (input.hasPendingRequest) return "requested";
  if (input.memberCount >= input.capacity) return "full";
  return input.mode === "open" ? "join" : "request";
}

export const JOIN_STATE_LABEL: Record<JoinState, string> = {
  join: "Join",
  request: "Request to join",
  requested: "Requested ✓",
  member: "Member",
  manager: "Manager",
  full: "Full",
  unavailable: "Unavailable",
};

/** Google Calendar template URL — no OAuth, no API key. */
export function googleCalendarUrl(meetup: {
  title: string;
  scheduledAt: string | Date;
  durationMinutes?: number;
  details?: string;
  location?: string | null;
}) {
  const start = new Date(meetup.scheduledAt);
  const end = new Date(start.getTime() + (meetup.durationMinutes ?? 60) * 60_000);
  const stamp = (d: Date) => format(d, "yyyyMMdd'T'HHmmss'Z'");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: meetup.title,
    dates: `${stamp(new Date(start.toISOString().slice(0, -1)))}/${stamp(
      new Date(end.toISOString().slice(0, -1)),
    )}`,
  });
  if (meetup.details) params.set("details", meetup.details);
  if (meetup.location) params.set("location", meetup.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** datetime-local text is wall clock with no zone — convert to a UTC instant here. */
export function localInputToUtcIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
