/**
 * The profile edit form. One deliberate behavior (spec §5.11): if a save
 * fails, everything you typed is STILL IN THE FORM — inputs are
 * uncontrolled with defaultValues and the page doesn't reload on error,
 * so nothing is lost and you can fix + retry without retyping.
 */
"use client";

import * as React from "react";
import { useActionState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { updateProfileAction } from "@/lib/actions/profile";
import {
  BIO_MAX_LENGTH,
  CLASS_STANDINGS,
  COLLEGES,
  DISPLAY_NAME_MAX,
  GRAD_YEAR_MAX,
  GRAD_YEAR_MIN,
  SOCIAL_LINKS_MAX,
} from "@/lib/constants";
import type { ProfileRow } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { checkAvatarFile } from "@/lib/validation/avatar";

export function ProfileForm({ profile }: { profile: ProfileRow }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, {});
  // Social links get add/remove rows; seeded from the saved list.
  const [links, setLinks] = React.useState<string[]>(
    profile.social_links.length > 0 ? profile.social_links : [],
  );
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  // Instant client-side verdict on the chosen file (size/type). The
  // server still re-checks; this just stops silent failures.
  const [avatarClientError, setAvatarClientError] = React.useState<string | null>(null);

  return (
    <Card>
      <CardContent>
        <h2 className="mb-4 font-display text-xl text-ink">The basics</h2>
        <form action={formAction} noValidate className="space-y-4">
          <div className="flex items-center gap-4">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img
                src={avatarPreview}
                alt="Preview of your new profile picture"
                className="h-16 w-16 rounded-full border border-line object-cover"
              />
            ) : (
              <Avatar src={profile.avatar_url} name={profile.display_name} size="xl" />
            )}
            <div className="flex-1">
              <Label htmlFor="avatar">Profile picture (JPEG/PNG, up to 5 MB)</Label>
              <Input
                id="avatar"
                name="avatar"
                type="file"
                accept="image/jpeg,image/png"
                className="h-auto py-2"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  const problem = checkAvatarFile(file);
                  setAvatarClientError(problem);
                  setAvatarPreview(file && !problem ? URL.createObjectURL(file) : null);
                }}
                aria-invalid={!!(avatarClientError || state.fieldErrors?.avatar)}
                aria-describedby="avatar-error"
              />
              <FieldError
                id="avatar-error"
                error={avatarClientError ?? state.fieldErrors?.avatar}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={profile.display_name ?? ""}
              maxLength={DISPLAY_NAME_MAX}
              required
              aria-invalid={!!state.fieldErrors?.display_name}
              aria-describedby="display_name-error"
            />
            <FieldError id="display_name-error" error={state.fieldErrors?.display_name} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="college">College</Label>
              <Select id="college" name="college" defaultValue={profile.college ?? ""}>
                <option value="">Prefer not to say</option>
                {COLLEGES.map((college) => (
                  <option key={college.value} value={college.value}>
                    {college.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="major">Major</Label>
              <Input
                id="major"
                name="major"
                defaultValue={profile.major ?? ""}
                maxLength={100}
                aria-invalid={!!state.fieldErrors?.major}
                aria-describedby="major-error"
              />
              <FieldError id="major-error" error={state.fieldErrors?.major} />
            </div>
            <div>
              <Label htmlFor="class_standing">Class standing</Label>
              <Select
                id="class_standing"
                name="class_standing"
                defaultValue={profile.class_standing ?? ""}
              >
                <option value="">Prefer not to say</option>
                {CLASS_STANDINGS.map((standing) => (
                  <option key={standing.value} value={standing.value}>
                    {standing.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="graduation_month">Graduation</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  id="graduation_month"
                  name="graduation_month"
                  defaultValue={profile.graduation_month ?? ""}
                  aria-label="Graduation month"
                >
                  <option value="">Month</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i, 1).toLocaleString("en-US", { month: "long" })}
                    </option>
                  ))}
                </Select>
                <Select
                  name="graduation_year"
                  defaultValue={profile.graduation_year ?? ""}
                  aria-label="Graduation year"
                >
                  <option value="">Year</option>
                  {Array.from(
                    { length: GRAD_YEAR_MAX - GRAD_YEAR_MIN + 1 },
                    (_, i) => GRAD_YEAR_MIN + i,
                  ).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </Select>
              </div>
              <FieldError error={state.fieldErrors?.graduation_year} />
            </div>
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              name="bio"
              className="placeholder:opacity-50"
              placeholder="Describe yourself, your interests, etc."
              defaultValue={profile.bio ?? ""}
              maxLength={BIO_MAX_LENGTH}
              rows={4}
              aria-invalid={!!state.fieldErrors?.bio}
              aria-describedby="bio-error"
            />
            <FieldError id="bio-error" error={state.fieldErrors?.bio} />
          </div>

          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium text-ink">
              Social links (up to {SOCIAL_LINKS_MAX})
            </legend>
            <div className="space-y-2">
              {links.map((link, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    className="placeholder:opacity-50"
                    name="social_links"
                    type="url"
                    defaultValue={link}
                    placeholder="https://instagram.com/JaneDoe"
                    aria-label={`Social link ${index + 1}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 text-ink-muted hover:text-danger"
                    aria-label={`Remove social link ${index + 1}`}
                    onClick={() =>
                      setLinks((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            {links.length < SOCIAL_LINKS_MAX && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={() => setLinks((current) => [...current, ""])}
              >
                <Plus aria-hidden className="h-3.5 w-3.5" />
                Add a link
              </Button>
            )}
            <FieldError error={state.fieldErrors?.social_links} />
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

          <Button type="submit" loading={pending} disabled={!!avatarClientError}>
            Save profile
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
