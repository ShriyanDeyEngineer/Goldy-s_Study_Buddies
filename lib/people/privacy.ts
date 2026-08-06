/**
 * Profile privacy stripping — the TypeScript mirror of the rules enforced
 * by get_public_profile()/search_people() in the database.
 *
 * WHY IT EXISTS TWICE: the database version is the enforcement (it runs
 * even for hand-crafted API calls). This pure version exists so that
 *   (a) the profile edit page can show "here's what others see" instantly
 *       as you toggle switches, and
 *   (b) the rules are unit-testable without a database (the spec requires
 *       tests for privacy stripping specifically).
 * If you change a rule HERE, change it in supabase/migrations/0008 too —
 * drifting apart would make the preview lie, and tests catch the easy
 * cases but not all of them.
 */
import type { PrivacyFlags } from "@/lib/validation/profile";

/** Fields a student can hide, mapped to the profile keys each flag strips.
 *  ("graduation" is one switch but removes both month and year — a year
 *  alone still reveals the answer.) */
export const PRIVACY_FIELD_KEYS: Record<keyof PrivacyFlags, string[]> = {
  college: ["college"],
  major: ["major"],
  class_standing: ["class_standing"],
  bio: ["bio"],
  graduation: ["graduation_month", "graduation_year"],
  social_links: ["social_links"],
  courses_current: ["courses_current"],
  courses_taken: ["courses_taken"],
  courses_future: ["courses_future"],
};

export function isHidden(privacy: PrivacyFlags | null | undefined, field: keyof PrivacyFlags): boolean {
  return privacy?.[field] === true;
}

/**
 * Returns a copy of `profile` with every hidden field REMOVED (the key is
 * absent, not null — matching the database's behavior, and matching the
 * spec's "absent from the API response entirely").
 */
export function stripHiddenFields<T extends Record<string, unknown>>(
  profile: T,
  privacy: PrivacyFlags | null | undefined,
): Partial<T> {
  const result: Record<string, unknown> = { ...profile };
  for (const flag of Object.keys(PRIVACY_FIELD_KEYS) as (keyof PrivacyFlags)[]) {
    if (isHidden(privacy, flag)) {
      for (const key of PRIVACY_FIELD_KEYS[flag]) {
        delete result[key];
      }
    }
  }
  return result as Partial<T>;
}
