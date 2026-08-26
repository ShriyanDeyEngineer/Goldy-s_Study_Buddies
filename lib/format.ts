/**
 * Small human-readable formatters shared across the app.
 * Pure functions — unit-tested in tests/format.test.ts.
 */

/**
 * Minutes → "45 min", "1 h", "1 h 30 min", "8 h".
 * Used by the meetup duration slider label and the meetup card's
 * "3:00 – 4:30 PM (1 h 30 min)" line.
 */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

/**
 * Admin-only: resolves a person's display name, appending their id when
 * the account reads as deleted. Covers both the missing-row case (no
 * profiles match for the id at all) and the tombstoned case, where the
 * profiles row still exists but account deletion overwrote display_name
 * with the literal string "Deleted User" (see migration 0017) — either
 * way the id itself always comes from the foreign key on the row being
 * displayed, not from the profile lookup.
 */
export function adminPersonLabel(
  displayName: string | null | undefined,
  id: string,
): string {
  const name = displayName ?? "Deleted User";
  return name === "Deleted User" ? `Deleted User (${id})` : name;
}
