/**
 * Content-flag validation (migration 0040): which kind of item is being
 * flagged, its id, and an optional short note (≤1,000 chars) for the team.
 * Mirrors lib/validation/report.ts.
 */
import { z } from "zod";
import { FLAG_CONTENT_TYPES, FLAG_REASON_MAX } from "@/lib/constants";

export const flagSchema = z.object({
  content_type: z.enum(FLAG_CONTENT_TYPES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: "That can't be flagged." }),
  }),
  content_id: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .max(FLAG_REASON_MAX, `Keep the note under ${FLAG_REASON_MAX} characters.`)
    .optional(),
});
