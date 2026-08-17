// =====================================================================
// app/api/aci/route.ts  —  Phase 4.4
// Adaptive Conversational Intelligence API
// =====================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateAdaptiveResponse,
  type ACIContextInput,
} from "@/lib/adaptive-response";
import type { SentimentLabel }  from "@/lib/behavioral-analytics";
import type { WellnessLevel }   from "@/lib/wellness-assessment";
import type { DistressRiskLevel } from "@/lib/distress-risk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Auth + role helper ────────────────────────────────────────────────────────

async function resolveTarget(
  supabase: ReturnType<typeof createClient>,
  requestedUserId: string | null | undefined,
): Promise<
  | { ok: true;  userId: string; role: string }
  | { ok: false; status: number; error: string }
> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile as any)?.role ?? "user";

  if (!requestedUserId || requestedUserId === user.id) {
    return { ok: true, userId: user.id, role };
  }
  const privileged = role === "admin" || role === "owner" || role === "counselor";
  if (!privileged) {
    return { ok: false, status: 403, error: "Forbidden — cannot access another user's ACI response" };
  }
  return { ok: true, userId: requestedUserId, role };
}

// ── Generate + persist ACI ────────────────────────────────────────────────────

export async function generateAndPersistACI(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  entryId: string,
): Promise<ReturnType<typeof generateAdaptiveResponse> | null> {

  // 1. Fetch journal entry
  const { data: entry, error: entryErr } = await (supabase
    .from("journal_entries") as any)
    .select("id, sentiment, sentiment_score, mood, emotions")
    .eq("id", entryId)
    .eq("user_id", userId)
    .single();

  if (entryErr || !entry) {
    console.error("[aci] Failed to fetch journal entry:", entryErr?.message);
    return null;
  }

  const sentiment = (entry as any).sentiment as SentimentLabel | null;
  if (!sentiment) {
    console.warn("[aci] Entry has no stored sentiment yet — skipping ACI generation");
    return null;
  }

  // 2. Fetch latest behavioral_indicators row
  const { data: biRow } = await (supabase
    .from("behavioral_indicators") as any)
    .select(
      "behavioral_trend_score, journaling_frequency_score, mood_consistency_score, " +
      "consecutive_negative_count, wellness_score, wellness_level"
    )
    .eq("user_id", userId)
    .eq("lookback_days", 30)
    .order("window_end_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3. Fetch latest distress_risk_assessments row
  const { data: driRow } = await (supabase
    .from("distress_risk_assessments") as any)
    .select("risk_level")
    .eq("user_id", userId)
    .eq("lookback_days", 30)
    .order("assessed_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 4. Build context input
  const bi  = biRow  as any;
  const dri = driRow as any;
  const e   = entry  as any;

  const contextInput: ACIContextInput = {
    sentiment,
    behavioralTrendScore:     bi?.behavioral_trend_score     ?? 0,
    consecutiveNegativeCount: bi?.consecutive_negative_count ?? 0,
    journalingFrequencyScore: bi?.journaling_frequency_score ?? 50,
    wellnessScore:            bi?.wellness_score   ?? null,
    wellnessLevel:            (bi?.wellness_level as WellnessLevel) ?? null,
    distressRiskLevel:        (dri?.risk_level as DistressRiskLevel) ?? null,
    entryMood:                e?.mood     ?? null,
    recentEmotions:           Array.isArray(e?.emotions) ? (e.emotions as string[]) : [],
  };

  // 5. Generate response
  const response = generateAdaptiveResponse(contextInput);

  // 6. Persist to aci_responses
  const payload = {
    user_id:           userId,
    journal_entry_id:  entryId,
    response_category: response.responseCategory,
    tone:              response.tone,
    greeting:          response.greeting,
    message:           response.message,
    reflection:        response.reflection,
    suggestions:       response.suggestions,
    crisis_note:       response.crisisNote,
    disclaimer:        response.disclaimer,
    context_used:      response.contextUsed,
  };

  const { data: existing } = await (supabase
    .from("aci_responses") as any)
    .select("id")
    .eq("user_id", userId)
    .eq("journal_entry_id", entryId)
    .maybeSingle();

  if ((existing as any)?.id) {
    const { error: upErr } = await (supabase
      .from("aci_responses") as any)
      .update(payload)
      .eq("id", (existing as any).id);
    if (upErr) console.error("[aci] update failed:", upErr);
  } else {
    const { error: inErr } = await (supabase
      .from("aci_responses") as any)
      .insert(payload);
    if (inErr) console.error("[aci] insert failed:", inErr);
  }

  return response;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const entryId     = searchParams.get("entryId");
    const userIdParam = searchParams.get("userId");

    if (!entryId) {
      return NextResponse.json({ error: "entryId query parameter is required" }, { status: 400 });
    }

    const auth = await resolveTarget(supabase, userIdParam);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data: row, error } = await (supabase
      .from("aci_responses") as any)
      .select("*")
      .eq("user_id",          auth.userId)
      .eq("journal_entry_id", entryId)
      .maybeSingle();

    if (error) {
      console.error("[aci GET] fetch failed:", error);
      return NextResponse.json(
        { error: "Failed to fetch ACI response", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, response: row ?? null });
  } catch (err: unknown) {
    console.error("[aci GET] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

interface GenerateRequest { entryId: string; userId?: string | null; }

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = (await request.json()) as GenerateRequest;

    if (!body.entryId) {
      return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }

    const auth = await resolveTarget(supabase, body.userId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const response = await generateAndPersistACI(supabase, auth.userId, body.entryId);

    if (!response) {
      return NextResponse.json(
        { error: "Could not generate ACI response — entry may not have a stored sentiment yet" },
        { status: 422 },
      );
    }

    return NextResponse.json({ ok: true, response });
  } catch (err: unknown) {
    console.error("[aci POST] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}
