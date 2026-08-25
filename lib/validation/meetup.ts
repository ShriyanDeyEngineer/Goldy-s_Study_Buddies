/**
 * Meetup + availability-poll validation.
 *
 * The tricky requirement (spec §5.8): when several fields are invalid,
 * the form must show a DISTINCT inline error for EVERY one of them
 * simultaneously — so this schema uses superRefine to collect all
 * problems instead of stopping at the first, and the conditional rules
 * (link if online, location if in person) attach to their own fields.
 *
 * Timezone note: the browser converts the student's datetime-local input
 * to a UTC ISO string BEFORE it reaches this schema (see the meetup form
 * component). scheduled_at here is always an absolute UTC instant.
 */
import { z } from "zod";
import { containsProfanity, PROFANITY_NAME_MESSAGE } from "@/lib/profanity";
import {
  MEETUP_DURATION_MAX,
  MEETUP_DURATION_MIN,
  POLL_SLOTS_MAX,
  POLL_SLOTS_MIN,
} from "@/lib/constants";

const uuid = z.string().uuid("Something went wrong — refresh and try again.");

export const meetupSchema = z
  .object({
    group_id: uuid,
    title: z
      .string()
      .trim()
      .min(1, "Give the meetup a title.")
      .max(100, "Titles max out at 100 characters.")
      .refine((v) => !containsProfanity(v), PROFANITY_NAME_MESSAGE),
    scheduled_at: z
      .string()
      .datetime({ offset: true, message: "Pick a date and time." }),
    format: z.enum(["online", "in_person"], {
      errorMap: () => ({ message: "Choose online or in person." }),
    }),
    location: z.string().trim().max(300, "Keep the location under 300 characters.").optional(),
    meeting_link: z.string().trim().max(500, "Keep the link under 500 characters.").optional(),
    duration_minutes: z.coerce
      .number({ invalid_type_error: "Pick how long the session runs." })
      .int("Duration must be whole minutes.")
      .min(MEETUP_DURATION_MIN, `Sessions need at least ${MEETUP_DURATION_MIN} minutes.`)
      .max(MEETUP_DURATION_MAX, `Sessions are capped at ${MEETUP_DURATION_MAX / 60} hours.`),
  })
  .superRefine((data, ctx) => {
    // Future-only. Compared against "now" at validation time; the database
    // re-checks, so a slow submit near the boundary still can't slip a
    // past meetup through.
    if (new Date(data.scheduled_at).getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduled_at"],
        message: "Meetups must be scheduled in the future.",
      });
    }
    // Conditional requirements — each error lands on its own field so the
    // form can show all of them at once.
    if (data.format === "online" && !data.meeting_link) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meeting_link"],
        message: "Online meetups need a meeting link.",
      });
    }
    if (data.format === "in_person" && !data.location) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["location"],
        message: "In-person meetups need a location.",
      });
    }
  });

export const cancelMeetupSchema = z.object({
  meetup_id: uuid,
  reason: z.string().trim().max(300, "Keep the reason under 300 characters.").optional(),
});

export const rsvpSchema = z.object({
  meetup_id: uuid,
  status: z.enum(["attending", "maybe", "not_attending"]),
});

/** A poll: a title plus 2–20 future time slots (start + end). */
export const availabilityPollSchema = z
  .object({
    group_id: uuid,
    title: z
      .string()
      .trim()
      .min(1, "Give the poll a title.")
      .max(100, "Titles max out at 100 characters.")
      .refine((v) => !containsProfanity(v), PROFANITY_NAME_MESSAGE),
    slots: z
      .array(
        z.object({
          starts_at: z.string().datetime({ offset: true }),
          ends_at: z.string().datetime({ offset: true }),
        }),
      )
      .min(POLL_SLOTS_MIN, `Offer at least ${POLL_SLOTS_MIN} time options.`)
      .max(POLL_SLOTS_MAX, `That's a lot of options — cap it at ${POLL_SLOTS_MAX}.`),
  })
  .superRefine((data, ctx) => {
    data.slots.forEach((slot, index) => {
      if (new Date(slot.ends_at) <= new Date(slot.starts_at)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["slots", index],
          message: "Each slot must end after it starts.",
        });
      }
      if (new Date(slot.starts_at).getTime() <= Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["slots", index],
          message: "Slots must be in the future.",
        });
      }
    });
  });
