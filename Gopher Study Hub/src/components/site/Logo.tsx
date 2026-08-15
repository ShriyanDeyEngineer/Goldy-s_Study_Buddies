interface LogoProps {
  className?: string;
  /** Original gopher silhouette — not a university trademark. */
  title?: string;
}

export function GopherMark({ className = "h-8 w-8", title = "Goldy's Study Buddies" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={title}
      fill="currentColor"
    >
      <path d="M32 6c-4.4 0-8 3.3-8 7.4 0 1 .2 2 .6 2.9C19.4 19.2 16 24.6 16 30.9c0 9.4 7.2 17.1 16 17.1s16-7.7 16-17.1c0-6.3-3.4-11.7-8.6-14.6.4-.9.6-1.9.6-2.9C40 9.3 36.4 6 32 6zm-9.2 9.6a4.6 4.6 0 1 1 9.2 0 4.6 4.6 0 0 1-9.2 0z" />
      <circle cx="25" cy="30" r="2.6" />
      <circle cx="39" cy="30" r="2.6" />
      <path d="M32 34.5c-2.2 0-4 1.5-4 3.3 0 1.3.9 2.4 2.2 2.9v3.1c0 .6.5 1.1 1.1 1.1h1.4c.6 0 1.1-.5 1.1-1.1v-3.1c1.3-.5 2.2-1.6 2.2-2.9 0-1.8-1.8-3.3-4-3.3z" />
      <path d="M22 50c-3.9 1.6-6.6 5-7 9.1-.1.9.6 1.7 1.5 1.7h31c.9 0 1.6-.8 1.5-1.7-.4-4.1-3.1-7.5-7-9.1-2.7 2-6 3.2-10 3.2s-7.3-1.2-10-3.2z" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <GopherMark className="h-8 w-8 text-maroon" />
      <span className="font-display text-xl leading-none text-maroon">
        Goldy&apos;s Study Buddies
      </span>
    </span>
  );
}
