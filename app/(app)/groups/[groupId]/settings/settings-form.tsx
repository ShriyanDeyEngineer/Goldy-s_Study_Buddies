/**
 * The manager's settings form: rename, open⇄closed switch, and the
 * danger zone (disband behind typed-name confirmation).
 *
 * The closed → open warning matters: flipping open AUTO-APPROVES waiting
 * requests oldest-first until the group is full (spec §5.9). Managers
 * should flip it knowingly, so the form says so right next to the radio.
 */
"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { disbandGroupAction, updateGroupSettingsAction } from "@/lib/actions/groups";
import { GROUP_NAME_MAX } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TypedConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsForm({
  groupId,
  currentName,
  currentMode,
  pendingNote,
}: {
  groupId: string;
  currentName: string;
  currentMode: "open" | "closed";
  /** True when the group is currently closed (may have queued requests). */
  pendingNote: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateGroupSettingsAction, {});

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <form action={formAction} noValidate className="space-y-5">
            <input type="hidden" name="group_id" value={groupId} />

            <div>
              <Label htmlFor="name">Group name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={currentName}
                maxLength={GROUP_NAME_MAX}
                required
                aria-invalid={!!state.fieldErrors?.name}
                aria-describedby="name-error"
              />
              <FieldError id="name-error" error={state.fieldErrors?.name} />
            </div>

            <fieldset>
              <legend className="mb-1.5 block text-sm font-medium text-ink">Mode</legend>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-checked:border-maroon has-checked:bg-cream/60">
                  <input
                    type="radio"
                    name="mode"
                    value="open"
                    defaultChecked={currentMode === "open"}
                    className="mt-1 accent-maroon"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">Open</span>
                    <span className="block text-sm text-ink-muted">
                      Anyone joins instantly.
                      {pendingNote && (
                        <>
                          {" "}
                          <strong className="font-medium text-warning">
                            Switching to open approves everyone currently waiting,
                            oldest request first, until the group is full.
                          </strong>
                        </>
                      )}
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-checked:border-maroon has-checked:bg-cream/60">
                  <input
                    type="radio"
                    name="mode"
                    value="closed"
                    defaultChecked={currentMode === "closed"}
                    className="mt-1 accent-maroon"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">Closed</span>
                    <span className="block text-sm text-ink-muted">
                      You approve each join request.
                    </span>
                  </span>
                </label>
              </div>
              <FieldError error={state.fieldErrors?.mode} />
            </fieldset>

            {state.error && (
              <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                {state.error}
              </p>
            )}
            {state.success && (
              <p role="status" className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
                {state.success}
              </p>
            )}

            <Button type="submit" loading={pending}>
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-danger/40">
        <CardContent>
          <h2 className="font-display text-lg text-ink">Danger zone</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Disbanding removes every member, cancels all upcoming meetups, declines
            all pending requests, and notifies everyone. There is no undo.
          </p>
          <div className="mt-4">
            <TypedConfirmDialog
              title="Disband this group?"
              description="This permanently shuts the group down: members removed, upcoming meetups cancelled, pending requests declined, everyone notified."
              requiredText={currentName}
              confirmLabel="Disband forever"
              onConfirm={async () => {
                // On success the action redirects to the dashboard.
                const result = await disbandGroupAction(groupId);
                if (result?.error) toast.error(result.error);
              }}
            >
              <Button variant="danger">Disband group…</Button>
            </TypedConfirmDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
