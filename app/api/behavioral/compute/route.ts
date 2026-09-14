import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  computeAllBehavioralIndicators,
  mapDbRowToAnalyticsEntry,
  type JournalEntryForAnalytics,
} from "@/lib/behavioral-analytics";
import { computeWellnessScore } from "@/lib/wellness-assessment";
import { resolveScopedTargetUser } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ComputeRequest {
  userId?: string | null;
  lookbackDays?: number | null;
  persist?: boolean | null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = (await request.json().catch(() => ({}))) as ComputeRequest;

    const auth = await resolveScopedTargetUser(
      supabase,
      body.userId,
      "Forbidden - cannot compute indicators for another user",
    );
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const lookbackDays =
      typeof body.lookbackDays === "number" && body.lookbackDays > 0
        ? Math.min(365, body.lookbackDays)
        : 30;
    const persist = body.persist !== false;

    const { data: journalRows, error: fetchError } = await (supabase
      .from("journal_entries") as any)
      .select(
        "id, user_id, created_at, sentiment, sentiment_score, positive_percentage, negative_percentage, distress_percentage, confidence",
      )
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("[behavioral/compute] Failed to fetch journal entries:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch journal entries", details: fetchError.message },
        { status: 500 },
      );
    }

    const inputEntries: JournalEntryForAnalytics[] = (journalRows ?? []).map(
      mapDbRowToAnalyticsEntry,
    );
    const indicators = computeAllBehavioralIndicators(inputEntries, lookbackDays);
    const wellnessResult = computeWellnessScore({
      behavioralTrendScore: indicators.behavioralTrendScore,
      journalingFrequencyScore: indicators.journalingFrequencyScore,
      moodConsistencyScore: indicators.moodConsistencyScore,
      consecutiveNegativeCount: indicators.consecutiveNegativeCount,
    });

    let savedId: string | null = null;
    if (persist) {
      const payload = {
        user_id: auth.userId,
        window_end_date: indicators.windowEndDate,
        lookback_days: indicators.lookbackDays,
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
        wellness_score: wellnessResult.score,
        wellness_level: wellnessResult.level,
        wellness_score_details: wellnessResult.details,
      };

      const { data: existingRow, error: lookupError } = await (supabase
        .from("behavioral_indicators") as any)
        .select("id")
        .eq("user_id", auth.userId)
        .eq("window_end_date", indicators.windowEndDate)
        .eq("lookback_days", indicators.lookbackDays)
        .maybeSingle();

      if (lookupError) {
        console.warn(
          "[behavioral/compute] lookup for upsert failed, attempting insert anyway:",
          lookupError,
        );
      }

      if ((existingRow as any)?.id) {
        const { error: updateError } = await (supabase
          .from("behavioral_indicators") as any)
          .update(payload)
          .eq("id", (existingRow as any).id);
        if (updateError) {
          console.error("[behavioral/compute] Failed to UPDATE indicators:", updateError);
        } else {
          savedId = (existingRow as any).id;
        }
      } else {
        const { data: insertResult, error: insertError } = await (supabase
          .from("behavioral_indicators") as any)
          .insert(payload)
          .select("id")
          .single();
        if (insertError) {
          console.error("[behavioral/compute] Failed to INSERT indicators:", insertError);
        } else {
          savedId = (insertResult as any)?.id ?? null;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      targetUserId: auth.userId,
      lookbackDays,
      persisted: persist ? savedId !== null : false,
      savedId,
      indicators,
      wellness: wellnessResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[behavioral/compute] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: message },
      { status: 500 },
    );
  }
}
