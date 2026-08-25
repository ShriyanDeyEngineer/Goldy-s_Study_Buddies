/**
 * Group resources ("Resources" section): a shared NOTE or LINK.
 * The database function re-validates everything; this gives inline
 * per-field errors and typed input, same split as every other form.
 */
import { z } from "zod";
import { containsProfanity, PROFANITY_NAME_MESSAGE } from "@/lib/profanity";

export const RESOURCE_TITLE_MAX = 100;
export const RESOURCE_NOTE_MAX = 5000;
export const RESOURCE_LINK_MAX = 500;

export const resourceSchema = z
  .object({
    group_id: z.string().uuid("Something went wrong — refresh and try again."),
    kind: z.enum(["note", "link"], {
      errorMap: () => ({ message: "Choose a note or a link." }),
    }),
    title: z
      .string()
      .trim()
      .min(1, "Give it a title.")
      .max(RESOURCE_TITLE_MAX, `Titles max out at ${RESOURCE_TITLE_MAX} characters.`)
      .refine((v) => !containsProfanity(v), PROFANITY_NAME_MESSAGE),
    content: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === "link") {
      if (
        !/^https?:\/\//i.test(data.content) ||
        data.content.length > RESOURCE_LINK_MAX
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["content"],
          message: "Enter a full link, starting with https://",
        });
      }
    } else if (data.content.length < 1 || data.content.length > RESOURCE_NOTE_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: `Notes need 1–${RESOURCE_NOTE_MAX.toLocaleString()} characters.`,
      });
    }
  });
