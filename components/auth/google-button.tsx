/**
 * "Continue with UMN Google" — the SSO half of our two required sign-in
 * methods. Appears on both the login and register pages.
 *
 * It's a tiny form (not a link) because starting OAuth is a server action:
 * the server builds the Google URL with our hd=umn.edu hint and redirects.
 * The optional `next` prop carries where to land after sign-in.
 */
import { signInWithGoogleAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

/** Google's "G", drawn inline so we ship no external image. */
function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-6.9-5.1l-3.9 3C3.2 21.2 7.3 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.1 14.3c-.3-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3l-3.9-3C.4 8.3 0 10.1 0 12s.4 3.7 1.2 5.3l3.9-3z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0 7.3 0 3.2 2.8 1.2 6.7l3.9 3c.9-3 3.7-5 6.9-5z"
      />
    </svg>
  );
}

export function GoogleButton({ next }: { next?: string }) {
  return (
    <form action={signInWithGoogleAction}>
      {next && <input type="hidden" name="next" value={next} />}
      <Button type="submit" variant="outline" className="w-full">
        <GoogleG />
        Continue with UMN Google
      </Button>
    </form>
  );
}

/** The "──── or ────" separator between the two sign-in methods. */
export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs uppercase tracking-wide text-ink-muted">or</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
