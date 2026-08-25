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
 * Icon depicting two students collaborating/studying together,
 * seated at a shared table with an open book between them and pencils at their sides.
 */
export function GopherLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
      fill="currentColor"
    >
      {/* table */}
      <rect x="8" y="46" width="48" height="5" rx="2" />

      {/* ===== left student ===== */}
      {/* head — a clean silhouette, no facial features */}
      <circle cx="20" cy="20" r="9" />
      
      {/* body */}
      <path d="M 9 46 C 9 34 14 28 20 28 C 26 28 31 34 31 46 Z" />
      
      {/* pencil beside the student — sized like a real pencil in hand */}
      <g transform="translate(6.5 45) rotate(-105)">
        <rect x="0" y="-1.2" width="12" height="2.4" rx="1" />
        <path d="M 12 -1.2 L 15.2 0 L 12 1.2 Z" />
        <rect x="0" y="-1.2" width="1.8" height="2.4" fill="#fff" fillOpacity="0.6" />
      </g>


      {/* ===== right student ===== */}
      {/* head — a clean silhouette, no facial features */}
      <circle cx="44" cy="20" r="9" />
      
      {/* body */}
      <path d="M 33 46 C 33 34 38 28 44 28 C 50 28 55 34 55 46 Z" />
      
      {/* pencil beside the student — mirrored */}
      <g transform="translate(57.5 45) rotate(-75)">
        <rect x="0" y="-1.2" width="12" height="2.4" rx="1" />
        <path d="M 12 -1.2 L 15.2 0 L 12 1.2 Z" />
        <rect x="0" y="-1.2" width="1.8" height="2.4" fill="#fff" fillOpacity="0.6" />
      </g>


      {/* ===== shared open book on the table ===== */}
      <path
        d="M 32 47.5 L 20 43.5 L 20 39 L 32 42 L 44 39 L 44 43.5 Z"
        fill="#fff"
        fillOpacity="0.9"
      />
      {/* spine crease */}
      <line
        x1="32"
        y1="47.5"
        x2="32"
        y2="42"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.3"
      />
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
      <GopherLogo className={cn("h-[1.35em] w-[1.35em]", dark ? "text-gold" : "text-maroon")} />
      <span>
        <span className={dark ? "text-gold" : ""}>Goldy&rsquo;s Study Buddies</span>
      </span>
    </span>
  );
}
