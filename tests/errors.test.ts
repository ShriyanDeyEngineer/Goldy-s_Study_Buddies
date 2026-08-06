/**
 * Error-mapping tests (spec §11: "error-code mapping"). The contract: a
 * student NEVER sees raw database text. Every code our SQL raises maps
 * to friendly copy; anything unrecognized falls back to the generic
 * apology; and Supabase's masked trigger error becomes the domain
 * message (pitfall #10).
 */
import { describe, expect, it } from "vitest";
import { FRIENDLY_MESSAGES, friendlyError, GENERIC_ERROR } from "@/lib/errors";

describe("friendlyError", () => {
  it("maps a bare code (how PostgREST delivers our RAISEs)", () => {
    expect(friendlyError(new Error("GROUP_FULL"))).toBe(FRIENDLY_MESSAGES.GROUP_FULL);
  });

  it("maps a code embedded in a longer message", () => {
    expect(friendlyError(new Error('update failed: "NOT_MANAGER"'))).toBe(
      FRIENDLY_MESSAGES.NOT_MANAGER,
    );
  });

  it("accepts plain strings and {message} objects too", () => {
    expect(friendlyError("DUPLICATE_REQUEST")).toBe(FRIENDLY_MESSAGES.DUPLICATE_REQUEST);
    expect(friendlyError({ message: "BLOCKED" })).toBe(FRIENDLY_MESSAGES.BLOCKED);
  });

  it("translates Supabase's masked signup-trigger error to the domain message", () => {
    expect(friendlyError(new Error("Database error saving new user"))).toBe(
      FRIENDLY_MESSAGES.EMAIL_DOMAIN_NOT_ALLOWED,
    );
  });

  it("raw Postgres noise falls back to the generic apology — never leaks", () => {
    const raw = 'duplicate key value violates unique constraint "friends_pkey"';
    expect(friendlyError(new Error(raw))).toBe(GENERIC_ERROR);
    expect(friendlyError(new Error(raw))).not.toContain("constraint");
  });

  it("handles null/undefined/junk without throwing", () => {
    expect(friendlyError(null)).toBe(GENERIC_ERROR);
    expect(friendlyError(undefined)).toBe(GENERIC_ERROR);
    expect(friendlyError(42)).toBe(GENERIC_ERROR);
  });

  it("every mapped message is human copy, not the code itself", () => {
    for (const [code, message] of Object.entries(FRIENDLY_MESSAGES)) {
      expect(message).not.toBe(code);
      expect(message.length).toBeGreaterThan(10);
      // Codes are SCREAMING_SNAKE; copy must not be.
      expect(message).not.toMatch(/^[A-Z_]+$/);
    }
  });
});
