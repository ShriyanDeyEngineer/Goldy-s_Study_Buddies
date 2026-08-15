/**
 * Supabase ADMIN client — uses the service-role key, which BYPASSES all
 * row-level security. Treat it like a root password.
 *
 * Rules (non-negotiable):
 *   - Only import this from server-only code paths. The `server-only`
 *     import below makes the build FAIL if anyone accidentally pulls this
 *     into a client component — that failure is doing its job.
 *   - Use it only for the rare jobs RLS genuinely can't do (the CSV course
 *     import script has its own copy; in-app it is currently unused).
 *   - Never log the key, never pass this client to a component.
 */
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured — see .env.example.",
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
