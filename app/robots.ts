/**
 * robots.txt — public pages indexable, every signed-in area disallowed
 * (spec §5.1). Keep this list in sync with PROTECTED_PREFIXES in
 * lib/supabase/middleware.ts.
 */
import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/onboarding",
        "/courses",
        "/groups",
        "/people",
        "/profile",
        "/messages",
        "/notifications",
        "/settings",
        "/admin",
        "/auth/",
      ],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
