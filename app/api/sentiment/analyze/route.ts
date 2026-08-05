import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  analyzeWithXLMRoBERTa,
  preprocessText,
} from "@/lib/xlm-roberta-sentiment";
import type { Sentiment } from "@/lib/sentiment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
