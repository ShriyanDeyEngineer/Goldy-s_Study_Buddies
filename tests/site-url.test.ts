/**
 * Tests for origin normalization (lib/site.ts).
 *
 * WHY THIS FILE EXISTS: a NEXT_PUBLIC_SITE_URL entered without "https://"
 * produced an invalid OAuth redirect_to. Supabase silently rejected it,
 * fell back to its own Site URL, and dumped students on the homepage with
 * an unusable ?code= — no error, nothing in any log. It cost an evening to
 * find. These cases lock the fix in place.
 */
import { describe, expect, it } from "vitest";
import { normalizeOrigin, safeInternalPath } from "@/lib/site";

describe("normalizeOrigin", () => {
  it("adds https:// when the scheme is missing — the bug that broke sign-in", () => {
    expect(normalizeOrigin("studybuddiesmn.vercel.app")).toBe(
      "https://studybuddiesmn.vercel.app",
    );
  });

  it("leaves a correct origin untouched", () => {
    expect(normalizeOrigin("https://studybuddiesmn.vercel.app")).toBe(
      "https://studybuddiesmn.vercel.app",
    );
  });

  it("strips trailing slashes so we never build a '//auth/callback' path", () => {
    expect(normalizeOrigin("https://example.com/")).toBe("https://example.com");
    expect(normalizeOrigin("https://example.com///")).toBe("https://example.com");
  });

  it("trims stray whitespace from copy-paste", () => {
    expect(normalizeOrigin("  https://example.com  ")).toBe("https://example.com");
  });

  it("uses http:// for localhost, which has no certificate", () => {
    expect(normalizeOrigin("localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeOrigin("127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
  });

  it("keeps an explicit http:// even for a real domain (don't fight the operator)", () => {
    expect(normalizeOrigin("http://staging.example.com")).toBe(
      "http://staging.example.com",
    );
  });
});

describe("safeInternalPath (open-redirect guard)", () => {
  it("keeps ordinary internal paths", () => {
    expect(safeInternalPath("/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("/groups/abc")).toBe("/groups/abc");
  });

  it("falls back when nothing was supplied", () => {
    expect(safeInternalPath(null)).toBe("/dashboard");
    expect(safeInternalPath(undefined)).toBe("/dashboard");
  });

  it("refuses absolute URLs and protocol-relative paths", () => {
    expect(safeInternalPath("https://evil.example.com")).toBe("/dashboard");
    expect(safeInternalPath("//evil.example.com")).toBe("/dashboard");
    expect(safeInternalPath("javascript:alert(1)")).toBe("/dashboard");
  });
});
