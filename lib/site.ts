/**
 * The app's own public URL — used to build auth redirect links (email
 * confirmations, OAuth callbacks) that must point back at us.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL (set this in production — see .env.example)
 *   2. Vercel's auto-provided deployment URL (covers preview deploys)
 *   3. localhost, for `npm run dev` with no env at all
 */
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return normalizeOrigin(process.env.NEXT_PUBLIC_VERCEL_URL);
  }
  return "http://localhost:3000";
}

/**
 * Cleans up a hand-entered origin so a small typo can't break sign-in.
 *
 * WHY THIS EXISTS (learned the hard way): NEXT_PUBLIC_SITE_URL is typed
 * into a dashboard by a human, and "goldy-s-study-buddies.vercel.app"
 * (no scheme) is an easy thing to paste. Without a scheme the OAuth
 * redirect_to we build is not a valid absolute URL, so Supabase rejects
 * it, silently falls back to its own Site URL, and the student lands on
 * the homepage holding an unusable ?code= — with no error anywhere.
 *
 * So: strip whitespace and any trailing slash, and add https:// when the
 * scheme is missing (http:// for localhost, which has no certificate).
 */
export function normalizeOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed);
  return `${isLocal ? "http" : "https"}://${trimmed}`;
}

/**
 * Only allow redirect targets INSIDE our app. Auth flows carry a ?next=
 * param telling us where to land after login; if we redirected to
 * whatever that says, a crafted link could bounce a student's fresh
 * session to a hostile site ("open redirect"). Internal paths only.
 */
export function safeInternalPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return fallback;
  }
  return next;
}
