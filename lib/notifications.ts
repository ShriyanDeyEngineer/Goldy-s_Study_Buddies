/**
 * Notification rendering rules: for each notification type, the sentence
 * to show and the page clicking it should open. Used by the header bell
 * and the /notifications page so the two can never disagree.
 *
 * Adding a notification type = raise it from a database function
 * (app_notify) + add one entry here. Unknown types still render (generic
 * copy, links to the notifications page) so an old client never crashes
 * on a new type.
 */
import type { NotificationRow } from "@/lib/types";

interface Rendered {
  message: string;
  href: string;
}

/** payload fields are set by the database functions; every field is
 *  optional here because payloads evolve — always fall back gracefully. */
export function renderNotification(n: NotificationRow): Rendered {
  const p = n.payload ?? {};
  const group = p.group_name ?? "your group";
  const groupHref = p.group_id ? `/groups/${p.group_id}` : "/dashboard";

  switch (n.type) {
    case "group_invitation":
      return { message: `You've been invited to join ${group}.`, href: groupHref };
    case "invitation_accepted":
      return { message: `Your invitation to ${group} was accepted.`, href: groupHref };
    case "join_request_received":
      return { message: `Someone asked to join ${group}.`, href: groupHref };
    case "join_request_approved":
      return { message: `You're in! Your request to join ${group} was approved.`, href: groupHref };
    case "join_request_denied":
      return { message: `Your request to join ${group} wasn't approved this time.`, href: "/courses" };
    case "request_cancelled_group_full":
      return { message: `${group} filled up before your request could be approved.`, href: "/courses" };
    case "removed_from_group":
      return { message: `You were removed from ${group}.`, href: "/courses" };
    case "group_disbanded":
      return { message: `${group} was disbanded.`, href: "/dashboard" };
    case "manager_transferred":
      return { message: `You're now the manager of ${group}.`, href: groupHref };
    case "meetup_created":
      return { message: `New meetup in ${group}: ${p.title ?? "study session"}.`, href: groupHref };
    case "meetup_cancelled":
      return {
        message:
          `Meetup cancelled in ${group}: ${p.title ?? "study session"}` +
          (p.reason ? ` — "${p.reason}"` : "."),
        href: groupHref,
      };
    case "friend_request":
      return { message: "You have a new friend request.", href: p.user_id ? `/profile/${p.user_id}` : "/friends" };
    case "friend_request_accepted":
      return { message: "Your friend request was accepted!", href: p.user_id ? `/profile/${p.user_id}` : "/friends" };
    case "buddy_request":
      return { message: "Someone wants to be your study buddy.", href: p.user_id ? `/profile/${p.user_id}` : "/friends" };
    case "buddy_request_accepted":
      return { message: "You've got a new study buddy!", href: p.user_id ? `/profile/${p.user_id}` : "/friends" };
    default:
      return { message: "Something new happened.", href: "/notifications" };
  }
}
