/**
 * Next.js configuration.
 *
 * There is intentionally very little here. The one thing we configure is
 * which remote image hosts <Image> is allowed to load from: profile pictures
 * live in Supabase Storage, so we allow any *.supabase.co host. (The wildcard
 * means the app keeps working if the team ever migrates to a new Supabase
 * project without editing this file.)
 *
 * The second thing configured is the Server Action body limit. Next.js
 * defaults to 1 MB, but the profile-picture upload promises "up to 5 MB"
 * (spec §5.11). Without raising it, any real phone photo silently failed
 * — the request never reached our action, so no error, no save (bug
 * report #6). 6 MB = the 5 MB image plus multipart/form-data overhead.
 *
 * Touch this file if you need to allow another image host or add a redirect.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
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
