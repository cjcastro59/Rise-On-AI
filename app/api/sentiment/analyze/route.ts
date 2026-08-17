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
import { generateAndPersistACI } from "@/app/api/aci/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LOOKBACK_DAYS = 30;

// Fire-and-forget: runs behavioral → wellness → DRI → ACI after each journal save.
// Never blocks the main response; all errors are only logged.
async function recomputeBehavioralIndicators(
  userId: string,
  entryId?: string | null,
): Promise<void> {
  try {
    const supabase = createClient();

    // 1. Fetch journal entries
    const { data: journalRows, error: fetchError } = await (supabase
      .from("journal_entries") as any)
      .select(
        "id, user_id, created_at, sentiment, sentiment_score, " +
        "positive_percentage, negative_percentage, distress_percentage, confidence"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("[behavioral-trigger] Failed to fetch entries:", fetchError);
      return;
    }

    // 2. Compute behavioral indicators + wellness
    const input      = ((journalRows || []) as any[]).map(mapDbRowToAnalyticsEntry);
    const indicators = computeAllBehavioralIndicators(input, DEFAULT_LOOKBACK_DAYS);
    const wellness   = computeWellnessScore({
      behavioralTrendScore:     indicators.behavioralTrendScore,
      journalingFrequencyScore: indicators.journalingFrequencyScore,
      moodConsistencyScore:     indicators.moodConsistencyScore,
      consecutiveNegativeCount: indicators.consecutiveNegativeCount,
    });

    const payload = {
      user_id:                       userId,
      window_end_date:               indicators.windowEndDate,
      lookback_days:                 DEFAULT_LOOKBACK_DAYS,
      behavioral_trend_score:        indicators.behavioralTrendScore,
      behavioral_trend_details:      indicators.behavioralTrendDetails,
      journaling_frequency_score:    indicators.journalingFrequencyScore,
      total_entries_window:          indicators.totalEntriesWindow,
      unique_days_journaled:         indicators.uniqueDaysJournaled,
      journaling_frequency_details:  indicators.journalingFrequencyDetails,
      mood_consistency_score:        indicators.moodConsistencyScore,
      sentiment_scores_variance:     indicators.sentimentScoresVariance,
      sentiment_scores_std:          indicators.sentimentScoresStd,
      mood_consistency_details:      indicators.moodConsistencyDetails,
      consecutive_negative_count:    indicators.consecutiveNegativeCount,
      consecutive_negative_streak:   indicators.consecutiveNegativeStreak,
      entries_analyzed:              indicators.entriesAnalyzed,
      wellness_score:                wellness.score,
      wellness_level:                wellness.level,
      wellness_score_details:        wellness.details,
    };

    // 3. Upsert behavioral_indicators
    const { data: existingRow } = await (supabase
      .from("behavioral_indicators") as any)
      .select("id")
      .eq("user_id",        userId)
      .eq("window_end_date", indicators.windowEndDate)
      .eq("lookback_days",  DEFAULT_LOOKBACK_DAYS)
      .maybeSingle();

    if ((existingRow as any)?.id) {
      const { error: updateErr } = await (supabase
        .from("behavioral_indicators") as any)
        .update(payload)
        .eq("id", (existingRow as any).id);
      if (updateErr) console.error("[behavioral-trigger] update failed:", updateErr);
    } else {
      const { error: insertErr } = await (supabase
        .from("behavioral_indicators") as any)
        .insert(payload);
      if (insertErr) console.error("[behavioral-trigger] insert failed:", insertErr);
    }

    // 4. DRI recompute
    try {
      await computeAndPersistDRI(supabase, userId, DEFAULT_LOOKBACK_DAYS);
    } catch (driErr) {
      console.error("[behavioral-trigger] DRI recompute failed:", driErr);
    }

    // 5. ACI generation (only when a real entryId is available)
    if (entryId) {
      try {
        await generateAndPersistACI(supabase, userId, entryId);
      } catch (aciErr) {
        console.error("[behavioral-trigger] ACI generation failed:", aciErr);
      }
    }
  } catch (err) {
    console.error("[behavioral-trigger] unexpected error:", err);
  }
}

interface AnalyzeRequest {
  title?:   string | null;
  content?: string | null;
  mood?:    string | null;
  entryId?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // 1. Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const body = (await request.json()) as AnalyzeRequest;
    const { title, content, mood, entryId } = body;

    const fullText = [title, content].filter(Boolean).join("\n\n");
    if (!fullText.trim()) {
      return NextResponse.json({ error: "Empty text provided for analysis" }, { status: 400 });
    }

    // 3. XLM-RoBERTa inference
    const preprocessed = preprocessText(fullText);
    const result       = await analyzeWithXLMRoBERTa(preprocessed, mood);

    // 4. Persist prediction to journal_entries
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

      const { error: updateError } = await (supabase
        .from("journal_entries") as any)
        .update(sentimentPayload)
        .eq("id", entryId)
        .eq("user_id", user.id);

      if (updateError) {
        console.error("[sentiment/analyze] Failed to persist prediction:", updateError);
        return NextResponse.json(
          { error: "Failed to save sentiment prediction", details: updateError.message },
          { status: 500 }
        );
      }

      // Fire-and-forget: behavioral → wellness → DRI → ACI
      void recomputeBehavioralIndicators(user.id, entryId);
    }

    // 5. Return
    return NextResponse.json({
      ok:                  true,
      sentiment:           result.sentiment,
      sentimentScore:      result.sentimentScore,
      positivePercentage:  result.positivePercentage,
      negativePercentage:  result.negativePercentage,
      distressPercentage:  result.distressPercentage,
      confidence:          result.confidence,
      model:               result.model,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[sentiment/analyze] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error", details: message }, { status: 500 });
  }
}
