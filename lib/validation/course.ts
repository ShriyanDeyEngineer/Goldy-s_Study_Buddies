/**
 * "Add a missing course" form validation (spec §5.5).
 *
 * Codes are uppercased here so "csci 1133" and "CSCI 1133" become the
 * same course before they ever reach the database's find-or-create.
 */
import { z } from "zod";
import { containsProfanity, PROFANITY_NAME_MESSAGE } from "@/lib/profanity";

const departmentCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,8}$/, "Department codes look like CSCI or MATH (2–8 letters).");

const courseNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{1,4}[A-Z]{0,3}$/, "Course numbers look like 1133 or 1301W.");

/** Admin approval turns this into the real, permanent catalog name. */
export const addCourseSchema = z.object({
  department_code: departmentCodeSchema,
  course_number: courseNumberSchema,
  course_name: z
    .string()
    .trim()
    .min(1, "What's the course called?")
    .max(200, "Keep the course name under 200 characters.")
    .refine((v) => !containsProfanity(v), PROFANITY_NAME_MESSAGE),
});

/**
 * A student FILING a request may not know the exact official name — that's
 * often the whole reason they're asking. The admin fills it in (or fixes
 * what was typed) before approving, via addCourseSchema above.
 */
export const courseRequestSchema = z.object({
  department_code: departmentCodeSchema,
  course_number: courseNumberSchema,
  course_name: z
    .string()
    .trim()
    .max(200, "Keep the course name under 200 characters.")
    .refine((v) => !containsProfanity(v), PROFANITY_NAME_MESSAGE),
});
