/**
 * Next.js middleware entry point — delegates to lib/supabase/middleware.
 * Runs on every request matched below; keeps sessions fresh and guards
 * signed-in routes. The real logic lives in lib/supabase/middleware.ts.
 */
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on everything except static assets — those can't have sessions.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
