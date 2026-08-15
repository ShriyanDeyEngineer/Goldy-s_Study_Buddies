/**
 * Session refresh + route protection, run by middleware.ts on every
 * request (spec §5.2: "sessions are cookie-based and refreshed by
 * middleware on every request").
 *
 * What happens here:
 *   1. Re-create the Supabase client against this request's cookies and
 *      call getUser() — that call is what refreshes an expiring session
 *      token and writes the fresh cookie onto the response.
 *   2. Signed-OUT users asking for app pages → sent to /login (with a
 *      `next` param so they land where they meant to go after signing in).
 *   3. Signed-IN users visiting login/register → sent to /dashboard;
 *      there is nothing for them on those pages.
 *
 * What deliberately does NOT happen here: onboarding and suspension
 * checks. Those need a profiles query, and running one on literally every
 * request (including prefetches) would double our database load — the
 * app layout does them instead, once per page render.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Path prefixes that require a signed-in user. Everything else (marketing,
 *  auth pages, auth callbacks) is public. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/courses",
  "/groups",
  "/people",
  "/profile",
  "/messages",
  "/notifications",
  "/settings",
];

/** Signed-in users get bounced OFF these (already signed in = nothing to do). */
const AUTH_PAGES = ["/login", "/register"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: keep this between client creation and the redirect logic.
  // getUser() validates the token against Supabase (not just decoding it)
  // and performs the refresh — removing it breaks session renewal.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Send them back where they were headed after login.
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PAGES.some((p) => path === p)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
