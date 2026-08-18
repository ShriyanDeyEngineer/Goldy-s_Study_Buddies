/**
 * Pure logic for the When2Meet-style availability grid — no React, no
 * database, fully unit-tested (tests/availability-grid.test.ts).
 *
 * THE MODEL: a poll is a set of 30-minute slots. The grid is just a way
 * of LOOKING at those slots: columns are days, rows are times of day. So
 * two jobs live here:
 *
 *   generateGridSlots()  — poll creation: turn "Sep 8–14, 9 AM–9 PM" into
 *                          the list of slots the database stores.
 *   buildGrid()          — poll display: turn the stored slots back into
 *                          the day × time table the UI paints, using the
 *                          VIEWER's local timezone (a student in a
 *                          different zone over break sees correct hours).
 *
 * TIMEZONE RULE (spec pitfall #8): slots are stored as UTC instants. All
 * "wall clock" math here happens in the browser's local zone via the Date
 * API — we never format-then-parse strings, which is how off-by-a-day
 * bugs are born.
 */

export const GRID_STEP_MINUTES = 30;

export interface Slot {
  id: string;
  starts_at: string; // ISO, UTC
  ends_at: string;
}

/**
 * Poll creation. Given local date strings ("YYYY-MM-DD") and local hours
 * (0–24), produce every 30-minute slot in the range as UTC ISO pairs.
 * The end hour is exclusive: 9–17 yields 9:00 … 16:30 (16 slots/day).
 * Slots that have already started are skipped, so a poll opened
 * mid-Tuesday for "this week" doesn't offer Monday.
 */
export function generateGridSlots(
  startDate: string,
  endDate: string,
  startHour: number,
  endHour: number,
  now: Date = new Date(),
): { starts_at: string; ends_at: string }[] {
  const out: { starts_at: string; ends_at: string }[] = [];
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  if (![sy, sm, sd, ey, em, ed].every(Number.isFinite)) return out;

  // Local-midnight Dates; the loop adds whole days so DST shifts don't
  // drift the times (Date handles the 23/25-hour day for us).
  const first = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);
  if (last < first) return out;

  for (let day = new Date(first); day <= last; day.setDate(day.getDate() + 1)) {
    for (let minutes = startHour * 60; minutes < endHour * 60; minutes += GRID_STEP_MINUTES) {
      const start = new Date(day);
      start.setHours(0, minutes, 0, 0);
      const end = new Date(start.getTime() + GRID_STEP_MINUTES * 60_000);
      if (start <= now) continue;
      out.push({ starts_at: start.toISOString(), ends_at: end.toISOString() });
    }
  }
  return out;
}

export interface GridColumn {
  /** Local calendar day key, "YYYY-MM-DD" (viewer's zone). */
  dayKey: string;
  /** A Date at local midnight of that day, for formatting the header. */
  date: Date;
}

export interface GridRow {
  /** Minutes since local midnight, e.g. 570 = 9:30 AM. */
  minuteOfDay: number;
}

export interface Grid {
  columns: GridColumn[];
  rows: GridRow[];
  /** cell[dayKey][minuteOfDay] → slot id, when a slot exists there. */
  cell: Record<string, Record<number, string>>;
}

function localDayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Poll display. Lays stored slots out as columns (days) × rows (times) in
 * the viewer's local zone. Rows span from the earliest to the latest
 * time-of-day that appears on ANY day, so the table is rectangular; a
 * cell with no slot (e.g. Monday's morning was already past when the
 * poll was created) renders disabled.
 */
export function buildGrid(slots: Slot[]): Grid {
  const cell: Record<string, Record<number, string>> = {};
  const dayDates = new Map<string, Date>();
  let minMinute = Infinity;
  let maxMinute = -Infinity;

  for (const slot of slots) {
    const start = new Date(slot.starts_at);
    const key = localDayKey(start);
    const minute = start.getHours() * 60 + start.getMinutes();
    if (!dayDates.has(key)) {
      dayDates.set(key, new Date(start.getFullYear(), start.getMonth(), start.getDate()));
    }
    (cell[key] ??= {})[minute] = slot.id;
    if (minute < minMinute) minMinute = minute;
    if (minute > maxMinute) maxMinute = minute;
  }

  const columns = [...dayDates.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([dayKey, date]) => ({ dayKey, date }));

  const rows: GridRow[] = [];
  if (Number.isFinite(minMinute)) {
    for (let m = minMinute; m <= maxMinute; m += GRID_STEP_MINUTES) {
      rows.push({ minuteOfDay: m });
    }
  }
  return { columns, rows, cell };
}

/** "9:00 AM", "1:30 PM" — row labels. */
export function formatMinuteOfDay(minute: number): string {
  const h24 = Math.floor(minute / 60);
  const m = minute % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 ? "AM" : "PM";
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/**
 * The set of slot ids inside the rectangle between two cells — what a
 * drag from (dayA, minuteA) to (dayB, minuteB) selects. Order of the two
 * corners doesn't matter. Cells with no slot are skipped.
 */
export function slotsInRectangle(
  grid: Grid,
  a: { dayIndex: number; rowIndex: number },
  b: { dayIndex: number; rowIndex: number },
): string[] {
  const [d0, d1] = [Math.min(a.dayIndex, b.dayIndex), Math.max(a.dayIndex, b.dayIndex)];
  const [r0, r1] = [Math.min(a.rowIndex, b.rowIndex), Math.max(a.rowIndex, b.rowIndex)];
  const ids: string[] = [];
  for (let d = d0; d <= d1; d++) {
    const col = grid.columns[d];
    if (!col) continue;
    for (let r = r0; r <= r1; r++) {
      const row = grid.rows[r];
      if (!row) continue;
      const id = grid.cell[col.dayKey]?.[row.minuteOfDay];
      if (id) ids.push(id);
    }
  }
  return ids;
}
