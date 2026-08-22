/** 
 * "Add a missing course" dialog (spec §5.5). Three fields, per-field
 * Once the "Add a Course" button is clicked, user fills out form, submits
 * then is redirected to gmail to review and send their request to our team email
 */

"use client";

import { useState, type SubmitEvent } from "react";
import { Button } from "@/components/ui/button";
import { openGmailCompose } from "@/lib/actions/courses";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


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
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Plus aria-hidden className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Add a Missing UMN Course</DialogTitle>
        <DialogDescription>
          Can&rsquo;t find a course even with the search filters? Submit a "Course Request." We will review your request and then
          let you know through email if the course has been validated and added. Please email us back if you still don't see the added course. 
          If the course you have submited is not a real UMN course or it is already present in the course catalog, we will notify you. 
          <br></br>
          <br></br>
          Once you fill out this form and click the submit button below, you will be redirected to Gmail where you can review your request and then
          simply hit the send button. You will recieve a response within a week.
        </DialogDescription>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">          
            <div>
              <Label htmlFor="department_code"><strong>Department</strong></Label>
              <Input
                required
                placeholder="MATH"
                className="placeholder:opacity-50"
                maxLength={4}
                value={form.department}
                onChange={(e) => handleChange("department", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="course_number"><strong>Course Number</strong></Label>
              <Input
                required
                placeholder="2374"
                className="placeholder:opacity-50"
                maxLength={5}
                value={form.course_number}
                onChange={(e) => handleChange("course_number", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="course_name"><strong>Course Name &#40;Optional&#41;</strong></Label>
            <Input
                placeholder="Multivariable Calculus"
                className="placeholder:opacity-50"
                maxLength={200}
                value={form.course_name}
                onChange={(e) => handleChange("course_name", e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full">
            Submit Course Request!
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}