// =====================================================================
// app/api/wellness/route.ts  —  Phase 4.2
// Dedicated Wellness Assessment API
// =====================================================================
//
// GET  /api/wellness
//   Returns the stored wellness data for the authenticated user (or a
//   privileged role viewing another user).
//   Query params:
//     userId?      — target user (admin/counselor only)
//     lookbackDays? — window that was used when computing (default 30)
//     limit?       — number of historical rows to return (default 30, max 90)
//
// POST /api/wellness
//   Triggers a full on-demand recomputation of behavioral indicators +
//   wellness score for the target user, persists the result, and returns it.
//   Body: { userId?, lookbackDays? }
//
// Both endpoints are role-checked: regular users can only see/recompute
// their own data. admin / owner / counselor can supply any userId.
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
  type WellnessScoreResult,
} from "@/lib/wellness-assessment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Shared auth + role helper ─────────────────────────────────────────────────

async function resolveTargetUser(
  supabase: ReturnType<typeof createClient>,
  requestedUserId: string | null | undefined,
): Promise<
  | { ok: true;  userId: string; role: string }
  | { ok: false; status: number; error: string }
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "user";

  if (!requestedUserId || requestedUserId === user.id) {
    return { ok: true, userId: user.id, role };
  }

  const isPrivileged =
    role === "admin" || role === "owner" || role === "counselor";
  if (!isPrivileged) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden — cannot access another user's wellness data",
    };
  }

  return { ok: true, userId: requestedUserId, role };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    const auth = await resolveTargetUser(
      supabase,
      searchParams.get("userId"),
    );
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const lookbackDays = Math.min(
      365,
      Math.max(1, parseInt(searchParams.get("lookbackDays") ?? "30", 10) || 30),
    );
    const limit = Math.min(
      90,
      Math.max(1, parseInt(searchParams.get("limit") ?? "30", 10) || 30),
    );

    const { data: rows, error } = await supabase
      .from("behavioral_indicators")
      .select(
        "id, user_id, window_end_date, lookback_days, " +
        "behavioral_trend_score, journaling_frequency_score, " +
        "mood_consistency_score, consecutive_negative_count, " +
        "entries_analyzed, wellness_score, wellness_level, " +
        "wellness_score_details, computed_at, updated_at",
      )
      .eq("user_id", auth.userId)
      .eq("lookback_days", lookbackDays)
      .order("window_end_date", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[wellness GET] fetch failed:", error);
      return NextResponse.json(
        { error: "Failed to fetch wellness data", details: error.message },
        { status: 500 },
      );
    }

    const latest = (rows ?? [])[0] ?? null;

    return NextResponse.json({
      ok: true,
      userId:  auth.userId,
      lookbackDays,
      count:  rows?.length ?? 0,
      latest,
      history: rows ?? [],
    });
  } catch (err: unknown) {
    console.error("[wellness GET] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

interface RecalculateRequest {
  userId?: string | null;
  lookbackDays?: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = (await request.json()) as RecalculateRequest;

    const lookbackDays = Math.min(
      365,
      Math.max(1, (typeof body.lookbackDays === "number" && body.lookbackDays > 0)
        ? body.lookbackDays : 30),
    );

    const auth = await resolveTargetUser(supabase, body.userId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // 1. Fetch all journal entries for this user
    const { data: journalRows, error: fetchError } = await supabase
      .from("journal_entries")
      .select(
        "id, user_id, created_at, sentiment, sentiment_score, " +
        "positive_percentage, negative_percentage, distress_percentage, confidence",
      )
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch journal entries", details: fetchError.message },
        { status: 500 },
      );
    }

    // 2. Compute all 4 behavioral indicators
    const entries: JournalEntryForAnalytics[] = (journalRows ?? []).map(
      mapDbRowToAnalyticsEntry,
    );
    const indicators = computeAllBehavioralIndicators(entries, lookbackDays);

    // 3. Compute wellness score with full details
    const wellness: WellnessScoreResult = computeWellnessScore({
      behavioralTrendScore: indicators.behavioralTrendScore,
      journalingFrequencyScore: indicators.journalingFrequencyScore,
      moodConsistencyScore: indicators.moodConsistencyScore,
      consecutiveNegativeCount: indicators.consecutiveNegativeCount,
    });

    // 4. Upsert into behavioral_indicators
    const payload = {
      user_id: auth.userId,
      window_end_date: indicators.windowEndDate,
      lookback_days: lookbackDays,
      behavioral_trend_score: indicators.behavioralTrendScore,
      behavioral_trend_details: indicators.behavioralTrendDetails,
      journaling_frequency_score: indicators.journalingFrequencyScore,
      total_entries_window: indicators.totalEntriesWindow,
      unique_days_journaled: indicators.uniqueDaysJournaled,
      journaling_frequency_details: indicators.journalingFrequencyDetails,
      mood_consistency_score: indicators.moodConsistencyScore,
      sentiment_scores_variance: indicators.sentimentScoresVariance,
      sentiment_scores_std: indicators.sentimentScoresStd,
      mood_consistency_details: indicators.moodConsistencyDetails,
      consecutive_negative_count: indicators.consecutiveNegativeCount,
      consecutive_negative_streak: indicators.consecutiveNegativeStreak,
      entries_analyzed: indicators.entriesAnalyzed,
      wellness_score:  wellness.score,
      wellness_level:  wellness.level,
      wellness_score_details: wellness.details,
    };

    let savedId: string | null = null;

    const { data: existingRow } = await supabase
      .from("behavioral_indicators")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("window_end_date", indicators.windowEndDate)
      .eq("lookback_days", lookbackDays)
      .maybeSingle();

    if (existingRow?.id) {
      const { error: upErr } = await supabase
        .from("behavioral_indicators")
        .update(payload)
        .eq("id", existingRow.id);
      if (upErr) console.error("[wellness POST] update failed:", upErr);
      else savedId = existingRow.id;
    } else {
      const { data: inserted, error: inErr } = await supabase
        .from("behavioral_indicators")
        .insert(payload)
        .select("id")
        .single();
      if (inErr) console.error("[wellness POST] insert failed:", inErr);
      else savedId = inserted?.id ?? null;
    }

    return NextResponse.json({
      ok: true,
      userId: auth.userId,
      lookbackDays,
      savedId,
      persisted:   savedId !== null,
      indicators,
      wellness,
    });
  } catch (err: unknown) {
    console.error("[wellness POST] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}
