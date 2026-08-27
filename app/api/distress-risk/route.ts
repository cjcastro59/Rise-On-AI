// =====================================================================
// app/api/distress-risk/route.ts  —  Phase 4.3
// Distress Risk Indicator API
// DISCLAIMER: Output is a decision-support indicator only.
// It does NOT constitute a clinical diagnosis.
// =====================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  computeAllBehavioralIndicators,
  mapDbRowToAnalyticsEntry,
  type JournalEntryForAnalytics,
} from "@/lib/behavioral-analytics";
import { computeWellnessScore }   from "@/lib/wellness-assessment";
import { computeDistressRisk, type DistressRiskInput } from "@/lib/distress-risk";
import type { SentimentLabel } from "@/lib/behavioral-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Auth + role helper ────────────────────────────────────────────────────────

async function resolveTarget(
  supabase: ReturnType<typeof createClient>,
  requestedId: string | null | undefined,
): Promise<
  | { ok: true;  userId: string; role: string }
  | { ok: false; status: number; error: string }
> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  const { data: profile } = await (supabase
    .from("user_profiles") as any)
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile as any)?.role ?? "user";

  if (!requestedId || requestedId === user.id) {
    return { ok: true, userId: user.id, role };
  }
  const privileged = role === "admin" || role === "owner" || role === "counselor";
  if (!privileged) {
    return { ok: false, status: 403, error: "Forbidden — cannot access another user's risk data" };
  }
  return { ok: true, userId: requestedId, role };
}

// ── Shared: compute DRI and upsert ───────────────────────────────────────────

export async function computeAndPersistDRI(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  lookbackDays: number,
): Promise<{ result: ReturnType<typeof computeDistressRisk>; savedId: string | null }> {

  const { data: journalRows, error: journalErr } = await (supabase
    .from("journal_entries") as any)
    .select("id, user_id, created_at, sentiment, sentiment_score, positive_percentage, negative_percentage, distress_percentage, confidence")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (journalErr) throw new Error(`Failed to fetch journal entries: ${journalErr.message}`);

  const entries: JournalEntryForAnalytics[] = ((journalRows ?? []) as any[]).map(
    mapDbRowToAnalyticsEntry
  );
  const indicators = computeAllBehavioralIndicators(entries, lookbackDays);
  const wellness   = computeWellnessScore({
    behavioralTrendScore:     indicators.behavioralTrendScore,
    journalingFrequencyScore: indicators.journalingFrequencyScore,
    moodConsistencyScore:     indicators.moodConsistencyScore,
    consecutiveNegativeCount: indicators.consecutiveNegativeCount,
  });

  const latestWithSentiment = ((journalRows ?? []) as any[]).find(
    (r) => r.sentiment === "positive" || r.sentiment === "negative" || r.sentiment === "distress"
  );
  const latestSentiment = ((latestWithSentiment as any)?.sentiment as SentimentLabel) ?? null;

  const windowStart = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const inWindow    = ((journalRows ?? []) as any[]).filter((r) => new Date(r.created_at) >= windowStart);
  const distressInWindow = inWindow.filter((r) => r.sentiment === "distress").length;

  const driInput: DistressRiskInput = {
    latestSentiment,
    behavioralTrendScore:     indicators.behavioralTrendScore,
    consecutiveNegativeCount: indicators.consecutiveNegativeCount,
    wellnessScore:            wellness.score,
    wellnessLevel:            wellness.level,
    totalEntriesWindow:       indicators.totalEntriesWindow,
    distressEntriesWindow:    distressInWindow,
  };

  const result = computeDistressRisk(driInput);

  const now = new Date();
  const assessedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const payload = {
    user_id:                    userId,
    assessed_date:              assessedDate,
    lookback_days:              lookbackDays,
    risk_level:                 result.riskLevel,
    total_points:               result.totalPoints,
    latest_sentiment:           latestSentiment,
    behavioral_trend_score:     indicators.behavioralTrendScore,
    consecutive_negative_count: indicators.consecutiveNegativeCount,
    wellness_score:             wellness.score,
    total_entries_window:       indicators.totalEntriesWindow,
    distress_entries_window:    distressInWindow,
    condition_results:          result.details.conditions,
    assessment_details:         result.details,
  };

  const { data: existing } = await (supabase
    .from("distress_risk_assessments") as any)
    .select("id")
    .eq("user_id",      userId)
    .eq("assessed_date", assessedDate)
    .eq("lookback_days", lookbackDays)
    .maybeSingle();

  let savedId: string | null = null;

  if ((existing as any)?.id) {
    const { error: upErr } = await (supabase
      .from("distress_risk_assessments") as any)
      .update(payload)
      .eq("id", (existing as any).id);
    if (upErr) console.error("[distress-risk] update failed:", upErr);
    else savedId = (existing as any).id;
  } else {
    const { data: inserted, error: inErr } = await (supabase
      .from("distress_risk_assessments") as any)
      .insert(payload)
      .select("id")
      .single();
    if (inErr) console.error("[distress-risk] insert failed:", inErr);
    else savedId = (inserted as any)?.id ?? null;
  }

  return { result, savedId };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    const auth = await resolveTarget(supabase, searchParams.get("userId"));
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const lookbackDays = Math.min(365, Math.max(1, parseInt(searchParams.get("lookbackDays") ?? "30", 10) || 30));
    const limit        = Math.min(90,  Math.max(1, parseInt(searchParams.get("limit")        ?? "30", 10) || 30));

    const { data: rows, error } = await (supabase
      .from("distress_risk_assessments") as any)
      .select("*")
      .eq("user_id",      auth.userId)
      .eq("lookback_days", lookbackDays)
      .order("assessed_date", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[distress-risk GET] fetch failed:", error);
      return NextResponse.json(
        { error: "Failed to fetch distress risk assessments", details: error.message },
        { status: 500 },
      );
    }

    const latest = (rows ?? [])[0] ?? null;
    // O5 (Phase 7): private SWR cache — distress risk only changes after a journal save.
    return NextResponse.json(
      { ok: true, userId: auth.userId, lookbackDays, count: rows?.length ?? 0, latest, history: rows ?? [] },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (err: unknown) {
    console.error("[distress-risk GET] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error", details: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

interface RecomputeRequest { userId?: string | null; lookbackDays?: number | null; }

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body     = (await request.json()) as RecomputeRequest;
    const lookbackDays = Math.min(365, Math.max(1,
      typeof body.lookbackDays === "number" && body.lookbackDays > 0 ? body.lookbackDays : 30,
    ));

    const auth = await resolveTarget(supabase, body.userId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { result, savedId } = await computeAndPersistDRI(supabase, auth.userId, lookbackDays);

    return NextResponse.json({
      ok:          true,
      userId:      auth.userId,
      lookbackDays,
      savedId,
      persisted:   savedId !== null,
      riskLevel:   result.riskLevel,
      totalPoints: result.totalPoints,
      details:     result.details,
    });
  } catch (err: unknown) {
    console.error("[distress-risk POST] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error", details: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}
