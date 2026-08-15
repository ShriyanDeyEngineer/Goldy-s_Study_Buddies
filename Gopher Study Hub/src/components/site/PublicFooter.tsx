import { Link } from "@tanstack/react-router";
import { GopherMark } from "./Logo";

export function PublicFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-maroon-dark text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <span className="flex items-center gap-2">
            <GopherMark className="h-7 w-7 text-gold" />
            <span className="font-display text-lg text-gold">Goldy&apos;s Study Buddies</span>
          </span>
          <p className="mt-3 max-w-xs text-sm text-white/80">
            Made by students who got tired of studying alone in Walter at 11pm.
          </p>
        </div>
        <nav aria-label="Footer" className="text-sm">
          <h2 className="font-display text-base text-gold">Pages</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <Link to="/" className="text-white/80 hover:text-gold">
                Home
              </Link>
            </li>
            <li>
              <Link to="/about" className="text-white/80 hover:text-gold">
                About us
              </Link>
            </li>
            <li>
              <Link to="/why" className="text-white/80 hover:text-gold">
                Why use it
              </Link>
            </li>
            <li>
              <Link to="/testimonials" className="text-white/80 hover:text-gold">
                Testimonials
              </Link>
            </li>
          </ul>
        </nav>
        <div className="text-sm">
          <h2 className="font-display text-base text-gold">Reach the team</h2>
          <ul className="mt-3 space-y-2 text-white/80">
            <li>
              <a className="hover:text-gold" href="mailto:hello@goldystudybuddies.org">
                hello@goldystudybuddies.org
              </a>
            </li>
            <li>
              <a className="hover:text-gold" href="mailto:support@goldystudybuddies.org">
                support@goldystudybuddies.org
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15 px-4 py-4 text-center text-xs text-white/70">
        Not officially affiliated with the University of Minnesota.
      </div>
    </footer>
  );
}
