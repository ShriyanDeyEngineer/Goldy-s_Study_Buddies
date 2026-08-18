/**
 * The When2Meet-style grid's pure logic (lib/availability-grid.ts):
 * slot generation from a date/hour range, laying slots back out as a
 * day × time grid, and rectangle (drag) selection.
 */
import { describe, expect, it } from "vitest";
import {
  buildGrid,
  formatMinuteOfDay,
  generateGridSlots,
  slotsInRectangle,
} from "@/lib/availability-grid";

// A fixed "now" far in the past so no generated slot is skipped as
// already-started (each test that cares sets its own).
const LONG_AGO = new Date(2000, 0, 1);

describe("generateGridSlots", () => {
  it("makes 30-minute slots across the hour range, end hour exclusive", () => {
    const slots = generateGridSlots("2030-09-09", "2030-09-09", 9, 11, LONG_AGO);
    expect(slots).toHaveLength(4); // 9:00, 9:30, 10:00, 10:30
    const first = new Date(slots[0].starts_at);
    expect(first.getHours()).toBe(9);
    expect(first.getMinutes()).toBe(0);
    const lastEnd = new Date(slots[3].ends_at);
    expect(lastEnd.getHours()).toBe(11);
  });

  it("covers every day in the range inclusive", () => {
    const slots = generateGridSlots("2030-09-09", "2030-09-11", 9, 10, LONG_AGO);
    expect(slots).toHaveLength(3 * 2); // 3 days × 2 slots
  });

  it("a week 8 AM–10 PM stays under the 400-slot cap", () => {
    const slots = generateGridSlots("2030-09-09", "2030-09-15", 8, 22, LONG_AGO);
    expect(slots).toHaveLength(7 * 28);
    expect(slots.length).toBeLessThanOrEqual(400);
  });

  it("skips slots that already started", () => {
    const now = new Date(2030, 8, 9, 9, 45); // 9:45 AM on the poll's first day
    const slots = generateGridSlots("2030-09-09", "2030-09-09", 9, 11, now);
    // 9:00 and 9:30 are past; 10:00 and 10:30 remain
    expect(slots).toHaveLength(2);
    expect(new Date(slots[0].starts_at).getHours()).toBe(10);
  });

  it("returns nothing for a backwards or malformed range", () => {
    expect(generateGridSlots("2030-09-15", "2030-09-09", 9, 11, LONG_AGO)).toEqual([]);
    expect(generateGridSlots("nope", "2030-09-09", 9, 11, LONG_AGO)).toEqual([]);
  });
});

describe("buildGrid", () => {
  const slots = generateGridSlots("2030-09-09", "2030-09-10", 9, 10, LONG_AGO).map(
    (s, i) => ({ id: `slot-${i}`, ...s }),
  );

  it("lays slots out as day columns × time rows", () => {
    const grid = buildGrid(slots);
    expect(grid.columns.map((c) => c.dayKey)).toEqual(["2030-09-09", "2030-09-10"]);
    expect(grid.rows.map((r) => r.minuteOfDay)).toEqual([540, 570]); // 9:00, 9:30
    expect(grid.cell["2030-09-09"][540]).toBe("slot-0");
    expect(grid.cell["2030-09-10"][570]).toBe("slot-3");
  });

  it("stays rectangular when one day is missing early slots", () => {
    // Drop Monday 9:00 (as if it were already past at creation time)
    const grid = buildGrid(slots.filter((s) => s.id !== "slot-0"));
    expect(grid.rows).toHaveLength(2); // still 9:00 + 9:30 rows
    expect(grid.cell["2030-09-09"][540]).toBeUndefined(); // that cell is a hole
    expect(grid.cell["2030-09-10"][540]).toBe("slot-2");
  });

  it("is empty for no slots", () => {
    const grid = buildGrid([]);
    expect(grid.columns).toEqual([]);
    expect(grid.rows).toEqual([]);
  });
});

describe("slotsInRectangle (drag selection)", () => {
  const slots = generateGridSlots("2030-09-09", "2030-09-11", 9, 11, LONG_AGO).map(
    (s, i) => ({ id: `s${i}`, ...s }),
  );
  const grid = buildGrid(slots); // 3 days × 4 rows

  it("selects the full rectangle between two corners, either order", () => {
    const a = { dayIndex: 0, rowIndex: 0 };
    const b = { dayIndex: 1, rowIndex: 2 };
    const forward = slotsInRectangle(grid, a, b);
    const backward = slotsInRectangle(grid, b, a);
    expect(forward).toHaveLength(2 * 3);
    expect(new Set(forward)).toEqual(new Set(backward));
  });

  it("a single cell selects just that slot", () => {
    expect(slotsInRectangle(grid, { dayIndex: 2, rowIndex: 3 }, { dayIndex: 2, rowIndex: 3 })).toEqual([
      grid.cell["2030-09-11"][630],
    ]);
  });

  it("skips holes and out-of-range indices", () => {
    const holey = buildGrid(slots.filter((s) => s.id !== "s0"));
    const ids = slotsInRectangle(holey, { dayIndex: 0, rowIndex: 0 }, { dayIndex: 0, rowIndex: 1 });
    expect(ids).toHaveLength(1); // 9:00 Monday is a hole
    expect(slotsInRectangle(grid, { dayIndex: 9, rowIndex: 9 }, { dayIndex: 9, rowIndex: 9 })).toEqual([]);
  });
});

describe("formatMinuteOfDay", () => {
  it("renders 12-hour labels", () => {
    expect(formatMinuteOfDay(0)).toBe("12:00 AM");
    expect(formatMinuteOfDay(540)).toBe("9:00 AM");
    expect(formatMinuteOfDay(750)).toBe("12:30 PM");
    expect(formatMinuteOfDay(810)).toBe("1:30 PM");
    expect(formatMinuteOfDay(1410)).toBe("11:30 PM");
  });
});
