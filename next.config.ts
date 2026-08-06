/**
 * Next.js configuration.
 *
 * There is intentionally very little here. The one thing we configure is
 * which remote image hosts <Image> is allowed to load from: profile pictures
 * live in Supabase Storage, so we allow any *.supabase.co host. (The wildcard
 * means the app keeps working if the team ever migrates to a new Supabase
 * project without editing this file.)
 *
 * Touch this file if you need to allow another image host or add a redirect.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

export default nextConfig;
