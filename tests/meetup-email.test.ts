/**
 * The detailed "new meetup" email (lib/meetup-email.ts).
 *
 * Times are asserted in Central Time regardless of the machine running
 * the tests — the builder pins America/Chicago explicitly, which is the
 * point (Vercel runs on UTC).
 */
import { describe, expect, it } from "vitest";
import { buildMeetupEmail, type MeetupEmailInput } from "@/lib/meetup-email";

// 2026-09-09T20:00:00Z = Wednesday, September 9, 3:00 PM CDT (UTC-5).
const BASE: MeetupEmailInput = {
  recipientName: "Riley",
  groupName: "Algo Grinders",
  title: "Midterm cram",
  creatorName: "Jane Doe",
  scheduledAtIso: "2026-09-09T20:00:00.000Z",
  durationMinutes: 90,
  format: "in_person",
  location: "Walter Library 204",
  meetingLink: null,
  attendeeNames: ["Jane Doe", "John Smith"],
  groupUrl: "https://example.com/groups/abc",
};

describe("buildMeetupEmail", () => {
  it("names the group and meetup in the subject", () => {
    const { subject } = buildMeetupEmail(BASE);
    expect(subject).toContain("Algo Grinders");
    expect(subject).toContain("Midterm cram");
  });

  it("greets the recipient and credits the creator", () => {
    const { text } = buildMeetupEmail(BASE);
    expect(text).toContain("Hi Riley,");
    expect(text).toContain("Jane Doe scheduled a new meetup for Algo Grinders");
  });

  it("renders the time window in Central Time with the duration", () => {
    const { text } = buildMeetupEmail(BASE);
    expect(text).toContain(
      "When: Wednesday, September 9, 3:00 PM – 4:30 PM Central Time (1 h 30 min)",
    );
  });

  it("shows the location for in-person meetups", () => {
    const { text } = buildMeetupEmail(BASE);
    expect(text).toContain("Where: Walter Library 204");
  });

  it("shows the join link for online meetups", () => {
    const { text } = buildMeetupEmail({
      ...BASE,
      format: "online",
      location: null,
      meetingLink: "https://zoom.us/j/123",
    });
    expect(text).toContain("Where: Online — join at https://zoom.us/j/123");
  });

  it("lists who is attending, with the count", () => {
    const { text } = buildMeetupEmail(BASE);
    expect(text).toContain("Attending: 2 people so far: Jane Doe, John Smith");
  });

  it("uses the singular for one attendee", () => {
    const { text } = buildMeetupEmail({ ...BASE, attendeeNames: ["Jane Doe"] });
    expect(text).toContain("1 person so far: Jane Doe");
  });

  it("links the group page and a prefilled Google Calendar event", () => {
    const { text } = buildMeetupEmail(BASE);
    expect(text).toContain("https://example.com/groups/abc");
    expect(text).toContain("https://calendar.google.com/calendar/render?");
    // The calendar event carries the real end time (start + 90 min).
    expect(text).toContain("20260909T200000Z%2F20260909T213000Z");
  });

  it("falls back gracefully with no names", () => {
    const { text } = buildMeetupEmail({
      ...BASE,
      recipientName: null,
      creatorName: null,
      attendeeNames: [],
    });
    expect(text).toContain("Hi there,");
    expect(text).toContain("A group member scheduled a new meetup");
    expect(text).toContain("No RSVPs yet — be the first!");
  });

  it("keeps the unsubscribe hint", () => {
    const { text } = buildMeetupEmail(BASE);
    expect(text).toContain("Edit profile → Notifications");
  });
});
