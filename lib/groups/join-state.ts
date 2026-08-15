/**
 * The join-button state machine (spec §5.7).
 *
 * Decides which single control a student sees on a group card or page.
 * Pure function — no fetching — so it renders identically on server and
 * client and is exhaustively unit-tested.
 *
 * The rules, in priority order (ORDER MATTERS — a member of a full group
 * must see "Member", not "Full"):
 *   1. group disbanded/inactive        → 'unavailable'
 *   2. you run the group               → 'manager'
 *   3. you're in the group             → 'member'
 *   4. you asked and are waiting       → 'requested'   (withdrawable)
 *   5. no seats left                   → 'full'
 *   6. open group                      → 'join'
 *   7. closed group                    → 'request'
 */

export type JoinState =
  | "unavailable"
  | "manager"
  | "member"
  | "requested"
  | "full"
  | "join"
  | "request";

export interface JoinStateInput {
  /** The group's lifecycle status ('active', 'disbanded', …). */
  groupStatus: string;
  mode: "open" | "closed";
  memberCount: number;
  capacity: number;
  isManager: boolean;
  isMember: boolean;
  hasPendingRequest: boolean;
}

export function getJoinState(input: JoinStateInput): JoinState {
  if (input.groupStatus !== "active") return "unavailable";
  if (input.isManager) return "manager";
  if (input.isMember) return "member";
  if (input.hasPendingRequest) return "requested";
  if (input.memberCount >= input.capacity) return "full";
  return input.mode === "open" ? "join" : "request";
}

/** What the button reads in each state — kept beside the machine so copy
 *  and logic stay in sync. */
export const JOIN_STATE_LABELS: Record<JoinState, string> = {
  unavailable: "Unavailable",
  manager: "Manager",
  member: "Member",
  requested: "Requested ✓",
  full: "Full",
  join: "Join",
  request: "Request to join",
};
