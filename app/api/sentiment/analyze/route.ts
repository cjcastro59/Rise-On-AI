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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fire-and-forget behavioral recompute trigger.
// Called AFTER a sentiment prediction is persisted to journal_entries.
// Never blocks the response; errors are logged only.
const DEFAULT_LOOKBACK_DAYS = 30;
async function recomputeBehavioralIndicators(userId: string): Promise<void> {
  try {
    const supabase = createClient();

    const { data: journalRows, error: fetchError } = await (supabase
      .from("journal_entries") as any)
      .select(
        "id, user_id, created_at, sentiment, sentiment_score, positive_percentage, negative_percentage, distress_percentage, confidence"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error(
        "[behavioral-trigger] Failed to fetch entries:",
        fetchError
      );
      return;
    }

    const input = (journalRows || []).map(mapDbRowToAnalyticsEntry);
    const indicators = computeAllBehavioralIndicators(input, DEFAULT_LOOKBACK_DAYS);

    const payload = {
      user_id: userId,
      window_end_date: indicators.windowEndDate,
      lookback_days: indicators.lookbackDays,
      behavioral_trend_score: indicators.behavioralTrendScore,
      behavioral_trend_details: indicators.behavioralTrendDetails as any,
      journaling_frequency_score: indicators.journalingFrequencyScore,
      total_entries_window: indicators.totalEntriesWindow,
      unique_days_journaled: indicators.uniqueDaysJournaled,
      journaling_frequency_details: indicators.journalingFrequencyDetails as any,
      mood_consistency_score: indicators.moodConsistencyScore,
      sentiment_scores_variance: indicators.sentimentScoresVariance,
      sentiment_scores_std: indicators.sentimentScoresStd,
      mood_consistency_details: indicators.moodConsistencyDetails as any,
      consecutive_negative_count: indicators.consecutiveNegativeCount,
      consecutive_negative_streak: indicators.consecutiveNegativeStreak as any,
      entries_analyzed: indicators.entriesAnalyzed,
    };

    const { data: existingRow } = await (supabase
      .from("behavioral_indicators") as any)
      .select("id")
      .eq("user_id", userId)
      .eq("window_end_date", indicators.windowEndDate)
      .eq("lookback_days", DEFAULT_LOOKBACK_DAYS)
      .maybeSingle();

    if (existingRow?.id) {
      const { error: updateErr } = await (supabase
        .from("behavioral_indicators") as any)
        .update(payload)
        .eq("id", existingRow.id);
      if (updateErr) {
        console.error("[behavioral-trigger] update failed:", updateErr);
      }
    } else {
      const { error: insertErr } = await (supabase
        .from("behavioral_indicators") as any)
        .insert(payload);
      if (insertErr) {
        console.error("[behavioral-trigger] insert failed:", insertErr);
      }
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
      const payload = {
        sentiment: result.sentiment as Sentiment,
        sentiment_score: result.sentimentScore,
        positive_percentage: result.positivePercentage,
        negative_percentage: result.negativePercentage,
        distress_percentage: result.distressPercentage,
        confidence: result.confidence,
        sentiment_model: result.model,
        sentiment_raw: (result.raw ?? null) as any,
      };

      const { error: updateError } = await (supabase
        .from("journal_entries") as any)
        .update(payload)
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
      // Does NOT await: response latency is not affected.
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
  } catch (err: any) {
    console.error("[sentiment/analyze] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message },
      { status: 500 }
    );
  }
}
