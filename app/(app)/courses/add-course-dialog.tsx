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
                id="department_code"
                name="department_code"
                placeholder="CSCI"
                maxLength={8}
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
              <Label htmlFor="course_number">Number</Label>
              <Input
                id="course_number"
                name="course_number"
                placeholder="1133"
                maxLength={7}
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
              id="course_name"
              name="course_name"
              placeholder="Introduction to Computing and Programming Concepts"
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
