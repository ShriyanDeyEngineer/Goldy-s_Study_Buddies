/**
 * Form field label. Always associate it with its control via htmlFor —
 * that is what makes clicking the label focus the field, and what screen
 * readers read out. Accessibility requires every visible form control to
 * have one of these (or an aria-label for icon-only controls).
 */
"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn("mb-1.5 block text-sm font-medium text-ink", className)}
      {...props}
    />
  );
});
