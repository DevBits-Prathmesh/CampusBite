import { NextResponse, type NextRequest } from "next/server";

// Capacitor loads the app from a local WebView origin: Android uses
// https://localhost, iOS uses capacitor://localhost (ionic://localhost on older
// versions). These are safe to allow everywhere because they only exist on the
// device itself.
const staticOrigins = new Set([
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
  "ionic://localhost",
]);

const corsOptions: Record<string, string> = {
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

function httpOrigin(value: string | undefined) {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function configuredOrigins() {
  const origins = new Set(staticOrigins);

  // Comma-separated list for a custom domain or a separately hosted frontend.
  for (const entry of (process.env.ALLOWED_ORIGINS ?? "").split(",")) {
    const origin = httpOrigin(entry);
    if (origin) origins.add(origin);
  }

  // Vercel injects these hostnames at runtime (without a scheme), so the app
  // keeps working on production, preview, and branch deployments.
  for (const host of [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    const origin = httpOrigin(host ? `https://${host}` : undefined);
    if (origin) origins.add(origin);
  }

  return origins;
}

function isLocalDevOrigin(origin: string) {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "10.0.2.2";
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = isLocalDevOrigin(origin) || configuredOrigins().has(origin);

  // Preflight request from the WebView or a browser.
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...(allowed ? { "Access-Control-Allow-Origin": origin } : {}),
        ...corsOptions,
      },
    });
  }

  const response = NextResponse.next();
  if (allowed) response.headers.set("Access-Control-Allow-Origin", origin);
  for (const [key, value] of Object.entries(corsOptions)) response.headers.set(key, value);
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
