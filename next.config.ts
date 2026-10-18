import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API routes talk to Neon, so the app runs as a Node server.
  // The Android app loads that server through CAPACITOR_SERVER_URL.
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
