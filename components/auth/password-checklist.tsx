/**
 * The live password checklist on the registration and reset forms
 * (spec §5.2): every policy rule listed, each one flipping to green the
 * moment the password satisfies it.
 *
 * Renders straight from checkPassword() — the same rule list the server
 * validates with, so the checklist can never disagree with submission.
 */
"use client";

import { Check, X } from "lucide-react";
import { checkPassword } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

export function PasswordChecklist({ password }: { password: string }) {
  const results = checkPassword(password);
  return (
    <ul className="mt-2 space-y-1" aria-label="Password requirements">
      {results.map((rule) => (
        <li
          key={rule.id}
          className={cn(
            "flex items-center gap-2 text-xs",
            rule.passed ? "text-success" : "text-ink-muted",
          )}
        >
          {rule.passed ? (
            <Check aria-hidden className="h-3.5 w-3.5" />
          ) : (
            <X aria-hidden className="h-3.5 w-3.5" />
          )}
          {/* Screen readers get the state in words, not just color/icon. */}
          <span>
            {rule.label}
            <span className="sr-only">{rule.passed ? " — met" : " — not met yet"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
