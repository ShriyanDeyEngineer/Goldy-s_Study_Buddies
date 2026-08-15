/**
 * The Goldy's Study Buddies logo — an ORIGINAL, hand-drawn gopher
 * silhouette. This is deliberately NOT the official Goldy Gopher mascot or
 * any University of Minnesota trademark; we are legally required to avoid
 * those, so please never "improve" this by pasting in real UMN artwork.
 *
 * Used in the public header, the app header, and the footer. Size it with
 * the className prop (it scales like any inline SVG).
 */
import { cn } from "@/lib/utils";

/**
 * A simple friendly gopher: round head, two ears, cheeks, and the classic
 * pair of front teeth. Drawn as flat shapes so it stays crisp at 24px.
 * currentColor lets the parent choose the color (maroon on light
 * backgrounds, gold/white on maroon).
 */
export function GopherLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
      fill="currentColor"
    >
      {/* ears */}
      <circle cx="18" cy="14" r="8" />
      <circle cx="46" cy="14" r="8" />
      {/* head */}
      <ellipse cx="32" cy="34" rx="22" ry="21" />
      {/* cheeks — cut out of the head in the page background color is
          overkill; instead we draw lighter shapes on top via fill-opacity */}
      <ellipse cx="22" cy="40" rx="7" ry="6" fill="#fff" fillOpacity="0.25" />
      <ellipse cx="42" cy="40" rx="7" ry="6" fill="#fff" fillOpacity="0.25" />
      {/* the two front teeth, the universal gopher signifier */}
      <rect x="26.5" y="44" width="5" height="9" rx="1.5" fill="#fff" />
      <rect x="32.5" y="44" width="5" height="9" rx="1.5" fill="#fff" />
      {/* nose */}
      <ellipse cx="32" cy="40" rx="4" ry="3" fill="#fff" fillOpacity="0.9" />
    </svg>
  );
}

/**
 * Logo + wordmark lockup used in headers. The `dark` variant is for maroon
 * backgrounds (white text, gold gopher); the default is for light
 * backgrounds (maroon text and gopher).
 */
export function LogoLockup({
  dark = false,
  className,
}: {
  dark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-display text-xl leading-none",
        dark ? "text-white" : "text-maroon",
        className,
      )}
    >
      <GopherLogo className={cn("h-7 w-7", dark ? "text-gold" : "text-maroon")} />
      <span>
        Goldy&rsquo;s <span className={dark ? "text-gold" : ""}>Study Buddies</span>
      </span>
    </span>
  );
}
