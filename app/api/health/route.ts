// app/api/health/route.ts
// Simple health check endpoint used by Vercel, load balancers, and uptime monitors.
// Returns 200 with basic system info. Never exposes secrets.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status:    "ok",
      service:   "Rise On AI",
      timestamp: new Date().toISOString(),
      version:   process.env.npm_package_version ?? "0.1.0",
      env:       process.env.NODE_ENV,
    },
    { status: 200 }
  );
}
