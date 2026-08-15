/**
 * Filter-construction tests (spec §11 requires these, including the
 * privacy rule note): URL params are untrusted, so invalid UUIDs and
 * off-whitelist values must be DROPPED, never forwarded to the database.
 *
 * Note the division of labor: the hidden-field-excludes-you rule itself
 * lives in search_people() (database, covered by the SQL invariant
 * script). These tests prove the request-shaping layer can't smuggle
 * anything past validation.
 */
import { describe, expect, it } from "vitest";
import {
  filtersToRpcParams,
  filtersToSearchParams,
  hasActiveFilters,
  parsePeopleFilters,
  PAGE_SIZE,
} from "@/lib/people/filters";

const REAL_UUID = "123e4567-e89b-42d3-a456-426614174000";
const OTHER_UUID = "223e4567-e89b-42d3-a456-426614174000";

describe("parsePeopleFilters", () => {
  it("parses a fully-loaded URL", () => {
    const filters = parsePeopleFilters({
      q: "goldy",
      course: `${REAL_UUID},${OTHER_UUID}`,
      major: "Computer Science,Math",
      college: "cse,cla",
      standing: "freshman,senior",
      gradMin: "2026",
      gradMax: "2028",
      buddies: "1",
      page: "2",
    });
    expect(filters.query).toBe("goldy");
    expect(filters.courseIds).toEqual([REAL_UUID, OTHER_UUID]);
    expect(filters.majors).toEqual(["Computer Science", "Math"]);
    expect(filters.colleges).toEqual(["cse", "cla"]);
    expect(filters.standings).toEqual(["freshman", "senior"]);
    expect(filters.gradMin).toBe(2026);
    expect(filters.gradMax).toBe(2028);
    expect(filters.buddiesOnly).toBe(true);
    expect(filters.page).toBe(2);
  });

  it("DROPS non-UUID course ids (pitfall #5: no raw input in queries)", () => {
    const filters = parsePeopleFilters({
      course: `${REAL_UUID},not-a-uuid,1;DROP TABLE profiles`,
    });
    expect(filters.courseIds).toEqual([REAL_UUID]);
  });

  it("DROPS colleges and standings not on the whitelist", () => {
    const filters = parsePeopleFilters({
      college: "cse,hogwarts",
      standing: "freshman,wizard",
    });
    expect(filters.colleges).toEqual(["cse"]);
    expect(filters.standings).toEqual(["freshman"]);
  });

  it("drops out-of-range and malformed years", () => {
    expect(parsePeopleFilters({ gradMin: "1999" }).gradMin).toBeNull();
    expect(parsePeopleFilters({ gradMax: "2098" }).gradMax).toBeNull();
    expect(parsePeopleFilters({ gradMin: "20x6" }).gradMin).toBeNull();
    // Range edges are valid (spec §11: test the exact boundaries).
    expect(parsePeopleFilters({ gradMin: "2020" }).gradMin).toBe(2020);
    expect(parsePeopleFilters({ gradMax: "2040" }).gradMax).toBe(2040);
  });

  it("swaps a reversed year range instead of returning nothing", () => {
    const filters = parsePeopleFilters({ gradMin: "2030", gradMax: "2026" });
    expect(filters.gradMin).toBe(2026);
    expect(filters.gradMax).toBe(2030);
  });

  it("treats a 1-character query as no query (2-char minimum)", () => {
    expect(parsePeopleFilters({ q: "g" }).query).toBeNull();
    expect(parsePeopleFilters({ q: "go" }).query).toBe("go");
  });

  it("caps the query at 100 characters", () => {
    const filters = parsePeopleFilters({ q: "x".repeat(500) });
    expect(filters.query).toHaveLength(100);
  });

  it("de-duplicates repeated values", () => {
    const filters = parsePeopleFilters({ college: "cse,cse,cse" });
    expect(filters.colleges).toEqual(["cse"]);
  });

  it("defaults page to 1 for garbage", () => {
    expect(parsePeopleFilters({ page: "-3" }).page).toBe(1);
    expect(parsePeopleFilters({ page: "abc" }).page).toBe(1);
    expect(parsePeopleFilters({ page: "1.5" }).page).toBe(1);
  });
});

describe("filtersToRpcParams", () => {
  it("empty filter lists become null (SQL 'no filter'), not empty arrays", () => {
    const params = filtersToRpcParams(parsePeopleFilters({}));
    expect(params.p_course_ids).toBeNull();
    expect(params.p_majors).toBeNull();
    expect(params.p_colleges).toBeNull();
    expect(params.p_standings).toBeNull();
    expect(params.p_buddy_only).toBe(false);
    expect(params.p_limit).toBe(PAGE_SIZE);
    expect(params.p_offset).toBe(0);
  });

  it("page 3 offsets by two pages", () => {
    const params = filtersToRpcParams(parsePeopleFilters({ page: "3" }));
    expect(params.p_offset).toBe(2 * PAGE_SIZE);
  });
});

describe("URL round-trip (chips and clear-all depend on this)", () => {
  it("parse → serialize → parse is lossless", () => {
    const original = parsePeopleFilters({
      q: "goldy",
      course: REAL_UUID,
      college: "cse",
      gradMin: "2026",
      buddies: "1",
    });
    const reparsed = parsePeopleFilters(
      Object.fromEntries(filtersToSearchParams(original).entries()),
    );
    expect(reparsed).toEqual({ ...original, page: 1 });
  });
});

describe("hasActiveFilters", () => {
  it("query alone is not a 'filter' (it has its own chip)", () => {
    expect(hasActiveFilters(parsePeopleFilters({ q: "goldy" }))).toBe(false);
    expect(hasActiveFilters(parsePeopleFilters({ college: "cse" }))).toBe(true);
    expect(hasActiveFilters(parsePeopleFilters({}))).toBe(false);
  });
});
