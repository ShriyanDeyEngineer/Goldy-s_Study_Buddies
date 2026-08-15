import { z } from "zod";

/** Password policy — §4.2. Each rule is reported individually. */
export const PASSWORD_RULES = [
  { id: "length", label: "At least 12 characters", test: (v: string) => v.length >= 12 },
  { id: "upper", label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { id: "lower", label: "One lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { id: "digit", label: "One number", test: (v: string) => /[0-9]/.test(v) },
  {
    id: "special",
    label: "One special character",
    test: (v: string) => /[^A-Za-z0-9]/.test(v),
  },
] as const;

export type PasswordRuleId = (typeof PASSWORD_RULES)[number]["id"];

/** Returns exactly the rules that are NOT satisfied — no more, no fewer. */
export function unmetPasswordRules(value: string) {
  return PASSWORD_RULES.filter((rule) => !rule.test(value ?? ""));
}

export const passwordSchema = z.string().superRefine((value, ctx) => {
  for (const rule of unmetPasswordRules(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: rule.label });
  }
});

/** Email domain check — the allow-list is also enforced in the database. */
export const ALLOWED_EMAIL_DOMAIN = "umn.edu";

export function isAllowedEmail(email: string, domain = ALLOWED_EMAIL_DOMAIN) {
  return email.trim().toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}

export const umnEmailSchema = z
  .string()
  .trim()
  .min(1, { message: "Enter your email." })
  .max(255)
  .email({ message: "That doesn't look like an email address." })
  .refine((v) => isAllowedEmail(v), {
    message: "Use your University of Minnesota email (ending in @umn.edu).",
  });

export const registerSchema = z.object({
  email: umnEmailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().min(1, { message: "Enter your email." }).max(255),
  password: z.string().min(1, { message: "Enter your password." }),
});

export const forgotPasswordSchema = z.object({ email: umnEmailSchema });

export const resetPasswordSchema = z.object({ password: passwordSchema });

export const GRAD_YEAR_MIN = 2020;
export const GRAD_YEAR_MAX = 2040;

export const onboardingSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, { message: "Pick a name your classmates will recognize." })
    .max(50, { message: "Keep it to 50 characters or fewer." }),
  major: z.string().trim().max(100).optional().or(z.literal("")),
  college: z.string().trim().max(100).optional().or(z.literal("")),
  graduationMonth: z.number().int().min(1).max(12).optional(),
  graduationYear: z.number().int().min(GRAD_YEAR_MIN).max(GRAD_YEAR_MAX).optional(),
  bio: z
    .string()
    .trim()
    .max(500, { message: "Bios max out at 500 characters." })
    .optional()
    .or(z.literal("")),
  courseIds: z.array(z.string().uuid()).default([]),
});

export const courseSchema = z.object({
  department: z
    .string()
    .trim()
    .min(2, { message: "Department code is required (e.g. CSCI)." })
    .max(10),
  number: z.string().trim().min(1, { message: "Course number is required." }).max(10),
  name: z.string().trim().min(2, { message: "Give the course its full name." }).max(120),
});

export const GROUP_CAPACITY_MIN = 2;
export const GROUP_CAPACITY_MAX = 50;

export const groupSchema = z.object({
  courseId: z.string().uuid(),
  name: z
    .string()
    .trim()
    .min(1, { message: "Your group needs a name." })
    .max(100, { message: "Names max out at 100 characters." }),
  capacity: z
    .number()
    .int({ message: "Capacity must be a whole number." })
    .min(2, { message: "A study group needs room for at least 2 people." })
    .max(50, { message: "50 people is the max — bigger than that is a lecture." }),
  mode: z.enum(["open", "closed"]),
  invitees: z.array(z.string().uuid()).default([]),
});

export const MESSAGE_MAX = 2000;
export const messageSchema = z
  .string()
  .trim()
  .min(1, { message: "Type something first." })
  .max(MESSAGE_MAX, { message: `Messages max out at ${MESSAGE_MAX} characters.` });

/** Meetup form — reports a distinct error for every invalid field at once. */
export const meetupSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { message: "Give the meetup a title." })
      .max(100, { message: "Titles max out at 100 characters." }),
    scheduledAt: z.string().min(1, { message: "Pick a date and time." }),
    format: z.enum(["online", "in_person"]),
    location: z.string().trim().max(200).optional().or(z.literal("")),
    meetingLink: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    const when = new Date(value.scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledAt"],
        message: "Pick a date and time in the future.",
      });
    }
    if (value.format === "online" && !value.meetingLink?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meetingLink"],
        message: "Online meetups need a meeting link.",
      });
    }
    if (value.format === "in_person" && !value.location?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["location"],
        message: "In-person meetups need a location.",
      });
    }
  });

export const userSearchSchema = z
  .string()
  .trim()
  .min(2, { message: "Type at least 2 characters." })
  .max(100, { message: "That search is too long." });

export const uuidSchema = z.string().uuid();

/** Validate a route param before it reaches any database filter. */
export function isUuid(value: unknown): value is string {
  return uuidSchema.safeParse(value).success;
}
