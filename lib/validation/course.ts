/**
 * "Add a missing course" form validation (spec §5.5).
 *
 * Codes are uppercased here so "csci 1133" and "CSCI 1133" become the
 * same course before they ever reach the database's find-or-create.
 */
import { z } from "zod";
import { containsProfanity, PROFANITY_NAME_MESSAGE } from "@/lib/profanity";

export const addCourseSchema = z.object({
  department_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,8}$/, "Department codes look like CSCI or MATH (2–8 letters)."),
  course_number: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9]{1,4}[A-Z]{0,3}$/, "Course numbers look like 1133 or 1301W."),
  course_name: z
    .string()
    .trim()
    .min(1, "What's the course called?")
    .max(200, "Keep the course name under 200 characters.")
    .refine((v) => !containsProfanity(v), PROFANITY_NAME_MESSAGE),
});
