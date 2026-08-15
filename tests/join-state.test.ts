/**
 * Join-button state machine tests (spec §5.7 / §11): every state, and —
 * critically — the PRIORITY ORDER. A member of a full group sees
 * "Member", never "Full"; a manager always sees "Manager"; disbanded
 * trumps everything.
 */
import { describe, expect, it } from "vitest";
import { getJoinState, JOIN_STATE_LABELS, type JoinStateInput } from "@/lib/groups/join-state";

/** A joinable open group with space — each test overrides what it needs. */
function base(overrides: Partial<JoinStateInput> = {}): JoinStateInput {
  return {
    groupStatus: "active",
    mode: "open",
    memberCount: 3,
    capacity: 8,
    isManager: false,
    isMember: false,
    hasPendingRequest: false,
    ...overrides,
  };
}

describe("getJoinState", () => {
  it("open group with space → join", () => {
    expect(getJoinState(base())).toBe("join");
  });

  it("closed group with space → request", () => {
    expect(getJoinState(base({ mode: "closed" }))).toBe("request");
  });

  it("full group → full (open or closed)", () => {
    expect(getJoinState(base({ memberCount: 8 }))).toBe("full");
    expect(getJoinState(base({ memberCount: 8, mode: "closed" }))).toBe("full");
  });

  it("pending request → requested", () => {
    expect(getJoinState(base({ mode: "closed", hasPendingRequest: true }))).toBe("requested");
  });

  it("member → member; manager → manager", () => {
    expect(getJoinState(base({ isMember: true }))).toBe("member");
    expect(getJoinState(base({ isMember: true, isManager: true }))).toBe("manager");
  });

  it("disbanded → unavailable, whatever else is true", () => {
    expect(
      getJoinState(base({ groupStatus: "disbanded", isManager: true, isMember: true })),
    ).toBe("unavailable");
  });

  // ── The ordering rules the spec calls out explicitly ────────────────
  it("member of a FULL group sees member, not full", () => {
    expect(getJoinState(base({ isMember: true, memberCount: 8 }))).toBe("member");
  });

  it("manager outranks member", () => {
    expect(getJoinState(base({ isManager: true, isMember: true, memberCount: 8 }))).toBe(
      "manager",
    );
  });

  it("requested outranks full (withdrawing must stay possible)", () => {
    expect(
      getJoinState(base({ mode: "closed", hasPendingRequest: true, memberCount: 8 })),
    ).toBe("requested");
  });

  it("exact capacity boundary: one seat left is joinable, zero is not", () => {
    expect(getJoinState(base({ memberCount: 7, capacity: 8 }))).toBe("join");
    expect(getJoinState(base({ memberCount: 8, capacity: 8 }))).toBe("full");
  });

  it("every state has a label (copy can never fall out of sync)", () => {
    const states = [
      "unavailable",
      "manager",
      "member",
      "requested",
      "full",
      "join",
      "request",
    ] as const;
    for (const state of states) {
      expect(JOIN_STATE_LABELS[state]).toBeTruthy();
    }
  });
});
