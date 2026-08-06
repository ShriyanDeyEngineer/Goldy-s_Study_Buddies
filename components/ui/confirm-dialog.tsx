/**
 * Reusable confirmation dialogs for consequential actions.
 *
 * Two flavors:
 *   <ConfirmDialog>      — ordinary "Are you sure?" (leave group, remove
 *                          member, cancel meetup, block user…)
 *   <TypedConfirmDialog> — the nuclear option: the user must type the
 *                          exact name to enable the confirm button. The
 *                          spec requires this for disbanding a group.
 *
 * Both take the trigger button as children and run `onConfirm` (an async
 * function — usually a server action) when confirmed, showing a spinner
 * while it runs.
 */
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  destructive = true,
  onConfirm,
  children,
}: {
  title: string;
  /** Must explain the CONSEQUENCE, e.g. "You'll lose access to this group's chat." */
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      // Always clear the spinner, even if onConfirm threw — otherwise a
      // failed action would leave the dialog stuck in "loading" forever.
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Never mind
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={handleConfirm}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TypedConfirmDialog({
  title,
  description,
  /** The exact string the user must type (e.g. the group's name). */
  requiredText,
  confirmLabel = "Delete forever",
  onConfirm,
  children,
}: {
  title: string;
  description: string;
  requiredText: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  // Exact match required — trimming only, so stray spaces don't punish
  // the user, but case still has to match the real name.
  const matches = typed.trim() === requiredText;

  async function handleConfirm() {
    if (!matches) return;
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped(""); // reset so reopening starts clean
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <div className="mt-4">
          <Label htmlFor="typed-confirm">
            Type <span className="font-semibold text-ink">{requiredText}</span> to confirm
          </Label>
          <Input
            id="typed-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            // Guard: pressing Enter here must not submit any surrounding
            // form — it either confirms (when the text matches) or nothing.
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleConfirm();
              }
            }}
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Never mind
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={!matches} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
