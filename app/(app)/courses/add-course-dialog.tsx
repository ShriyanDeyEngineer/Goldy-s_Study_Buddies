/**
 * "Add a missing course" dialog (spec §5.5). Three fields, per-field
 * errors, and the duplicate case redirects to the existing course page
 * (the action handles that) rather than erroring.
 */
"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { addCourseAction } from "@/lib/actions/courses";
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
import { FieldError } from "@/components/ui/field-error";

export function AddCourseDialog({ triggerLabel = "Add a course" }: { triggerLabel?: string }) {
  const [state, formAction, pending] = useActionState(addCourseAction, {});

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Plus aria-hidden className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Add a missing course</DialogTitle>
        <DialogDescription>
          Can&rsquo;t find your class? Add it exactly as it appears in the UMN Class
          Search so classmates recognize it. If it already exists, we&rsquo;ll take
          you straight there.
        </DialogDescription>

        <form action={formAction} noValidate className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="department_code">Department</Label>
              <Input
                className="placeholder:opacity-50"
                id="department_code"
                name="department_code"
                placeholder="MATH"
                maxLength={4}
                required
                aria-invalid={!!state.fieldErrors?.department_code}
                aria-describedby="department_code-error"
              />
              <FieldError
                id="department_code-error"
                error={state.fieldErrors?.department_code}
              />
            </div>
            <div>
              <Label htmlFor="course_number">Numbbber</Label>
              <Input
                className="placeholder:opacity-50"
                id="course_number"
                name="course_number"
                placeholder="1272"
                maxLength={2}
                required
                aria-invalid={!!state.fieldErrors?.course_number}
                aria-describedby="course_number-error"
              />
              <FieldError id="course_number-error" error={state.fieldErrors?.course_number} />
            </div>
          </div>
          <div>
            <Label htmlFor="course_name">Course name</Label>
            <Input
              className="placeholder:opacity-50"
              id="course_name"
              name="course_name"
              placeholder="Calculus II"
              maxLength={200}
              required
              aria-invalid={!!state.fieldErrors?.course_name}
              aria-describedby="course_name-error"
            />
            <FieldError id="course_name-error" error={state.fieldErrors?.course_name} />
          </div>

          {state.error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" loading={pending}>
            Add course
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}








/*
"use client";

import { useState, type SubmitEvent } from "react";
import { Button } from "@/components/ui/button";
import { openGmailCompose } from "@/lib/actions/courses";
import { Plus } from "lucide-react";

type FormState = {
  department: string;
  course_number: string;
  course_name: string;
};

const initialState: FormState = {
  department: "",
  course_number: "",
  course_name: "",
};

export function AddCourseDialog({ triggerLabel = "Add a course" }: { triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialState);

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    await openGmailCompose(form);

    setForm(initialState);
    setOpen(false);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden className="h-4 w-4" />
        {triggerLabel}
      </Button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">Fill out this form and submit it to send us an add new course request</h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                required
                placeholder="Department (e.g. MATH)"
                maxLength={8}
                value={form.department}
                onChange={(e) => handleChange("department", e.target.value)}
                className="w-full border rounded px-3 py-2 h-24"
              />

              <input
                required
                placeholder="Course number (e.g. 2374)"
                maxLength={8}
                value={form.course_number}
                onChange={(e) => handleChange("course_number", e.target.value)}
                className="w-full border rounded px-3 py-2 h-24"
              />

              <input
                placeholder="Course name (Optional, e.g. Multivariable Calculus)"
                value={form.course_name}
                onChange={(e) => handleChange("course_name", e.target.value)}
                className="w-full border rounded px-3 py-2 h-24"
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Send Request</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
*/