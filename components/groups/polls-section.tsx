/**
 * Availability polls (spec §5.8) — our native When2Meet. A member opens
 * a poll with candidate slots; members check the slots that work for
 * them; the slot with the most votes is highlighted with a "Schedule
 * this slot" button that opens the meetup dialog prefilled.
 *
 * Built natively on purpose: embedding When2Meet/Calendly would force
 * external accounts and break the single-sign-in experience (the spec
 * forbids it explicitly).
 */
"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ListPlus, Plus, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  closeAvailabilityPollAction,
  createAvailabilityPollAction,
  voteAvailabilityAction,
} from "@/lib/actions/meetups";
import { POLL_SLOTS_MAX, POLL_SLOTS_MIN } from "@/lib/constants";
import type { AvailabilityPollRow, AvailabilitySlotRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MeetupFormDialog } from "@/components/groups/meetup-form-dialog";
import { cn, pluralize } from "@/lib/utils";

export function PollsSection({
  groupId,
  currentUserId,
  isManager,
  polls,
  slots,
  votes,
}: {
  groupId: string;
  currentUserId: string;
  isManager: boolean;
  polls: AvailabilityPollRow[];
  slots: AvailabilitySlotRow[];
  votes: { slot_id: string; user_id: string }[];
}) {
  const router = useRouter();
  const openPolls = polls.filter((p) => p.status === "open");

  return (
    <div className="border-t border-line pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink">Availability polls</h3>
        <NewPollDialog groupId={groupId} />
      </div>

      {openPolls.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">
          Can&rsquo;t agree on a time? Open a poll and let the votes decide.
        </p>
      ) : (
        openPolls.map((poll) => {
          const pollSlots = slots
            .filter((s) => s.poll_id === poll.id)
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
          const countFor = (slotId: string) =>
            votes.filter((v) => v.slot_id === slotId).length;
          const bestCount = Math.max(0, ...pollSlots.map((s) => countFor(s.id)));

          return (
            <div key={poll.id} className="mt-3 rounded-xl border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium text-ink">{poll.title}</h4>
                {(poll.creator_id === currentUserId || isManager) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-ink-muted"
                    onClick={async () => {
                      const { error } = await closeAvailabilityPollAction(poll.id, groupId);
                      if (error) toast.error(error);
                      router.refresh();
                    }}
                  >
                    Close poll
                  </Button>
                )}
              </div>
              <p className="mb-2 mt-0.5 text-xs text-ink-muted">
                Check every slot that works for you.
              </p>
              <ul className="space-y-1.5">
                {pollSlots.map((slot) => {
                  const count = countFor(slot.id);
                  const mine = votes.some(
                    (v) => v.slot_id === slot.id && v.user_id === currentUserId,
                  );
                  const isBest = count > 0 && count === bestCount;
                  return (
                    <li
                      key={slot.id}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2 py-1.5",
                        isBest && "bg-gold-light/40",
                      )}
                    >
                      <Checkbox
                        checked={mine}
                        aria-label={`${format(new Date(slot.starts_at), "EEE MMM d, h:mm a")} works for me`}
                        onCheckedChange={async (checked) => {
                          const { error } = await voteAvailabilityAction(
                            slot.id,
                            groupId,
                            checked === true,
                          );
                          if (error) toast.error(error);
                          router.refresh();
                        }}
                      />
                      <span className="min-w-0 flex-1 text-sm text-ink">
                        {format(new Date(slot.starts_at), "EEE, MMM d · h:mm a")}
                        {" – "}
                        {format(new Date(slot.ends_at), "h:mm a")}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {pluralize(count, "vote")}
                      </span>
                      {isBest && (
                        <>
                          <Trophy aria-hidden className="h-3.5 w-3.5 text-gold" />
                          <MeetupFormDialog
                            groupId={groupId}
                            prefillStart={slot.starts_at}
                            trigger={
                              <Button size="sm" variant="secondary">
                                Schedule
                              </Button>
                            }
                          />
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}

/**
 * The "new poll" dialog: title + a growing list of local datetime slots
 * (each slot = start + duration). Slots convert to UTC ISO on submit,
 * same rule as meetups: the browser is the only place that knows the
 * student's timezone.
 */
function NewPollDialog({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState(createAvailabilityPollAction, {});
  const [open, setOpen] = React.useState(false);
  const [slotInputs, setSlotInputs] = React.useState<string[]>(["", ""]);
  const [durationMinutes, setDurationMinutes] = React.useState(60);
  const router = useRouter();

  React.useEffect(() => {
    if (state.success && open) {
      toast.success(state.success);
      setOpen(false);
      setSlotInputs(["", ""]);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacting to action completion
  }, [state]);

  function updateSlot(index: number, value: string) {
    setSlotInputs((current) => current.map((s, i) => (i === index ? value : s)));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ListPlus aria-hidden className="h-4 w-4" />
          New poll
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Find a time that works</DialogTitle>
        <DialogDescription>
          Propose {POLL_SLOTS_MIN}–{POLL_SLOTS_MAX} time options; the group votes on
          which ones work.
        </DialogDescription>

        <form
          action={(formData) => {
            // Local wall-clock inputs → UTC slots (start + chosen length).
            const slotsJson = slotInputs
              .filter(Boolean)
              .map((local) => {
                const start = new Date(local);
                const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
                return { starts_at: start.toISOString(), ends_at: end.toISOString() };
              });
            formData.set("slots", JSON.stringify(slotsJson));
            formAction(formData);
          }}
          noValidate
          className="mt-4 space-y-4"
        >
          <input type="hidden" name="group_id" value={groupId} />

          <div>
            <Label htmlFor="poll-title">What&rsquo;s it for?</Label>
            <Input
              id="poll-title"
              name="title"
              maxLength={100}
              placeholder="Midterm review session"
              required
              aria-invalid={!!state.fieldErrors?.title}
              aria-describedby="poll-title-error"
            />
            <FieldError id="poll-title-error" error={state.fieldErrors?.title} />
          </div>

          <div>
            <Label htmlFor="poll-duration">Session length</Label>
            <select
              id="poll-duration"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-gold"
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium text-ink">
              Time options (your local time)
            </legend>
            <div className="space-y-2">
              {slotInputs.map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="datetime-local"
                    value={value}
                    onChange={(e) => updateSlot(index, e.target.value)}
                    aria-label={`Time option ${index + 1}`}
                  />
                  {slotInputs.length > POLL_SLOTS_MIN && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 shrink-0 text-ink-muted hover:text-danger"
                      aria-label={`Remove time option ${index + 1}`}
                      onClick={() =>
                        setSlotInputs((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {slotInputs.length < POLL_SLOTS_MAX && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={() => setSlotInputs((current) => [...current, ""])}
              >
                <Plus aria-hidden className="h-3.5 w-3.5" />
                Add another option
              </Button>
            )}
            <FieldError error={state.fieldErrors?.slots} />
          </fieldset>

          {state.error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" loading={pending}>
            Open the poll
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
