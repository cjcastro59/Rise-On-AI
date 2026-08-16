import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  analyzeWithXLMRoBERTa,
  preprocessText,
} from "@/lib/xlm-roberta-sentiment";
import type { Sentiment } from "@/lib/sentiment";
import {
  computeAllBehavioralIndicators,
  mapDbRowToAnalyticsEntry,
} from "@/lib/behavioral-analytics";
import { computeWellnessScore } from "@/lib/wellness-assessment";
import { computeAndPersistDRI } from "@/app/api/distress-risk/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fire-and-forget behavioral recompute trigger.
// Called AFTER a sentiment prediction is persisted to journal_entries.
// Never blocks the response; errors are logged only.
const DEFAULT_LOOKBACK_DAYS = 30;

async function recomputeBehavioralIndicators(userId: string): Promise<void> {
  try {
    const supabase = createClient();

    const { data: journalRows, error: fetchError } = await supabase
      .from("journal_entries")
      .select(
        "id, user_id, created_at, sentiment, sentiment_score, positive_percentage, negative_percentage, distress_percentage, confidence"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("[behavioral-trigger] Failed to fetch entries:", fetchError);
      return;
    }

    const input = (journalRows || []).map(mapDbRowToAnalyticsEntry);
    const indicators = computeAllBehavioralIndicators(input, DEFAULT_LOOKBACK_DAYS);
    const wellnessResult = computeWellnessScore({
      behavioralTrendScore: indicators.behavioralTrendScore,
      journalingFrequencyScore: indicators.journalingFrequencyScore,
      moodConsistencyScore: indicators.moodConsistencyScore,
      consecutiveNegativeCount: indicators.consecutiveNegativeCount,
    });

    const payload = {
      user_id: userId,
      window_end_date: indicators.windowEndDate,
      lookback_days: DEFAULT_LOOKBACK_DAYS,
      behavioral_trend_score: indicators.behavioralTrendScore,
      behavioral_trend_details: indicators.behavioralTrendDetails,
      journaling_frequency_score: indicators.journalingFrequencyScore,
      total_entries_window: indicators.totalEntriesWindow,
      unique_days_journaled: indicators.uniqueDaysJournaled,
      journaling_frequency_details: indicators.journalingFrequencyDetails,
      mood_consistency_score: indicators.moodConsistencyScore,
      sentiment_scores_variance: indicators.sentimentScoresVariance,
      sentiment_scores_std: indicators.sentimentScoresStd,
      mood_consistency_details:indicators.moodConsistencyDetails,
      consecutive_negative_count: indicators.consecutiveNegativeCount,
      consecutive_negative_streak: indicators.consecutiveNegativeStreak,
      entries_analyzed: indicators.entriesAnalyzed,
      wellness_score: wellnessResult.score,
      wellness_level: wellnessResult.level,
      wellness_score_details: wellnessResult.details,
    };

    const { data: existingRow } = await supabase
      .from("behavioral_indicators")
      .select("id")
      .eq("user_id", userId)
      .eq("window_end_date", indicators.windowEndDate)
      .eq("lookback_days", DEFAULT_LOOKBACK_DAYS)
      .maybeSingle();

    if (existingRow?.id) {
      const { error: updateErr } = await supabase
        .from("behavioral_indicators")
        .update(payload)
        .eq("id", existingRow.id);
      if (updateErr) {
        console.error("[behavioral-trigger] update failed:", updateErr);
      }
    } else {
      const { error: insertErr } = await supabase
        .from("behavioral_indicators")
        .insert(payload);
      if (insertErr) {
        console.error("[behavioral-trigger] insert failed:", insertErr);
      }
    }

    // ── Step 2: Recompute Distress Risk Indicator (fire-and-forget) ───────
    // Runs immediately after behavioral + wellness are persisted.
    // Errors are caught and logged so they never block the response.
    try {
      await computeAndPersistDRI(supabase, userId, DEFAULT_LOOKBACK_DAYS);
    } catch (driErr) {
      console.error("[behavioral-trigger] DRI recompute failed:", driErr);
    }
  } catch (err) {
    console.error("[behavioral-trigger] unexpected error:", err);
  }
}

interface AnalyzeRequest {
  title?: string | null;
  content?: string | null;
  mood?: string | null;
  entryId?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // ---- 1. Auth check ----
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ---- 2. Parse body ----
    const body = (await request.json()) as AnalyzeRequest;
    const { title, content, mood, entryId } = body;

    const fullText = [title, content].filter(Boolean).join("\n\n");
    if (!fullText.trim()) {
      return NextResponse.json(
        { error: "Empty text provided for analysis" },
        { status: 400 }
      );
    }

    // ---- 3. Analyze with XLM-RoBERTa ----
    const preprocessed = preprocessText(fullText);
    const result = await analyzeWithXLMRoBERTa(preprocessed, mood);

    // ---- 4. Save prediction to DB if entryId provided ----
    if (entryId) {
      const sentimentPayload = {
        sentiment:           result.sentiment as Sentiment,
        sentiment_score:     result.sentimentScore,
        positive_percentage: result.positivePercentage,
        negative_percentage: result.negativePercentage,
        distress_percentage: result.distressPercentage,
        confidence:          result.confidence,
        sentiment_model:     result.model,
        sentiment_raw:       result.raw ?? null,
      };

      const { error: updateError } = await supabase
        .from("journal_entries")
        .update(sentimentPayload)
        .eq("id", entryId)
        .eq("user_id", user.id); // RLS safety: only owner can update

      if (updateError) {
        console.error(
          "[sentiment/analyze] Failed to persist prediction:",
          updateError
        );
        return NextResponse.json(
          {
            error: "Failed to save sentiment prediction",
            details: updateError.message,
          },
          { status: 500 }
        );
      }

      // ---- 4b. Fire-and-forget behavioral indicators recompute ----
      // Does NOT await — response latency is not affected.
      void recomputeBehavioralIndicators(user.id);
    }

    // ---- 5. Return result ----
    return NextResponse.json({
      ok: true,
      sentiment: result.sentiment,
      sentimentScore: result.sentimentScore,
      positivePercentage: result.positivePercentage,
      negativePercentage: result.negativePercentage,
      distressPercentage: result.distressPercentage,
      confidence: result.confidence,
      model: result.model,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[sentiment/analyze] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: message },
      { status: 500 }
    );
  }
}
