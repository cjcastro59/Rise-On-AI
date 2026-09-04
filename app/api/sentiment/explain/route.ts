// =====================================================================
// app/api/sentiment/explain/route.ts  —  Phase 6
// On-demand Explainable AI endpoint
// =====================================================================
//
// POST /api/sentiment/explain
//   Calls the Python server's /explain endpoint (Integrated Gradients)
//   for a specific journal entry.
//
//   Body: { entryId: string }
//     - entryId is used to fetch the stored text + confidence data
//       from journal_entries (never re-run inference)
//
//   Returns one of three shapes:
//     a) IG available: { ok, available:true, wordAttributions, confidence,
//                        keywordAgreement, disclaimer, ... }
//     b) IG disabled:  { ok, available:false, reason, confidence,
//                        keywordAgreement }
//     c) Error:        { ok:false, error }
//
// IMPORTANT CONSTRAINTS:
//   • Requires auth — users can only explain their own entries
//   • NEVER called automatically — only when user clicks the button
//   • NEVER modifies journal_entries or any other table
//   • Does NOT re-run the production /predict endpoint
//   • Fetches text from DB; calls Python /explain with that text
//   • Always returns confidence + keyword agreement even when IG unavailable
//
// The Python /explain endpoint is only active when the sentiment server
// is started with USE_EXPLAIN=1. Default production is OFF.
// =====================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { preprocessText } from "@/lib/xlm-roberta-sentiment";
import {
  buildExplainabilityResult,
  processIntegratedGradients,
  type ExplainabilityResult,
} from "@/lib/explainability";
import type { Sentiment } from "@/lib/sentiment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Python server explain endpoint URL
const SENTIMENT_SERVER = process.env.SENTIMENT_MODEL_API_URL?.replace("/predict", "") ?? "http://localhost:8000";
const EXPLAIN_ENDPOINT = `${SENTIMENT_SERVER}/explain`;

// ── Type for the Python /explain response ─────────────────────────────────────
interface PythonExplainResponse {
  ok:              boolean;
  available:       boolean;
  predicted_label?: string;
  predicted_prob?:  number;
  all_probs?: {
    positive: number;
    negative: number;
    distress: number;
  };
  word_attributions?: Array<{ word: string; score: number; subword_tokens: string[] }>;
  num_steps?:    number;
  method?:       string;
  disclaimer?:   string;
  error?:        string | null;
}

// ── Main handler ───────────────────────────────────────────────────────────────

interface ExplainRequest { entryId: string; }

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // 1. Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as ExplainRequest;
    if (!body.entryId) {
      return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }

    // 2. Fetch the journal entry — only the text + stored sentiment columns
    //    (never re-run inference; use stored predictions)
    const { data: entry, error: fetchErr } = await (supabase
      .from("journal_entries") as any)
      .select(
        "id, content, title, mood, sentiment, " +
        "positive_percentage, negative_percentage, distress_percentage, confidence"
      )
      .eq("id", body.entryId)
      .eq("user_id", user.id)  // RLS: only owner
      .single();

    if (fetchErr || !entry) {
      return NextResponse.json(
        { error: "Entry not found or access denied" },
        { status: 404 }
      );
    }

    const e = entry as any;

    // 3. Build text for explanation (same preprocessing as production)
    const rawText = [e.title, e.content].filter(Boolean).join("\n\n");
    if (!rawText.trim()) {
      return NextResponse.json({ error: "Entry has no text content" }, { status: 400 });
    }

    // 4. Resolve sentiment + probabilities from stored DB values
    //    Percentages are stored 0–100; convert to 0–1 for the explainability lib
    const xlmSentiment: Sentiment = (e.sentiment as Sentiment) ?? "positive";
    const posProb = (e.positive_percentage ?? 60) / 100;
    const negProb = (e.negative_percentage ?? 30) / 100;
    const dstProb = (e.distress_percentage ?? 10) / 100;

    // 5. Keyword agreement — disabled (ML-only mode).
    //    Pass null so buildExplainabilityResult marks it "keyword_unavailable".
    const kwSentiment: Sentiment | null = null;

    // 6. Call Python /explain for Integrated Gradients
    //    Hard timeout: 30 seconds (IG on CPU can take 10–25s for long texts)
    let igResult = processIntegratedGradients(null, 50, "Not yet requested");
    let pythonAvailable = false;

    try {
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 30_000);

      const resp = await fetch(EXPLAIN_ENDPOINT, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          inputs:       preprocessText(rawText),
          num_steps:    50,
          target_class: null,  // explain the predicted class
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (resp.ok) {
        const pyResult = (await resp.json()) as PythonExplainResponse;
        pythonAvailable = pyResult.available === true;

        if (pythonAvailable && pyResult.word_attributions) {
          igResult = processIntegratedGradients(
            pyResult.word_attributions,
            pyResult.num_steps ?? 50,
          );
        } else {
          // Server responded but IG is disabled or errored
          igResult = processIntegratedGradients(
            null,
            50,
            pyResult.error ?? "Integrated Gradients not available on this server instance",
          );
        }
      } else {
        igResult = processIntegratedGradients(
          null, 50,
          `Python server returned HTTP ${resp.status}`,
        );
      }
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : "Unknown error";
      const reason = msg.includes("abort")
        ? "Explanation request timed out (>30s). The text may be too long or the server is under load."
        : `Could not reach explanation server: ${msg}. ` +
          "Ensure the sentiment server is running with USE_EXPLAIN=1.";
      igResult = processIntegratedGradients(null, 50, reason);
    }

    // 7. Build the full explainability result
    const explainResult: ExplainabilityResult = buildExplainabilityResult(
      posProb,
      negProb,
      dstProb,
      xlmSentiment,
      kwSentiment,
      igResult,
    );

    return NextResponse.json({
      ok:            true,
      entryId:       body.entryId,
      igAvailable:   pythonAvailable,
      explainability: explainResult,
    });

  } catch (err: unknown) {
    console.error("[sentiment/explain] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
