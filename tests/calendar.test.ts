/**
 * Google Calendar link tests (spec §11): correct template URL, correct
 * UTC timestamp format, safe escaping, one-hour default duration.
 */
import { describe, expect, it } from "vitest";
import { googleCalendarUrl } from "@/lib/calendar";

describe("googleCalendarUrl", () => {
  const start = new Date("2026-03-07T19:30:00.000Z");

  it("builds the render?action=TEMPLATE URL with UTC stamps", () => {
    const url = new URL(googleCalendarUrl({ title: "Study session", startsAt: start }));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Study session");
    // 19:30Z → 20:30Z (default one-hour duration), basic ISO, Z suffix.
    expect(url.searchParams.get("dates")).toBe("20260307T193000Z/20260307T203000Z");
  });

  it("respects an explicit end time", () => {
    const url = new URL(
      googleCalendarUrl({
        title: "t",
        startsAt: start,
        endsAt: new Date("2026-03-07T21:00:00.000Z"),
      }),
    );
    expect(url.searchParams.get("dates")).toBe("20260307T193000Z/20260307T210000Z");
  });

  it("includes location and details only when provided", () => {
    const bare = new URL(googleCalendarUrl({ title: "t", startsAt: start }));
    expect(bare.searchParams.has("location")).toBe(false);
    expect(bare.searchParams.has("details")).toBe(false);

    const full = new URL(
      googleCalendarUrl({
        title: "t",
        startsAt: start,
        location: "Walter Library",
        details: "Bring problem set 6",
      }),
    );
    expect(full.searchParams.get("location")).toBe("Walter Library");
    expect(full.searchParams.get("details")).toBe("Bring problem set 6");
  });

  it("escapes titles that would break a hand-built URL", () => {
    const url = new URL(
      googleCalendarUrl({ title: "Phys & Chem = fun? #1", startsAt: start }),
    );
    // URL survives parsing and the value round-trips exactly.
    expect(url.searchParams.get("text")).toBe("Phys & Chem = fun? #1");
  });

  it("crosses date boundaries correctly in UTC", () => {
    // 23:45Z + 1h lands on the next calendar day.
    const url = new URL(
      googleCalendarUrl({ title: "t", startsAt: new Date("2026-03-07T23:45:00.000Z") }),
    );
    expect(url.searchParams.get("dates")).toBe("20260307T234500Z/20260308T004500Z");
  });
});
