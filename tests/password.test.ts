/**
 * Password policy tests (spec §5.2 / §11).
 *
 * The load-bearing assertion: a failed submission reports EXACTLY the
 * unmet rules — no more, no fewer. The registration form renders these
 * verbatim, so extra or missing rules would show up on screen.
 */
import { describe, expect, it } from "vitest";
import {
  checkPassword,
  isPasswordValid,
  PASSWORD_RULES,
  unmetPasswordRules,
  registerSchema,
} from "@/lib/validation/auth";

const VALID_PASSWORD = "Gophers2026!go"; // 14 chars, upper, lower, digit, special

describe("password policy", () => {
  it("has exactly the five spec rules", () => {
    expect(PASSWORD_RULES.map((r) => r.id)).toEqual([
      "length",
      "uppercase",
      "lowercase",
      "digit",
      "special",
    ]);
  });

  it("accepts a password meeting every rule", () => {
    expect(isPasswordValid(VALID_PASSWORD)).toBe(true);
    expect(unmetPasswordRules(VALID_PASSWORD)).toEqual([]);
  });

  it("rejects 11 characters but accepts 12 (boundary)", () => {
    // Both contain all four character classes; only length differs.
    expect(isPasswordValid("Aa1!aaaaaaa")).toBe(false); // 11
    expect(isPasswordValid("Aa1!aaaaaaaa")).toBe(true); // 12
  });

  it.each([
    ["missing uppercase", "aa1!aaaaaaaa", "uppercase"],
    ["missing lowercase", "AA1!AAAAAAAA", "lowercase"],
    ["missing digit", "Aa!aaaaaaaaa", "digit"],
    ["missing special", "Aa1aaaaaaaaa", "special"],
  ])("flags exactly the %s rule", (_name, password, failingRuleId) => {
    const failing = checkPassword(password).filter((r) => !r.passed);
    expect(failing.map((r) => r.id)).toEqual([failingRuleId]);
  });

  it("reports EXACTLY the unmet rules for a multi-failure password", () => {
    // "short1" fails length + uppercase + special; passes lowercase + digit.
    const unmet = unmetPasswordRules("short1");
    const unmetIds = checkPassword("short1")
      .filter((r) => !r.passed)
      .map((r) => r.id);
    expect(unmetIds.sort()).toEqual(["length", "special", "uppercase"].sort());
    expect(unmet).toHaveLength(3);
  });

  it("empty password fails every rule", () => {
    expect(unmetPasswordRules("")).toHaveLength(PASSWORD_RULES.length);
  });

  it("registerSchema surfaces one zod issue per unmet rule, verbatim", () => {
    const result = registerSchema.safeParse({
      email: "goldy@umn.edu",
      password: "short1",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const passwordMessages = result.error.issues
      .filter((issue) => issue.path[0] === "password")
      .map((issue) => issue.message);
    expect(passwordMessages.sort()).toEqual(unmetPasswordRules("short1").sort());
  });
});
