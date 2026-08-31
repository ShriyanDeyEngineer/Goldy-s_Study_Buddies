/**
 * Flag / unflag one piece of content (a group message, a DM, or a group
 * resource) as inappropriate — migration 0040.
 *
 * Invisible to everyone else: this only ever writes to content_flags, so
 * other members see nothing change. The control's state is per-viewer —
 * `flagged` seeds it from the server, and it flips optimistically after
 * that (a re-flag is a harmless no-op server-side, so stale `false` on a
 * realtime/older message is fine).
 *
 * Two looks:
 *   variant="inline" — a faint text control under a chat bubble, revealed
 *                      on hover/focus (kept visible once flagged).
 *   variant="icon"   — a ghost icon button, for the resource action row.
 */
"use client";

import * as React from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { flagContentAction, unflagContentAction } from "@/lib/actions/flags";
import { FLAG_REASON_MAX, type FlagContentType } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function FlagControl({
  contentType,
  contentId,
  flagged: initialFlagged,
  label,
  variant = "inline",
  className,
}: {
  contentType: FlagContentType;
  contentId: string;
  /** Whether the current viewer has already flagged this item. */
  flagged: boolean;
  /** Fills the dialog copy + aria labels, e.g. "this message". */
  label: string;
  variant?: "inline" | "icon";
  className?: string;
}) {
  const [flagged, setFlagged] = React.useState(initialFlagged);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setFlagged(initialFlagged), [initialFlagged]);

  async function submitFlag() {
    setBusy(true);
    const { error } = await flagContentAction({
      contentType,
      contentId,
      reason: reason.trim() || undefined,
    });
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    setFlagged(true);
    setDialogOpen(false);
    setReason("");
    toast.success("Flagged for review. Only the moderators can see this.");
  }

  async function removeFlag() {
    const { error } = await unflagContentAction({ contentType, contentId });
    if (error) {
      toast.error(error);
      return;
    }
    setFlagged(false);
    toast.success("Flag removed.");
  }

  const flagDialog = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent>
        <DialogTitle>Flag {label}?</DialogTitle>
        <DialogDescription>
          A moderator will review it. Your name is shown to the moderators
          only — other members are never told that you flagged this, and
          nothing about {label} changes for anyone.
        </DialogDescription>
        <div className="mt-4">
          <Label htmlFor="flag-reason">What&rsquo;s wrong with it? (optional)</Label>
          <Input
            id="flag-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={FLAG_REASON_MAX}
            placeholder="A few words to help the moderators"
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
            Never mind
          </Button>
          <Button variant="danger" onClick={submitFlag} loading={busy}>
            Flag for review
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (flagged) {
    // Already flagged by this viewer — offer to undo.
    const undo = (
      <ConfirmDialog
        title={`Remove your flag on ${label}?`}
        description="The moderators will no longer see this as flagged by you."
        confirmLabel="Remove flag"
        destructive={false}
        onConfirm={removeFlag}
      >
        {variant === "icon" ? (
          <Button
            size="icon"
            variant="ghost"
            aria-label={`You flagged ${label} — remove your flag`}
            className={cn("shrink-0 text-danger", className)}
          >
            <Flag aria-hidden className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <button
            type="button"
            aria-label={`You flagged ${label} — remove your flag`}
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium text-danger hover:underline",
              className,
            )}
          >
            <Flag aria-hidden className="h-3 w-3 fill-current" />
            Flagged — undo
          </button>
        )}
      </ConfirmDialog>
    );
    return undo;
  }

  return (
    <>
      {variant === "icon" ? (
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Flag ${label} as inappropriate`}
          onClick={() => setDialogOpen(true)}
          className={cn("shrink-0 text-ink-muted hover:text-danger", className)}
        >
          <Flag aria-hidden className="h-4 w-4" />
        </Button>
      ) : (
        <button
          type="button"
          aria-label={`Flag ${label} as inappropriate`}
          onClick={() => setDialogOpen(true)}
          className={cn(
            "inline-flex items-center gap-1 text-[10px] text-ink-muted hover:text-danger",
            // Dim but always reachable (hover-only would strand touch users);
            // full strength on hover/focus.
            "opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100",
            className,
          )}
        >
          <Flag aria-hidden className="h-3 w-3" />
          Flag
        </button>
      )}
      {flagDialog}
    </>
  );
}
