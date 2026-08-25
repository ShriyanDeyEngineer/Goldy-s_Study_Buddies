/**
 * /admin/requests — the course-request queue. Pending requests render as
 * editable forms so an admin can fix a typo'd department code or the
 * course's official name BEFORE approving; approve creates the catalog
 * entry and notifies the requester, decline just notifies.
 */
import { getSessionProfile } from "@/lib/supabase/server";
import type { CourseRequestRow, PublicProfile } from "@/lib/types";
import { RequestReviewForm } from "./request-review-form";
import { formatDistanceToNow } from "date-fns";

export const metadata = { title: "Course requests · Admin" };

export default async function AdminRequestsPage() {
  const { supabase } = await getSessionProfile();

  const requestsRes = await supabase
    .from("course_requests")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(200);
  const requests = (requestsRes.data ?? []) as CourseRequestRow[];
  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests
    .filter((r) => r.status !== "pending")
    .sort((a, b) => (b.resolved_at ?? "").localeCompare(a.resolved_at ?? ""))
    .slice(0, 30);

  const requesterIds = [...new Set(requests.map((r) => r.requester_id))];
  const namesRes = requesterIds.length
    ? await supabase.from("public_profiles").select("*").in("id", requesterIds)
    : { data: [] };
  const names = Object.fromEntries(
    ((namesRes.data ?? []) as PublicProfile[]).map((p) => [p.id, p.display_name]),
  );

  return (
    <div className="space-y-8">
      <section aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="mb-3 font-display text-xl text-ink">
          Waiting for review ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No pending requests. When a student can&rsquo;t find their course
            and files a request, it lands here.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((request) => (
              <li key={request.id}>
                <RequestReviewForm
                  request={request}
                  requesterName={names[request.requester_id] ?? "Deleted User"}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {resolved.length > 0 && (
        <section aria-labelledby="resolved-heading">
          <h2 id="resolved-heading" className="mb-3 font-display text-xl text-ink">
            Recently resolved
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            {resolved.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="text-ink">
                  {request.department_code} {request.course_number} — {request.course_name}
                  <span className="ml-2 text-xs text-ink-muted">
                    by {names[request.requester_id] ?? "Deleted User"}
                  </span>
                </span>
                <span
                  className={
                    request.status === "approved"
                      ? "text-xs font-medium text-success"
                      : "text-xs font-medium text-ink-muted"
                  }
                >
                  {request.status}
                  {request.resolved_at &&
                    ` · ${formatDistanceToNow(new Date(request.resolved_at), { addSuffix: true })}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
