/**
 * sitemap.xml — lists the PUBLIC pages for search engines. Authenticated
 * routes are deliberately absent (and robots.ts disallows them).
 */
import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return ["", "/about", "/why", "/testimonials", "/terms_of_service", "/privacy_policy", "/login", "/register"].map(
    (path) => ({
      url: `${base}${path}`,
      changeFrequency: "monthly",
      priority: path === "" ? 1 : 0.6,
    }),
  );
}
