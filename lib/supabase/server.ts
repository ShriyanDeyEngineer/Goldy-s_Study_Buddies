/**
 * Supabase client for SERVER code: Server Components, Server Actions, and
 * Route Handlers.
 *
 * Reads the user's session from request cookies, so every query runs AS
 * THAT USER and row-level security applies. This is the client used for
 * ~all reads and for calling our database functions.
 *
 * The try/catch around setAll looks odd but is the documented pattern:
 * Server COMPONENTS aren't allowed to write cookies (only actions and
 * routes are), and the middleware refreshes sessions anyway, so
 * swallowing that specific failure is correct — do not "fix" it.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore, middleware
            // handles session refresh.
          }
        },
      },
    },
  );
}

/**
 * Convenience for pages that need the signed-in user's id + profile in one
 * call. Returns nulls when signed out — callers decide whether that means
 * "redirect to login" or "render the public view".
 */
export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { supabase, user, profile };
}
