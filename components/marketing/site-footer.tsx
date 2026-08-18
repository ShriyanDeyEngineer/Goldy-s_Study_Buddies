/**
 * Site footer — page links, the team, contact, and the affiliation
 * disclaimer the spec requires on every page. Maroon-dark background per
 * the design system (gold/white text both clear WCAG AA on it).
 */
import Link from "next/link";
import { LogoLockup } from "@/components/gopher-logo";

/* The five of us. TEAM: swap in a real shared inbox before launch —
   the placeholder below is deliberately not a routable address. */
const TEAM = ["Shriyan Dey", "Angad Virdi", "Aadi Sharma", "Joy Deng"];
const CONTACT_EMAIL = "goldysstudybuddies@gmail.com";

export function SiteFooter() {
  return (
    <footer className="bg-maroon-dark text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-3">
        <div>
          <LogoLockup dark />
          <p className="mt-3 text-sm text-white/70">
            Find your study buddies!
          </p>
        </div>

        <nav aria-label="Footer" className="text-sm">
          <h2 className="mb-3 font-medium text-gold">Pages</h2>
          <ul className="space-y-2">
            <li><Link href="/" className="text-white/80 hover:text-gold">Home</Link></li>
            <li><Link href="/about" className="text-white/80 hover:text-gold">About us</Link></li>
            <li><Link href="/why" className="text-white/80 hover:text-gold">Why use it</Link></li>
            <li><Link href="/testimonials" className="text-white/80 hover:text-gold">Testimonials</Link></li>
            <li><Link href="/register" className="text-white/80 hover:text-gold">Sign up</Link></li>
          </ul>
        </nav>

        <div className="text-sm">
          <h2 className="mb-3 font-medium text-gold">The team</h2>
          <p className="text-white/80">{TEAM.join(" · ")}</p>
          <p className="mt-3">
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-white/80 underline underline-offset-2 hover:text-gold">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/60">
        Built by UMN students, for UMN students. Not officially affiliated with the
        University of Minnesota. Please send any feedback or report any issues to the email provided above.
      </div>
    </footer>
  );
}
