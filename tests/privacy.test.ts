/**
 * Profile-privacy stripping tests (spec §11 names these explicitly).
 * Mirrors the database rules: hidden fields are REMOVED (key absent, not
 * null), graduation hides month AND year together, and unflagged fields
 * pass through untouched.
 */
import { describe, expect, it } from "vitest";
import { stripHiddenFields, isHidden } from "@/lib/people/privacy";

const FULL_PROFILE = {
  id: "u1",
  display_name: "Goldy",
  college: "cse",
  major: "Computer Science",
  class_standing: "sophomore",
  bio: "hello",
  graduation_month: 5,
  graduation_year: 2027,
  social_links: ["https://example.com"],
  courses_current: [{ id: "c1" }],
  courses_taken: [{ id: "c2" }],
  courses_future: [{ id: "c3" }],
};

describe("stripHiddenFields", () => {
  it("empty privacy hides nothing", () => {
    expect(stripHiddenFields(FULL_PROFILE, {})).toEqual(FULL_PROFILE);
    expect(stripHiddenFields(FULL_PROFILE, null)).toEqual(FULL_PROFILE);
    expect(stripHiddenFields(FULL_PROFILE, undefined)).toEqual(FULL_PROFILE);
  });

  it("removes a hidden field ENTIRELY — absent key, not null", () => {
    const stripped = stripHiddenFields(FULL_PROFILE, { major: true });
    expect("major" in stripped).toBe(false);
    expect(stripped.college).toBe("cse"); // neighbors untouched
  });

  it("hiding graduation removes month AND year (year alone still leaks)", () => {
    const stripped = stripHiddenFields(FULL_PROFILE, { graduation: true });
    expect("graduation_month" in stripped).toBe(false);
    expect("graduation_year" in stripped).toBe(false);
  });

  it("the three course lists hide independently", () => {
    const stripped = stripHiddenFields(FULL_PROFILE, {
      courses_current: true,
      courses_future: true,
    });
    expect("courses_current" in stripped).toBe(false);
    expect("courses_taken" in stripped).toBe(true);
    expect("courses_future" in stripped).toBe(false);
  });

  it("a false flag hides nothing", () => {
    const stripped = stripHiddenFields(FULL_PROFILE, { major: false });
    expect(stripped.major).toBe("Computer Science");
  });

  it("hiding everything leaves the identity fields", () => {
    const stripped = stripHiddenFields(FULL_PROFILE, {
      college: true,
      major: true,
      class_standing: true,
      bio: true,
      graduation: true,
      social_links: true,
      courses_current: true,
      courses_taken: true,
      courses_future: true,
    });
    // Name/id are not hideable — they're the user's public identity.
    expect(stripped.id).toBe("u1");
    expect(stripped.display_name).toBe("Goldy");
    expect(Object.keys(stripped).sort()).toEqual(["display_name", "id"]);
  });

  it("does not mutate the input object", () => {
    const copy = { ...FULL_PROFILE };
    stripHiddenFields(copy, { major: true });
    expect(copy.major).toBe("Computer Science");
  });
});

describe("isHidden", () => {
  it("only an explicit true hides", () => {
    expect(isHidden({ major: true }, "major")).toBe(true);
    expect(isHidden({ major: false }, "major")).toBe(false);
    expect(isHidden({}, "major")).toBe(false);
    expect(isHidden(null, "major")).toBe(false);
  });
});
