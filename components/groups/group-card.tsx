/**
 * Compact study-group card used on the dashboard and course pages:
 * name, course code, members vs capacity, open/closed badge, next
 * meetup if one is scheduled. The whole card links to the group page.
 */
import Link from "next/link";
import { CalendarClock, Users } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { pluralize } from "@/lib/utils";

export function GroupCard({
  groupId,
  name,
  courseLabel,
  memberCount,
  capacity,
  mode,
  status,
  nextMeetup,
}: {
  groupId: string;
  name: string;
  courseLabel: string;
  memberCount: number;
  capacity: number;
  mode: "open" | "closed";
  status: string;
  /** The soonest upcoming, non-cancelled meetup — null when none. */
  nextMeetup: { title: string; scheduled_at: string } | null;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-maroon">
              {courseLabel}
            </p>
            <h3 className="mt-0.5 truncate font-display text-lg text-ink">
              <Link
                href={`/groups/${groupId}`}
                className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {/* Stretch the link over the card for a big tap target. */}
                <span className="absolute inset-0" aria-hidden="true" />
                {name}
              </Link>
            </h3>
          </div>
          {status !== "active" ? (
            <Badge variant="outline">Disbanded</Badge>
          ) : (
            <Badge variant={mode === "open" ? "success" : "warning"}>
              {mode === "open" ? "Open" : "Closed"}
            </Badge>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Users aria-hidden className="h-4 w-4" />
            {memberCount}/{capacity} {pluralize(capacity, "seat", "seats").split(" ")[1]}
          </span>
          {nextMeetup && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock aria-hidden className="h-4 w-4" />
              {/* Local-time render of the stored UTC instant. */}
              {format(new Date(nextMeetup.scheduled_at), "EEE MMM d, h:mm a")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
