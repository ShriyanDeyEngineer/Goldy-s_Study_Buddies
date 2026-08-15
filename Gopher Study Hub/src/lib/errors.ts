/**
 * Maps machine-readable database error codes to friendly copy.
 * A raw database error must never reach the user.
 */
const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "You need to be signed in to do that.",
  EMAIL_DOMAIN_NOT_ALLOWED: "Only University of Minnesota emails (@umn.edu) can join right now.",
  NO_PROFILE: "Finish setting up your profile first.",
  GROUP_FULL: "This group is full — every seat is taken.",
  GROUP_UNAVAILABLE: "This group isn't available anymore.",
  NAME_TAKEN: "A group in this course already uses that name. Try another.",
  INVALID_NAME: "Group names need to be between 1 and 100 characters.",
  INVALID_CAPACITY: "Capacity has to be between 2 and 50.",
  TOO_MANY_INVITES: "You invited more people than the group has seats for.",
  NOT_MANAGER: "Only the group manager can do that.",
  NOT_MEMBER: "You need to be a member of this group first.",
  ALREADY_MEMBER: "You're already in this group.",
  DUPLICATE_REQUEST: "You've already asked to join — hang tight for the manager.",
  NO_PENDING_REQUEST: "There's no pending request to withdraw.",
  REQUEST_NOT_FOUND: "That request no longer exists.",
  REQUEST_NOT_PENDING: "That request was already handled.",
  INVITATION_NOT_FOUND: "That invitation no longer exists.",
  INVITATION_NOT_PENDING: "That invitation was already answered.",
  NOT_INVITEE: "That invitation isn't yours.",
  CANNOT_REMOVE_SELF: "Use “Leave group” to remove yourself.",
  MEETUP_NOT_FOUND: "That meetup no longer exists.",
  NOT_ALLOWED: "You don't have permission to do that.",
  INVALID_MESSAGE: "Messages must be between 1 and 2,000 characters.",
  INVALID_TITLE: "Meetup titles need to be between 1 and 100 characters.",
  INVALID_TIME: "Pick a date and time in the future.",
  LINK_REQUIRED: "Online meetups need a meeting link.",
  LOCATION_REQUIRED: "In-person meetups need a location.",
};

export const GENERIC_ERROR = "Something went wrong on our end. Please try again.";

export function friendlyError(error: unknown): string {
  if (!error) return GENERIC_ERROR;
  const raw =
    typeof error === "string"
      ? error
      : ((error as { message?: string }).message ?? "");
  for (const code of Object.keys(MESSAGES)) {
    if (raw.includes(code)) return MESSAGES[code] as string;
  }
  return GENERIC_ERROR;
}

export function errorCode(error: unknown): string | null {
  const raw =
    typeof error === "string" ? error : ((error as { message?: string })?.message ?? "");
  return Object.keys(MESSAGES).find((code) => raw.includes(code)) ?? null;
}
