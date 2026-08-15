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
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  return "http://localhost:3000";
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
