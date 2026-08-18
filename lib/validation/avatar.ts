/**
 * Client-side pre-check for a chosen profile picture, so an oversized or
 * wrong-type file gets an instant, specific message instead of a silent
 * failed save. The SERVER (lib/actions/profile.ts) re-validates the real
 * bytes — this is only the friendly early warning.
 *
 * Why it exists (bug report #6): the browser happily let a 4 MB photo
 * through, the request died at the framework's body limit before our
 * code ran, and the student saw nothing at all. Now they see the reason
 * the moment they pick the file.
 */

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_ACCEPTED_TYPES = ["image/jpeg", "image/png"] as const;

/** Returns an error sentence, or null if the file is acceptable. */
export function checkAvatarFile(file: File | null | undefined): string | null {
  if (!file) return null;
  if (!(AVATAR_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "Profile pictures must be JPEG or PNG.";
  }
  if (file.size > AVATAR_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `That image is ${mb} MB — the limit is 5 MB. Try a smaller photo or a screenshot of it.`;
  }
  return null;
}
