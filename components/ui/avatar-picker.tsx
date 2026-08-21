/**
 * Profile-picture picker: preview circle + a real "Upload photo" button.
 *
 * Replaces the old bare <input type="file"> styled as a text box, whose
 * only clickable part was the tiny native "Choose File" area. The actual
 * file input is hidden; the Button triggers it, so the whole button is
 * the hit target. The parent keeps ownership of the client-error state
 * (via onFileCheck) because it also uses it to disable its submit button.
 */
"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { checkAvatarFile } from "@/lib/validation/avatar";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";

export function AvatarPicker({
  label,
  currentUrl = null,
  fallbackName = null,
  error,
  onFileCheck,
}: {
  label: string;
  /** The saved avatar, shown until a new file is chosen. */
  currentUrl?: string | null;
  fallbackName?: string | null;
  /** Client or server error to display under the control. */
  error?: string | string[] | null;
  /** Reports the instant size/type verdict for the chosen file. */
  onFileCheck: (error: string | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img
            src={preview}
            alt="Preview of your chosen profile picture"
            className="h-16 w-16 shrink-0 rounded-full border border-line object-cover"
          />
        ) : (
          <Avatar src={currentUrl} name={fallbackName} size="xl" />
        )}
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            id="avatar"
            name="avatar"
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            aria-label={label}
            aria-invalid={!!error}
            aria-describedby="avatar-error"
            onChange={(e) => {
              const file = e.target.files?.[0];
              const problem = checkAvatarFile(file);
              onFileCheck(problem);
              setFileName(file?.name ?? null);
              setPreview(file && !problem ? URL.createObjectURL(file) : null);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <Upload aria-hidden className="h-4 w-4" />
            {fileName ? "Change photo" : "Upload photo"}
          </Button>
          <p className="mt-1 truncate text-xs text-ink-muted">
            {fileName ?? "JPEG or PNG, up to 5 MB."}
          </p>
          <FieldError id="avatar-error" error={error} />
        </div>
      </div>
    </div>
  );
}
