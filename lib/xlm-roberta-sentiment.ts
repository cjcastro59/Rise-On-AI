import {
  type AnalysisResult,
  type Sentiment,
  analyzeEntry,
} from "@/lib/sentiment";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// Set in Vercel Environment Variables (and .env.local):
//   SENTIMENT_MODEL_API_URL  = https://api-inference.huggingface.co/models/<user>/<repo>
//   HUGGINGFACE_API_KEY      = hf_xxxxxxxxxxxxxxxxxxxx
// ─────────────────────────────────────────────────────────────────────────────
const MODEL_API_URL = process.env.SENTIMENT_MODEL_API_URL ?? "";
const HF_API_TOKEN  = process.env.HUGGINGFACE_API_KEY    ?? "";

export interface XLMroBERTaPrediction {
  sentiment:           Sentiment;
  positivePercentage:  number;
  negativePercentage:  number;
  distressPercentage:  number;
  confidence:          number;
  sentimentScore:      number;
  raw?:                unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT PREPROCESSING  (must match training-time preprocessing)
// ─────────────────────────────────────────────────────────────────────────────
export function preprocessText(input: string | null): string {
  if (!input) return "";
  let text = input.trim();
  text = text.replace(/\s+/g, " ");
  text = text.normalize("NFC").toLowerCase();
  text = text.replace(/<[^>]*>/g, " ");
  text = text.replace(/(https?:\/\/[^\s]+)/g, " ");
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, " ");
  return text.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT PARSER
// Handles both HF response shapes:
//   • Flat array  : [{label, score}, ...]          ← sequence-classification default
//   • Nested array: [[{label, score}, ...]]         ← top_k format
//   • Object      : {sentiment, positivePercentage, ...}  ← custom server
// ─────────────────────────────────────────────────────────────────────────────
function buildFromLabelScores(
  preds: Array<{ label: string; score: number }>,
): XLMroBERTaPrediction {
  const get = (key: string) =>
    preds.find((p) => p.label.toLowerCase().includes(key))?.score ?? 0;

  const pos   = get("positive");
  const neg   = get("negative");
  const dst   = get("distress");
  const total = pos + neg + dst || 1;

  const posP = Math.round((pos / total) * 100);
  const negP = Math.round((neg / total) * 100);
  const dstP = Math.max(0, 100 - posP - negP);

  let sentiment: Sentiment;
  if (dst >= pos && dst >= neg)      sentiment = "distress";
  else if (neg > pos)                sentiment = "negative";
  else                               sentiment = "positive";

  const top   = Math.max(pos, neg, dst);
  const score =
    sentiment === "positive"
      ? Math.round(50 + posP * 0.45)
      : sentiment === "negative"
      ? Math.round(50 - negP * 0.35)
      : Math.max(5, 20 - Math.round(dstP * 0.15));

  return {
    sentiment,
    positivePercentage:  posP,
    negativePercentage:  negP,
    distressPercentage:  dstP,
    confidence:          top / total,
    sentimentScore:      score,
    raw:                 preds,
  };
}

function parseModelOutput(output: unknown): XLMroBERTaPrediction | null {
  // Flat array: [{label, score}, ...]
  if (Array.isArray(output) && output.length > 0 && !Array.isArray(output[0])) {
    return buildFromLabelScores(output as Array<{ label: string; score: number }>);
  }
  // Nested array: [[{label, score}, ...]]
  if (Array.isArray(output) && Array.isArray(output[0])) {
    return buildFromLabelScores(output[0] as Array<{ label: string; score: number }>);
  }
  // Custom server direct object
  if (output && typeof output === "object" && "sentiment" in output) {
    return output as XLMroBERTaPrediction;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODEL CALL  (with HuggingFace cold-start handling)
//
// HuggingFace free-tier models go cold after ~15 min of inactivity.
// When cold, the API returns:
//   HTTP 503  OR  HTTP 200 { "error": "...", "estimated_time": N }
// We retry up to 4 times with progressive back-off.
// ─────────────────────────────────────────────────────────────────────────────
async function callModelAPI(text: string): Promise<XLMroBERTaPrediction | null> {
  if (!MODEL_API_URL || !text) return null;

  const MAX_ATTEMPTS = 4;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(MODEL_API_URL, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(HF_API_TOKEN ? { Authorization: `Bearer ${HF_API_TOKEN}` } : {}),
        },
        body:  JSON.stringify({
          inputs:  text,
          options: { wait_for_model: true, use_cache: false },
        }),
        // No signal / AbortController — rely on Vercel maxDuration (60 s)
      });

      // ── HF cold-start: 503 Service Unavailable ──────────────────────────
      if (res.status === 503 && attempt < MAX_ATTEMPTS) {
        const waitMs = 3000 * attempt; // 3 s, 6 s, 9 s
        console.warn(
          `[XLM-R] 503 on attempt ${attempt}/${MAX_ATTEMPTS}, waiting ${waitMs}ms...`,
        );
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[XLM-R] HTTP ${res.status} ${res.statusText}:`, body.slice(0, 300));
        return null;
      }

      const output = await res.json();

      // ── HF "still loading" JSON body ─────────────────────────────────────
      if (
        output &&
        typeof output === "object" &&
        !Array.isArray(output) &&
        "error" in output &&
        "estimated_time" in output
      ) {
        const estimatedMs = Math.min(
          ((output as { estimated_time: number }).estimated_time ?? 20) * 1000,
          10_000,
        );
        if (attempt < MAX_ATTEMPTS) {
          console.warn(
            `[XLM-R] Model loading (~${Math.round(estimatedMs / 1000)}s), attempt ${attempt}/${MAX_ATTEMPTS}...`,
          );
          await new Promise((r) => setTimeout(r, estimatedMs));
          continue;
        }
        console.error("[XLM-R] Model still loading after all retries.");
        return null;
      }

      const parsed = parseModelOutput(output);
      if (parsed) return parsed;

      console.warn(
        "[XLM-R] Unrecognised output format:",
        JSON.stringify(output).slice(0, 300),
      );
      return null;
    } catch (err) {
      console.error(`[XLM-R] Network error on attempt ${attempt}:`, err);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
      return null;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeWithXLMRoBERTa(
  text: string | null,
  mood: string | null = null,
): Promise<XLMroBERTaPrediction & { model: string }> {
  const preprocessed = preprocessText(text);
  const result       = await callModelAPI(preprocessed);

  if (result) {
    const total = result.positivePercentage + result.negativePercentage + result.distressPercentage;
    const top   = Math.max(result.positivePercentage, result.negativePercentage, result.distressPercentage);
    return {
      ...result,
      confidence: total > 0 ? top / total : result.confidence,
      model:      "xlm-roberta-finetuned",
    };
  }

  // ── Keyword fallback when model is unreachable ────────────────────────────
  console.warn("[XLM-R] Model unavailable — using keyword fallback.");
  const fb = analyzeEntry(text, mood);
  return {
    sentiment:          fb.sentiment as Sentiment,
    positivePercentage: fb.positivePercentage,
    negativePercentage: fb.negativePercentage,
    distressPercentage: fb.distressPercentage,
    confidence:         0.35,
    sentimentScore:     fb.sentimentScore,
    raw:                null,
    model:              "keyword-fallback",
  };
}

export async function analyzeWithXLMRoBERTaLegacy(
  text: string | null,
  mood: string | null = null,
): Promise<AnalysisResult> {
  const xlm = await analyzeWithXLMRoBERTa(text, mood);
  return {
    sentiment:          xlm.sentiment,
    sentimentScore:     xlm.sentimentScore,
    positivePercentage: xlm.positivePercentage,
    negativePercentage: xlm.negativePercentage,
    distressPercentage: xlm.distressPercentage,
    emotions:           [],
    keyPhrases:         [],
    feedback:           "",
    reflection:         "",
    suggestions:        [],
  };
}
