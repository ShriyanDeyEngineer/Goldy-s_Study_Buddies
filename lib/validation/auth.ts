/**
 * Authentication validation: the password policy, the UMN email rule, and
 * the zod schemas for every auth form (register, login, forgot/reset).
 *
 * The password policy is deliberately built as a LIST OF RULES rather than
 * one regex, because two features depend on per-rule results:
 *   1. the live checklist on the registration form (each rule turns green
 *      as you type), and
 *   2. the requirement that a failed submission lists EXACTLY the unmet
 *      rules — no more, no fewer (unit-tested).
 *
 * Touch this file to change password strength or auth error copy. If you
 * change the policy, update the matching Supabase Auth dashboard settings
 * described in SETUP.md too — both layers should agree.
 */
import { z } from "zod";
import { ALLOWED_EMAIL_DOMAINS } from "@/lib/constants";

/** One password rule: an id (stable, used as a React key), the label shown
 *  in the checklist, and the test itself. */
export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "At least 12 characters",
    test: (pw) => pw.length >= 12,
  },
  {
    id: "uppercase",
    label: "At least one uppercase letter (A–Z)",
    test: (pw) => /[A-Z]/.test(pw),
  },
  {
    id: "lowercase",
    label: "At least one lowercase letter (a–z)",
    test: (pw) => /[a-z]/.test(pw),
  },
  {
    id: "digit",
    label: "At least one number (0–9)",
    test: (pw) => /[0-9]/.test(pw),
  },
  {
    id: "special",
    label: "At least one special character (!@#$…)",
    // "Special" = anything that isn't a letter or digit, so spaces and
    // unicode punctuation count too — we don't police WHICH symbol.
    test: (pw) => /[^A-Za-z0-9]/.test(pw),
  },
];

/** Evaluates every rule — the live checklist renders straight from this. */
export function checkPassword(password: string) {
  return PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    passed: rule.test(password),
  }));
}

/** The unmet rules only — exactly what a failed submission must list. */
export function unmetPasswordRules(password: string): string[] {
  return checkPassword(password)
    .filter((r) => !r.passed)
    .map((r) => r.label);
}

export function isPasswordValid(password: string): boolean {
  return unmetPasswordRules(password).length === 0;
}

/**
 * Is this email on an allowed university domain? Case-insensitive, exact
 * domain match — "student@umn.edu.evil.com" must NOT pass, which is why
 * we compare the full domain instead of using endsWith on the raw string.
 */
export function isAllowedUniversityEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  return ALLOWED_EMAIL_DOMAINS.some((allowed) => domain === allowed.toLowerCase());
}

/** Reused by both auth schemas and anywhere else an email is collected. */
export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .email("That doesn't look like an email address.");

export const universityEmailSchema = emailSchema.refine(isAllowedUniversityEmail, {
  message: "Only @umn.edu accounts can join right now.",
});

export const registerSchema = z.object({
  email: universityEmailSchema,
  password: z.string().superRefine((pw, ctx) => {
    // One issue PER unmet rule — this is what guarantees the error lists
    // exactly the rules that failed and nothing else.
    for (const label of unmetPasswordRules(pw)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: label });
    }
  }),
});

/**
 * Login deliberately does NOT use the university-domain or password-policy
 * schemas: whatever the input, a failed login must produce one identical
 * generic message ("Email or password is incorrect.") so nobody can probe
 * which accounts exist or how they fail.
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: z.string().superRefine((pw, ctx) => {
    for (const label of unmetPasswordRules(pw)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: label });
    }
  }),
});
