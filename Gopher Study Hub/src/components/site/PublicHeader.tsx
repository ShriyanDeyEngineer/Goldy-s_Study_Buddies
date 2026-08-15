import { Link } from "@tanstack/react-router";
import { Wordmark } from "./Logo";
import { Button } from "@/components/ui/button";

const LINKS = [
  { to: "/about", label: "About us" },
  { to: "/why", label: "Why use it" },
  { to: "/testimonials", label: "Testimonials" },
] as const;

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="Goldy's Study Buddies home">
            <Wordmark />
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-6">
          <nav aria-label="Main" className="flex items-center gap-4 text-sm">
            {LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-ink-muted transition-colors hover:text-maroon"
                activeProps={{ className: "text-maroon font-medium" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="text-maroon">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/auth" search={{ mode: "register" }}>
                Sign up
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
