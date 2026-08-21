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
      {/* head */}
      <circle cx="20" cy="20" r="9" />
      {/* eyes, looking down toward the shared book */}
      <circle cx="18.5" cy="21" r="1" fill="#fff" />
      <circle cx="24" cy="21" r="1" fill="#fff" />
      
      {/* body */}
      <path d="M 9 46 C 9 34 14 28 20 28 C 26 28 31 34 31 46 Z" />
      
      {/* pencil, held at the student's side with a gap, pointing up and outward */}
      <g transform="translate(6 37) rotate(-125)">
        <rect x="0" y="-0.6" width="8" height="1.2" rx="0.6" />
        <path d="M 8 -0.6 L 10 0 L 8 0.6 Z" />
        <rect x="0" y="-0.6" width="1.2" height="1.2" fill="#fff" fillOpacity="0.6" />
      </g>


      {/* ===== right student ===== */}
      {/* head */}
      <circle cx="44" cy="20" r="9" />
      {/* eyes, looking down toward the shared book */}
      <circle cx="40" cy="21" r="1" fill="#fff" />
      <circle cx="45.5" cy="21" r="1" fill="#fff" />
      
      {/* body */}
      <path d="M 33 46 C 33 34 38 28 44 28 C 50 28 55 34 55 46 Z" />
      
      {/* pencil, held at the student's side with a gap, pointing up and outward */}
      <g transform="translate(57 37) rotate(-55)">
        <rect x="0" y="-0.6" width="8" height="1.2" rx="0.6" />
        <path d="M 8 -0.6 L 10 0 L 8 0.6 Z" />
        <rect x="0" y="-0.6" width="1.2" height="1.2" fill="#fff" fillOpacity="0.6" />
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
      <GopherLogo className={cn("h-7 w-7", dark ? "text-gold" : "text-maroon")} />
      <span>
        <span className={dark ? "text-gold" : ""}>Goldy&rsquo;s Study Buddies</span>
      </span>
    </span>
  );
}
