/**
 * Meetup validation tests (spec §11: "the conditional meetup
 * validation"). The two big behaviors:
 *   1. online needs a link, in-person needs a location — each error on
 *      its OWN field;
 *   2. multiple broken fields report SIMULTANEOUSLY, one error each.
 */
import { describe, expect, it } from "vitest";
import { availabilityPollSchema, meetupSchema } from "@/lib/validation/meetup";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString();

function meetup(overrides: Record<string, unknown> = {}) {
  return meetupSchema.safeParse({
    group_id: UUID,
    title: "Midterm grind",
    scheduled_at: FUTURE,
    format: "in_person",
    location: "Walter Library",
    duration_minutes: 60,
    ...overrides,
  });
}

describe("meetup schema", () => {
  it("accepts a valid in-person meetup", () => {
    expect(meetup().success).toBe(true);
  });

  // Duration slider (bug report #2): 15 min – 8 h inclusive, whole minutes.
  it("duration boundaries: 15 and 480 pass, 14 and 481 fail", () => {
    expect(meetup({ duration_minutes: 15 }).success).toBe(true);
    expect(meetup({ duration_minutes: 480 }).success).toBe(true);
    expect(meetup({ duration_minutes: 14 }).success).toBe(false);
    expect(meetup({ duration_minutes: 481 }).success).toBe(false);
  });
  it("duration must be whole minutes and coerces the form's string", () => {
    expect(meetup({ duration_minutes: "90" }).success).toBe(true); // range inputs post strings
    expect(meetup({ duration_minutes: 90.5 }).success).toBe(false);
    const missing = meetup({ duration_minutes: undefined });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.flatten().fieldErrors.duration_minutes).toBeTruthy();
    }
  });

  it("accepts a valid online meetup", () => {
    expect(
      meetup({
        format: "online",
        location: undefined,
        meeting_link: "https://umn.zoom.us/j/123",
      }).success,
    ).toBe(true);
  });

  it("online WITHOUT a link fails on meeting_link specifically", () => {
    const result = meetup({ format: "online", location: undefined });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path[0])).toContain("meeting_link");
  });

  it("rejects a non-http(s) meeting link (no javascript: XSS link)", () => {
    for (const link of [
      "javascript:alert(document.cookie)",
      "data:text/html,<script>1</script>",
      "  javascript:alert(1)",
      "zoommtg://zoom.us/join?confno=123",
    ]) {
      const result = meetup({ format: "online", location: undefined, meeting_link: link });
      expect(result.success).toBe(false);
      if (result.success) continue;
      expect(result.error.issues.map((i) => i.path[0])).toContain("meeting_link");
    }
    expect(
      meetup({
        format: "online",
        location: undefined,
        meeting_link: "HTTPS://umn.zoom.us/j/1",
      }).success,
    ).toBe(true);
  });

  it("in-person WITHOUT a location fails on location specifically", () => {
    const result = meetup({ location: undefined });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path[0])).toContain("location");
  });

  it("past times are rejected", () => {
    const result = meetup({ scheduled_at: PAST });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path[0])).toContain("scheduled_at");
  });

  it("reports EVERY invalid field simultaneously (spec §5.8)", () => {
    // Empty title + past time + online with no link = three distinct errors.
    const result = meetup({
      title: "",
      scheduled_at: PAST,
      format: "online",
      location: undefined,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const fields = new Set(result.error.issues.map((i) => i.path[0]));
    expect(fields.has("title")).toBe(true);
    expect(fields.has("scheduled_at")).toBe(true);
    expect(fields.has("meeting_link")).toBe(true);
  });

  it("title boundaries: 100 passes, 101 fails", () => {
    expect(meetup({ title: "x".repeat(100) }).success).toBe(true);
    expect(meetup({ title: "x".repeat(101) }).success).toBe(false);
  });
});

describe("availability poll schema", () => {
  const slot = (hoursFromNow: number, lengthHours = 1) => ({
    starts_at: new Date(Date.now() + hoursFromNow * 3600_000).toISOString(),
    ends_at: new Date(Date.now() + (hoursFromNow + lengthHours) * 3600_000).toISOString(),
  });

  function poll(slots: unknown[]) {
    return availabilityPollSchema.safeParse({
      group_id: UUID,
      title: "When can we meet?",
      slots,
    });
  }

  // The grid UI generates up to ~2 weeks of 30-minute cells, so the cap
  // is 400 (was 20 when slots were hand-typed).
  it("2 slots pass; 1 fails; 400 passes; 401 fails", () => {
    expect(poll([slot(24), slot(48)]).success).toBe(true);
    expect(poll([slot(24)]).success).toBe(false);
    // Half-hour steps so 400 slots stay well within the future window.
    const many = (n: number) => Array.from({ length: n }, (_, i) => slot(24 + i * 0.5));
    expect(poll(many(400)).success).toBe(true);
    expect(poll(many(401)).success).toBe(false);
  });

  it("a slot ending before it starts fails", () => {
    const backwards = {
      starts_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
      ends_at: new Date(Date.now() + 47 * 3600_000).toISOString(),
    };
    expect(poll([slot(24), backwards]).success).toBe(false);
  });

  it("past slots fail", () => {
    expect(poll([slot(24), slot(-2)]).success).toBe(false);
  });
});
