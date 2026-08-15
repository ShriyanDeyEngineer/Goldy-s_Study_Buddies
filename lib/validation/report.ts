/**
 * Report form validation (spec §5.14): a required category from the fixed
 * list plus an optional description capped at 1,000 characters.
 */
import { z } from "zod";
import { REPORT_CATEGORY_VALUES, REPORT_DESCRIPTION_MAX } from "@/lib/constants";

export const reportSchema = z.object({
  reported_user_id: z.string().uuid(),
  category: z.enum(REPORT_CATEGORY_VALUES as [string, ...string[]], {
    errorMap: () => ({ message: "Pick the reason that fits best." }),
  }),
  description: z
    .string()
    .trim()
    .max(REPORT_DESCRIPTION_MAX, `Keep it under ${REPORT_DESCRIPTION_MAX} characters.`)
    .optional(),
});
