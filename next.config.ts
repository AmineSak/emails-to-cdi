import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "googleapis"],
  experimental: {
    serverActions: {
      // Next.js caps Server Action request bodies at 1MB by default. Kept
      // well above the app's 2MB PDF check (app/actions/profile.ts) so
      // oversized uploads hit that friendly error instead of a raw 413 —
      // only wildly oversized files fall through to the hard framework cap.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
