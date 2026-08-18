/**
 * Duration formatting (lib/format.ts) — the label on the meetup slider.
 * Boundaries are the product limits: 15 min and 8 h (480 min).
 */
import { describe, expect, it } from "vitest";
import { formatDuration } from "@/lib/format";

describe("formatDuration", () => {
  it("shows minutes only under an hour", () => {
    expect(formatDuration(15)).toBe("15 min");
    expect(formatDuration(45)).toBe("45 min");
  });
  it("shows whole hours cleanly", () => {
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(480)).toBe("8 h");
  });
  it("combines hours and minutes", () => {
    expect(formatDuration(90)).toBe("1 h 30 min");
    expect(formatDuration(135)).toBe("2 h 15 min");
  });
  it("never renders garbage for bad input", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(-5)).toBe("0 min");
    expect(formatDuration(NaN)).toBe("0 min");
  });
});
