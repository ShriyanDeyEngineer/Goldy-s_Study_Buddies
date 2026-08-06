/**
 * Email-domain validation tests (spec §5.2). The client-side half of the
 * "UMN students only" rule — the database trigger is the enforcement;
 * this is the UX layer, and it must agree with it.
 */
import { describe, expect, it } from "vitest";
import { isAllowedUniversityEmail, universityEmailSchema } from "@/lib/validation/auth";

describe("university email validation", () => {
  it.each([
    "goldy@umn.edu",
    "GOLDY@UMN.EDU", // case-insensitive
    "goldy.gopher@Umn.Edu",
  ])("accepts %s", (email) => {
    expect(isAllowedUniversityEmail(email)).toBe(true);
  });

  it.each([
    "goldy@gmail.com",
    "goldy@umn.edu.evil.com", // exact-domain check, not endsWith
    "goldy@edu", // no lookalikes
    "goldy@sub.umn.edu", // subdomains are different mailboxes — not allowed
    "goldy", // not an email at all
    "@umn.edu", // no local part
    "", // empty
  ])("rejects %s", (email) => {
    expect(isAllowedUniversityEmail(email)).toBe(false);
  });

  it("schema gives the friendly domain message for personal accounts", () => {
    const result = universityEmailSchema.safeParse("goldy@gmail.com");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].message).toMatch(/@umn\.edu/);
  });
});
