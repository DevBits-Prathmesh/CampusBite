import { NextResponse, type NextRequest } from "next/server";

const capacitorOrigins = new Set([
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
]);

const corsOptions: Record<string, string> = {
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

function isAllowedOrigin(origin: string) {
  if (capacitorOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "10.0.2.2";
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = isAllowedOrigin(origin);

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
