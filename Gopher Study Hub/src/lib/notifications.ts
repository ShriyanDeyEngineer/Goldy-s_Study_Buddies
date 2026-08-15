type Payload = Record<string, unknown> | null;

function text(payload: Payload, key: string, fallback: string) {
  const value = payload && typeof payload === "object" ? payload[key] : null;
  return typeof value === "string" && value.trim() ? value : fallback;
}

/** Turns a stored notification row into a plain sentence. */
export function notificationText(type: string, rawPayload: unknown): string {
  const payload = (rawPayload ?? null) as Payload;
  const group = text(payload, "group_name", "a group");
  const who = text(payload, "actor_name", "Someone");

  switch (type) {
    case "join_request":
      return `${who} asked to join ${group}.`;
    case "request_approved":
      return `Your request to join ${group} was approved.`;
    case "request_denied":
      return `Your request to join ${group} was declined.`;
    case "invitation":
      return `${who} invited you to ${group}.`;
    case "invitation_accepted":
      return `${who} accepted your invitation to ${group}.`;
    case "member_joined":
      return `${who} joined ${group}.`;
    case "member_left":
      return `${who} left ${group}.`;
    case "member_removed":
      return `You were removed from ${group}.`;
    case "manager_assigned":
      return `You're now the manager of ${group}.`;
    case "group_renamed":
      return `${group} was renamed.`;
    case "group_disbanded":
      return `${group} was disbanded.`;
    case "meetup_created":
      return `New meetup scheduled in ${group}.`;
    case "meetup_cancelled":
      return `A meetup in ${group} was cancelled.`;
    case "new_message":
      return `New message in ${group}.`;
    default:
      return text(payload, "message", "You have a new notification.");
  }
}
