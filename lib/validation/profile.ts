/**
 * Profile validation: onboarding and the profile edit form, including the
 * per-field privacy flags and the social-links rules.
 *
 * One schema serves both forms (they edit the same fields); onboarding
 * just uses a subset. Shared by client (inline errors) and server action
 * (the enforcement that counts).
 */
import { z } from "zod";
import {
  BIO_MAX_LENGTH,
  COLLEGE_VALUES,
  DISPLAY_NAME_MAX,
  GRAD_YEAR_MAX,
  GRAD_YEAR_MIN,
  SOCIAL_LINKS_MAX,
  STANDING_VALUES,
} from "@/lib/constants";

/** "" from an empty form field means "no answer" — normalize to null so
 *  optional fields don't fail their max-length/enum checks on "". */
const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), schema);

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Pick a display name — it's how classmates will find you.")
  .max(DISPLAY_NAME_MAX, `Keep it under ${DISPLAY_NAME_MAX} characters.`);

/** A single social link: must be a real http(s) URL (spec §5.11). The
 *  protocol check stops javascript: links from ever rendering as <a href>. */
export const socialLinkSchema = z
  .string()
  .trim()
  .url("Enter a full link, starting with https://")
  .refine((url) => url.startsWith("http://") || url.startsWith("https://"), {
    message: "Links must start with http:// or https://",
  });

export const profileSchema = z.object({
  display_name: displayNameSchema,
  college: emptyToNull(
    z.enum(COLLEGE_VALUES as [string, ...string[]]).nullable(),
  ),
  major: emptyToNull(z.string().trim().max(100, "Keep majors under 100 characters.").nullable()),
  class_standing: emptyToNull(
    z.enum(STANDING_VALUES as [string, ...string[]]).nullable(),
  ),
  graduation_month: emptyToNull(
    z.coerce.number().int().min(1, "Pick a month.").max(12, "Pick a month.").nullable(),
  ),
  graduation_year: emptyToNull(
    z.coerce
      .number()
      .int()
      .min(GRAD_YEAR_MIN, `Years ${GRAD_YEAR_MIN}–${GRAD_YEAR_MAX} only.`)
      .max(GRAD_YEAR_MAX, `Years ${GRAD_YEAR_MIN}–${GRAD_YEAR_MAX} only.`)
      .nullable(),
  ),
  bio: emptyToNull(
    z.string().trim().max(BIO_MAX_LENGTH, `Bios max out at ${BIO_MAX_LENGTH} characters.`).nullable(),
  ),
  social_links: z
    .array(socialLinkSchema)
    .max(SOCIAL_LINKS_MAX, `Up to ${SOCIAL_LINKS_MAX} links.`)
    .default([]),
});

/** Onboarding step 1 collects just the identity basics. */
export const onboardingSchema = profileSchema.pick({
  display_name: true,
  college: true,
  major: true,
  class_standing: true,
  graduation_month: true,
  graduation_year: true,
});

/**
 * The privacy flags. Every key optional; true = "hide this from others".
 * `strict()` so an unknown key is an error — a typo like "majr" would
 * otherwise silently protect nothing.
 */
export const privacySchema = z
  .object({
    college: z.boolean().optional(),
    major: z.boolean().optional(),
    class_standing: z.boolean().optional(),
    bio: z.boolean().optional(),
    graduation: z.boolean().optional(),
    social_links: z.boolean().optional(),
    courses_current: z.boolean().optional(),
    courses_taken: z.boolean().optional(),
    courses_future: z.boolean().optional(),
  })
  .strict();

export type PrivacyFlags = z.infer<typeof privacySchema>;
