// =====================================================================
// app/api/distress-risk/route.ts  —  Phase 4.3
// Distress Risk Indicator API
// =====================================================================
//
// GET  /api/distress-risk
//   Returns stored DRI assessments for the authenticated user.
//   Query params:
//     userId?       — target user (admin/owner/counselor only)
//     lookbackDays? — window (default 30)
//     limit?        — number of rows to return (default 30, max 90)
//
// POST /api/distress-risk
//   Recomputes the DRI on demand from current journal + behavioral data,
//   persists the result, and returns it.
//   Body: { userId?, lookbackDays? }
//
// Both endpoints are role-checked: users can only access their own data.
// admin / owner / counselor can supply any userId.
//
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
import {
  computeWellnessScore,
} from "@/lib/wellness-assessment";
import {
  computeDistressRisk,
  type DistressRiskInput,
} from "@/lib/distress-risk";
import type { SentimentLabel } from "@/lib/behavioral-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Shared auth + role helper ─────────────────────────────────────────────────

async function resolveTarget(
  supabase: ReturnType<typeof createClient>,
  requestedId: string | null | undefined,
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

  const role = profile?.role ?? "user";

  if (!requestedId || requestedId === user.id) {
    return { ok: true, userId: user.id, role };
  }

  const privileged = role === "admin" || role === "owner" || role === "counselor";
  if (!privileged) {
    return { ok: false, status: 403, error: "Forbidden — cannot access another user's risk data" };
  }
  return { ok: true, userId: requestedId, role };
}

// ── Shared: compute DRI from DB data and upsert ───────────────────────────────

export async function computeAndPersistDRI(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  lookbackDays: number,
): Promise<{ result: ReturnType<typeof computeDistressRisk>; savedId: string | null }> {
  // 1. Fetch journal entries
  const { data: journalRows, error: journalErr } = await supabase
    .from("journal_entries")
    .select("id, user_id, created_at, sentiment, sentiment_score, positive_percentage, negative_percentage, distress_percentage, confidence")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (journalErr) throw new Error(`Failed to fetch journal entries: ${journalErr.message}`);

  const entries: JournalEntryForAnalytics[] = (journalRows ?? []).map(mapDbRowToAnalyticsEntry);

  // 2. Compute behavioral indicators
  const indicators = computeAllBehavioralIndicators(entries, lookbackDays);

  // 3. Compute wellness score
  const wellness = computeWellnessScore({
    behavioralTrendScore: indicators.behavioralTrendScore,
    journalingFrequencyScore: indicators.journalingFrequencyScore,
    moodConsistencyScore: indicators.moodConsistencyScore,
    consecutiveNegativeCount: indicators.consecutiveNegativeCount,
  });

  // 4. Latest sentiment = sentiment of the most recent entry that has one
  const latestWithSentiment = (journalRows ?? []).find(
    (r: any) => r.sentiment === "positive" || r.sentiment === "negative" || r.sentiment === "distress"
  );
  const latestSentiment = (latestWithSentiment?.sentiment as SentimentLabel) ?? null;

  // 5. Count distress entries in window
  const windowStart = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const inWindow = (journalRows ?? []).filter(
    (r: any) => new Date(r.created_at) >= windowStart
  );
  const distressInWindow = inWindow.filter(
    (r: any) => r.sentiment === "distress"
  ).length;

  // 6. Build DRI input
  const driInput: DistressRiskInput = {
    latestSentiment,
    behavioralTrendScore: indicators.behavioralTrendScore,
    consecutiveNegativeCount: indicators.consecutiveNegativeCount,
    wellnessScore: wellness.score,
    wellnessLevel: wellness.level,
    totalEntriesWindow: indicators.totalEntriesWindow,
    distressEntriesWindow: distressInWindow,
  };

  // 7. Compute DRI
  const result = computeDistressRisk(driInput);

  // 8. Today's date as assessed_date
  const now = new Date();
  const assessedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // 9. Upsert to distress_risk_assessments
  const payload = {
    user_id: userId,
    assessed_date: assessedDate,
    lookback_days: lookbackDays,
    risk_level: result.riskLevel,
    total_points: result.totalPoints,
    latest_sentiment: latestSentiment,
    behavioral_trend_score: indicators.behavioralTrendScore,
    consecutive_negative_count: indicators.consecutiveNegativeCount,
    wellness_score: wellness.score,
    total_entries_window: indicators.totalEntriesWindow,
    distress_entries_window: distressInWindow,
    condition_results: result.details.conditions,
    assessment_details: result.details,
  };

  const { data: existing } = await supabase
    .from("distress_risk_assessments")
    .select("id")
    .eq("user_id", userId)
    .eq("assessed_date", assessedDate)
    .eq("lookback_days", lookbackDays)
    .maybeSingle();

  let savedId: string | null = null;

  if (existing?.id) {
    const { error: upErr } = await supabase
      .from("distress_risk_assessments")
      .update(payload)
      .eq("id", existing.id);
    if (upErr) console.error("[distress-risk] update failed:", upErr);
    else savedId = existing.id;
  } else {
    const { data: inserted, error: inErr } = await supabase
      .from("distress_risk_assessments")
      .insert(payload)
      .select("id")
      .single();
    if (inErr) console.error("[distress-risk] insert failed:", inErr);
    else savedId = inserted?.id ?? null;
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

    const lookbackDays = Math.min(365, Math.max(1,
      parseInt(searchParams.get("lookbackDays") ?? "30", 10) || 30,
    ));
    const limit = Math.min(90, Math.max(1,
      parseInt(searchParams.get("limit") ?? "30", 10) || 30,
    ));

    const { data: rows, error } = await supabase
      .from("distress_risk_assessments")
      .select("*")
      .eq("user_id", auth.userId)
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

    return NextResponse.json({
      ok:          true,
      userId:      auth.userId,
      lookbackDays,
      count:       rows?.length ?? 0,
      latest,
      history:     rows ?? [],
    });
  } catch (err: unknown) {
    console.error("[distress-risk GET] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

interface RecomputeRequest {
  userId?:       string | null;
  lookbackDays?: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = (await request.json()) as RecomputeRequest;

    const lookbackDays = Math.min(365, Math.max(1,
      typeof body.lookbackDays === "number" && body.lookbackDays > 0
        ? body.lookbackDays : 30,
    ));

    const auth = await resolveTarget(supabase, body.userId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { result, savedId } = await computeAndPersistDRI(
      supabase, auth.userId, lookbackDays,
    );

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
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}
