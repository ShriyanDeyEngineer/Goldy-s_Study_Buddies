/**
 * Profile server actions: finishing onboarding, editing the profile,
 * privacy flags, the study-buddy toggle, course-list management, and the
 * avatar upload rules.
 *
 * The avatar upload is the one with teeth (spec §5.11): JPEG or PNG, max
 * 5 MB, and the type check reads the FILE'S ACTUAL BYTES — a .png
 * extension on a renamed .exe fails here. The storage bucket enforces the
 * same limits again underneath us.
 */
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema, privacySchema, profileSchema } from "@/lib/validation/profile";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/actions/types";

const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const AVATAR_ERROR =
  "Profile pictures must be a JPEG or PNG up to 5 MB.";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True if the bytes really are JPEG or PNG. Extensions and the browser-
 * reported content type are user-controlled; the first bytes of the file
 * are not. JPEG starts FF D8 FF; PNG starts 89 50 4E 47 0D 0A 1A 0A.
 */
function sniffImageType(bytes: Uint8Array): "jpeg" | "png" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && pngMagic.every((b, i) => bytes[i] === b)) {
    return "png";
  }
  return null;
}

/**
 * Validates + uploads an avatar, returning its public URL.
 * Returns {error} instead of throwing so form actions can surface it
 * inline. A zero-byte file means "no file chosen" and resolves to null.
 */
async function uploadAvatar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  file: File | null,
): Promise<{ url: string | null; error?: string }> {
  if (!file || file.size === 0) return { url: null };
  if (file.size > AVATAR_MAX_BYTES) return { url: null, error: AVATAR_ERROR };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImageType(bytes);
  if (!kind) return { url: null, error: AVATAR_ERROR };

  // Timestamped name (not a fixed "avatar.png"): a new upload is a new URL,
  // so the file at any given URL never changes. That immutability is what
  // lets us set a one-year immutable cache-control below — without it,
  // Storage's 1-hour default meant every avatar in every list/chat
  // re-validated against Storage each hour for no reason.
  const path = `${userId}/avatar-${Date.now()}.${kind === "jpeg" ? "jpg" : "png"}`;
  const { error } = await supabase.storage.from("avatars").upload(path, bytes, {
    contentType: kind === "jpeg" ? "image/jpeg" : "image/png",
    cacheControl: "31536000, immutable",
    upsert: true,
  });
  if (error) return { url: null, error: friendlyError(error) };

  // The timestamped names mean every re-upload used to leave the previous
  // file behind forever. Sweep the folder down to the file we just wrote.
  // Best-effort: a leftover breaks nothing (only the newest URL is ever
  // referenced), so a failed sweep must not fail the save.
  const { data: existing } = await supabase.storage.from("avatars").list(userId);
  const stale = (existing ?? [])
    .map((file) => `${userId}/${file.name}`)
    .filter((filePath) => filePath !== path);
  if (stale.length > 0) {
    await supabase.storage.from("avatars").remove(stale);
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return { url: data.publicUrl };
}

/** Shared FormData → object plumbing for the profile schemas. */
function profileFields(formData: FormData) {
  return {
    display_name: formData.get("display_name"),
    college: formData.get("college"),
    major: formData.get("major"),
    class_standing: formData.get("class_standing"),
    graduation_month: formData.get("graduation_month"),
    graduation_year: formData.get("graduation_year"),
    // Consumed by onboardingSchema only; profileSchema strips it.
    sex: formData.get("sex"),
  };
}

/**
 * Onboarding's single submit (spec §5.3). Everything lands in one action
 * on the final step, which is what makes the wizard refresh-safe: until
 * you press Finish nothing is saved, and after it your display_name
 * exists and the app opens up. Re-submitting just overwrites — no
 * half-done state to corrupt.
 */
export async function saveOnboardingAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = onboardingSchema.safeParse(profileFields(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const bio = String(formData.get("bio") ?? "").trim();
  if (bio.length > 500) {
    return { fieldErrors: { bio: ["Bios max out at 500 characters."] } };
  }

  const avatar = await uploadAvatar(
    supabase,
    user.id,
    formData.get("avatar") as File | null,
  );
  if (avatar.error) {
    return { fieldErrors: { avatar: [avatar.error] } };
  }

  // Sex is not a profiles-grant column — the ONLY write path is the
  // set_sex() function, which also enforces the once-chosen lock.
  const { sex, ...profileData } = parsed.data;
  const { error: sexError } = await supabase.rpc("set_sex", { p_sex: sex });
  if (sexError) {
    return { fieldErrors: { sex: [friendlyError(sexError)] } };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      ...profileData,
      bio: bio || null,
      ...(avatar.url ? { avatar_url: avatar.url } : {}),
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) return { error: friendlyError(error) };

  // Selected current courses (skippable step). Ids come from our own
  // checkbox list, but validate the shape anyway — never trust the form.
  const courseIds = formData
    .getAll("course_ids")
    .map(String)
    .filter((id) => UUID_RE.test(id));
  if (courseIds.length > 0) {
    await supabase.from("user_courses").upsert(
      courseIds.map((course_id) => ({
        user_id: user.id,
        course_id,
        enrollment_type: "current" as const,
      })),
      { ignoreDuplicates: true },
    );
  }

  redirect("/dashboard");
}

/** The profile edit form (settings). Same fields as onboarding plus bio +
 *  social links; avatar handled in the same submit. */
export async function updateProfileAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const socialLinks = formData
    .getAll("social_links")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const parsed = profileSchema.safeParse({
    ...profileFields(formData),
    bio: formData.get("bio"),
    social_links: socialLinks,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const avatar = await uploadAvatar(
    supabase,
    user.id,
    formData.get("avatar") as File | null,
  );
  if (avatar.error) {
    return { fieldErrors: { avatar: [avatar.error] } };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      ...parsed.data,
      ...(avatar.url ? { avatar_url: avatar.url } : {}),
    })
    .eq("id", user.id);
  if (error) return { error: friendlyError(error) };

  revalidatePath("/settings/profile");
  revalidatePath(`/profile/${user.id}`);
  return { success: "Profile saved." };
}

/** Privacy switches save independently of the profile form so flipping
 *  one can never be lost to an unrelated validation error. */
export async function updatePrivacyAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("privacy") ?? "{}"));
  } catch {
    return { error: "Something went wrong saving your privacy settings." };
  }
  const parsed = privacySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Something went wrong saving your privacy settings." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ privacy: parsed.data })
    .eq("id", user.id);
  if (error) return { error: friendlyError(error) };

  revalidatePath("/settings/profile");
  return { success: "Privacy updated." };
}

export async function setBuddyAvailabilityAction(available: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase
    .from("profiles")
    .update({ is_available_for_buddies: available })
    .eq("id", user.id);
  revalidatePath("/people");
  revalidatePath("/settings/profile");
}

/** The "email me about group & friend activity" switch (bug report #9).
 *  Only affects the notification-email webhook; in-app notifications
 *  always arrive. */
export async function setEmailNotificationsAction(enabled: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase
    .from("profiles")
    .update({ email_notifications: enabled })
    .eq("id", user.id);
  revalidatePath("/settings/profile");
}

/** Add/remove a course on one of the three lists (current/taken/future). */
export async function setCourseEnrollmentAction(
  courseId: string,
  enrollmentType: "current" | "taken" | "future",
  enrolled: boolean,
): Promise<ActionResult> {
  if (!UUID_RE.test(courseId)) return { error: "Something went wrong." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (enrolled) {
    const { error } = await supabase.from("user_courses").upsert(
      { user_id: user.id, course_id: courseId, enrollment_type: enrollmentType },
      { ignoreDuplicates: true },
    );
    if (error) return { error: friendlyError(error) };
  } else {
    const { error } = await supabase
      .from("user_courses")
      .delete()
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .eq("enrollment_type", enrollmentType);
    if (error) return { error: friendlyError(error) };
  }
  revalidatePath("/settings/courses");
  revalidatePath("/dashboard");
  return {};
}

/**
 * Self-service account deletion (migration 0014). The database function
 * leaves every group (succession/disband included), severs the social
 * graph, and scrubs the profile to "Unknown" — old chats keep their
 * messages. On success: sign out and land on the marketing home.
 */
export async function deleteAccountAction(): Promise<{ error?: string }> {
  const supabase = await createClient();

  // Avatar cleanup happens HERE, not in SQL: the database function's owner
  // has no privileges on the storage schema (migration 0015), but the
  // user's own session may delete files in their own folder (0009
  // policies) — and the storage API removes the actual bytes. Best-effort:
  // a leftover file references nothing once the profile is scrubbed.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: files } = await supabase.storage.from("avatars").list(user.id);
    if (files?.length) {
      await supabase.storage
        .from("avatars")
        .remove(files.map((f) => `${user.id}/${f.name}`));
    }
  }

  const { error } = await supabase.rpc("delete_account");
  if (error) return { error: friendlyError(error) };
  // Local scope: the RPC deleted the auth user, so the server-side
  // session is already gone — this just clears the cookies.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
