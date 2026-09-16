import {
  type AnalysisResult,
  type Sentiment,
  analyzeEntry,
} from "@/lib/sentiment";

// ─────────────────────────────────────────────────────────────────────────────
// Strategy
// ─────────────────────────────────────────────────────────────────────────────
// 1. PRIMARY  → call /api/sentiment/onnx-predict (local ONNX route, works 24/7)
//    The route downloads model_quantized.onnx (~266 MB) from HuggingFace into
//    /tmp on first cold start, then keeps the session warm in module scope.
//    No external API dependency after the one-time download.
//
// 2. FALLBACK → HuggingFace Inference API (only if PRIMARY fails or URL missing)
//
// 3. LAST RESORT → keyword-based fallback (confidence = 0.35)
// ─────────────────────────────────────────────────────────────────────────────

const HF_API_TOKEN = process.env.HUGGINGFACE_API_KEY ?? "";
const HF_MODEL_URL = process.env.SENTIMENT_MODEL_API_URL ?? "";

// Base URL for the local ONNX route.
// On Vercel: VERCEL_URL is injected automatically (no https:// prefix).
// Locally: falls back to localhost:3000.
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const ONNX_ROUTE = `${APP_BASE_URL}/api/sentiment/onnx-predict`;

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
// SHARED: build a prediction from [{label, score}] array
// ─────────────────────────────────────────────────────────────────────────────
function buildFromLabelScores(
  preds: Array<{ label: string; score: number }>,
): XLMroBERTaPrediction {
  const get = (key: string) =>
    preds.find(p => p.label.toLowerCase().includes(key))?.score ?? 0;

  const pos   = get("positive");
  const neg   = get("negative");
  const dst   = get("distress");
  const total = pos + neg + dst || 1;

  const posP = Math.round((pos / total) * 100);
  const negP = Math.round((neg / total) * 100);
  const dstP = Math.max(0, 100 - posP - negP);

  let sentiment: Sentiment;
  if (dst >= pos && dst >= neg)     sentiment = "distress";
  else if (neg > pos)               sentiment = "negative";
  else                              sentiment = "positive";

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
  if (Array.isArray(output) && output.length > 0 && !Array.isArray(output[0])) {
    return buildFromLabelScores(output as Array<{ label: string; score: number }>);
  }
  if (Array.isArray(output) && Array.isArray(output[0])) {
    return buildFromLabelScores(output[0] as Array<{ label: string; score: number }>);
  }
  if (output && typeof output === "object" && "sentiment" in output) {
    return output as XLMroBERTaPrediction;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY: local ONNX route  (/api/sentiment/onnx-predict)
// ─────────────────────────────────────────────────────────────────────────────
async function callOnnxRoute(text: string): Promise<XLMroBERTaPrediction | null> {
  if (!text) return null;
  try {
    const res = await fetch(ONNX_ROUTE, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ inputs: text }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[XLM-R/onnx] HTTP ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }

    const output = await res.json();
    const parsed = parseModelOutput(output);
    if (parsed) {
      console.log("[XLM-R/onnx] Inference OK:", parsed.sentiment);
      return parsed;
    }
    console.warn("[XLM-R/onnx] Unexpected output:", JSON.stringify(output).slice(0, 200));
    return null;
  } catch (err) {
    console.warn("[XLM-R/onnx] Route call failed:", err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK: HuggingFace Inference API  (kept as safety net)
// ─────────────────────────────────────────────────────────────────────────────
async function callHFApi(text: string): Promise<XLMroBERTaPrediction | null> {
  if (!HF_MODEL_URL || !text) return null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(HF_MODEL_URL, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(HF_API_TOKEN ? { Authorization: `Bearer ${HF_API_TOKEN}` } : {}),
        },
        body: JSON.stringify({ inputs: text, options: { wait_for_model: true, use_cache: false } }),
      });

      if (res.status === 503 && attempt < 3) {
        await new Promise(r => setTimeout(r, 3000 * attempt));
        continue;
      }
      if (!res.ok) return null;

      const output = await res.json();

      // HF loading body: {"error":"...","estimated_time":N}
      if (!Array.isArray(output) && "error" in output && "estimated_time" in output) {
        if (attempt < 3) {
          const wait = Math.min(((output as any).estimated_time ?? 20) * 1000, 8000);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        return null;
      }

      const parsed = parseModelOutput(output);
      if (parsed) {
        console.log("[XLM-R/hf-api] Inference OK:", parsed.sentiment);
        return parsed;
      }
      return null;
    } catch {
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
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
  if (!preprocessed) {
    // Nothing to analyse — use keyword fallback directly
    const fb = analyzeEntry(text, mood);
    return { ...fb, sentiment: fb.sentiment as Sentiment, confidence: 0.35, raw: null, model: "keyword-fallback" };
  }

  // 1. Try local ONNX route first (works 24/7, no external dependency)
  const onnxResult = await callOnnxRoute(preprocessed);
  if (onnxResult) {
    const total = onnxResult.positivePercentage + onnxResult.negativePercentage + onnxResult.distressPercentage;
    const top   = Math.max(onnxResult.positivePercentage, onnxResult.negativePercentage, onnxResult.distressPercentage);
    return {
      ...onnxResult,
      confidence: total > 0 ? top / total : onnxResult.confidence,
      model:      "xlm-roberta-onnx",
    };
  }

  // 2. Try HF Inference API as fallback
  const hfResult = await callHFApi(preprocessed);
  if (hfResult) {
    const total = hfResult.positivePercentage + hfResult.negativePercentage + hfResult.distressPercentage;
    const top   = Math.max(hfResult.positivePercentage, hfResult.negativePercentage, hfResult.distressPercentage);
    return {
      ...hfResult,
      confidence: total > 0 ? top / total : hfResult.confidence,
      model:      "xlm-roberta-finetuned",
    };
  }

  // 3. Last resort — keyword fallback
  console.warn("[XLM-R] All inference methods failed — using keyword fallback.");
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
