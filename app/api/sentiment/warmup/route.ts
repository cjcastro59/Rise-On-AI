import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL_BASE =
  process.env.SENTIMENT_MODEL_API_URL?.replace(/\/predict\/?$/, "") ||
  "http://127.0.0.1:8000";

export async function GET() {
  try {
    const response = await fetch(MODEL_BASE, {
      method: "GET",
      cache: "no-store",
    });
    const body = await response.json().catch(() => null);
    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      demo_mode: Boolean(body && typeof body === "object" && "demo_mode" in body ? body.demo_mode : false),
      model: body && typeof body === "object" && "model" in body ? body.model : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "warmup failed";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
