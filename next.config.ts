import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Capacitor loads static files inside the Android WebView, so the app
  // must export to `out/` instead of running a Node server.
  output: "export",
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
