import {
  analyzeEntry as fallbackAnalyzeEntry,
  type AnalysisResult,
  type Sentiment,
} from "@/lib/sentiment";

// =====================================================
// SETUP - NO API KEY NEEDED BY DEFAULT!
// Default: calls LOCAL FastAPI server we provided (http://localhost:8000/predict)
//
// How to switch (set in .env.local):
//
// 1. LOCAL SELF-HOSTED (DEFAULT, NO KEY NEEDED):
//    SENTIMENT_MODEL_API_URL=http://localhost:8000/predict
//    (Run the Python server in scripts/sentiment-server/)
//
// 2. HUGGINGFACE INFERENCE API (if you want cloud):
//    SENTIMENT_MODEL_API_URL=https://api-inference.huggingface.co/models/YOUR_USERNAME/YOUR_MODEL
//    HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxx
// =====================================================
const MODEL_API_URL =
  process.env.SENTIMENT_MODEL_API_URL || "http://localhost:8000/predict";
const HF_API_TOKEN = process.env.HUGGINGFACE_API_KEY || "";

// Never force fallback if an explicit URL is set; only fallback on runtime failure.
const USE_FALLBACK_ONLY = !MODEL_API_URL;

// =====================================================
// OPTIMIZATION: HTTP KEEP-ALIVE (undici Agent)
// Reuses TCP connections to the model server — 20-50% faster repeated calls!
// =====================================================
let keepAliveDispatcher: unknown = null;
function getKeepAliveDispatcher(): unknown {
  if (keepAliveDispatcher) return keepAliveDispatcher;
  try {
    // Next.js uses undici for fetch; create a connection-pooled agent
    /* eslint-disable */
    const undici = require("undici");
    /* eslint-enable */
    if (undici && undici.Agent) {
      keepAliveDispatcher = new undici.Agent({
        keepAliveTimeout: 60_000,
        keepAliveMaxTimeout: 300_000,
        connections: 16,
        pipelining: 6,
      });
    }
  } catch {
    /* undici not available in this environment — ignore */
  }
  return keepAliveDispatcher;
}

export interface XLMroBERTaPrediction {
  sentiment: Sentiment;
  positivePercentage: number;
  negativePercentage: number;
  distressPercentage: number;
  confidence: number;
  sentimentScore: number;
  raw?: unknown;
}

// =====================================================
// PREPROCESSING - MUST MATCH TRAINING-TIME PREPROCESSING
// =====================================================
export function preprocessText(input: string | null): string {
  if (!input) return "";
  let text = input.trim();
  // Normalize whitespace
  text = text.replace(/\s+/g, " ");
  // Unicode NFC normalization
  text = text.normalize("NFC");
  // Strip HTML
  text = text.replace(/<[^>]*>/g, " ");
  // Strip URLs
  text = text.replace(/(https?:\/\/[^\s]+)/g, " ");
  // Strip emails
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, " ");
  return text.trim();
}

// =====================================================
// CALL THE FINE-TUNED XLM-ROBERTA MODEL API
// =====================================================
async function callModelAPI(
  text: string
): Promise<XLMroBERTaPrediction | null> {
  if (USE_FALLBACK_ONLY) return null;
  if (!text) return null;

  try {
    const dispatcher = getKeepAliveDispatcher() as { dispatcher?: unknown };
    const response = await fetch(MODEL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Connection: "keep-alive",
        ...(HF_API_TOKEN ? { Authorization: `Bearer ${HF_API_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        inputs: text,
        options: { wait_for_model: true, use_cache: true },
      }),
      cache: "no-store",
      ...dispatcher,
    });

    if (!response.ok) {
      console.error(
        `[XLM-RoBERTa] Model endpoint HTTP ${response.status}: ${response.statusText}`
      );
      return null;
    }

    const output = await response.json();

    // ---- Parse HuggingFace-style top-k multi-label output ----
    if (Array.isArray(output) && Array.isArray(output[0])) {
      const preds = output[0] as Array<{ label: string; score: number }>;
      const getScore = (key: string) =>
        preds.find(
          (p) =>
            p.label.toLowerCase().includes(key) ||
            p.label.toLowerCase() === key
        )?.score || 0;

      const pos = getScore("positive");
      const neg = getScore("negative");
      const dst = getScore("distress");
      const total = pos + neg + dst || 1;

      const positivePercentage = Math.round((pos / total) * 100);
      const negativePercentage = Math.round((neg / total) * 100);
      const distressPercentage = Math.max(
        0,
        100 - positivePercentage - negativePercentage
      );

      let sentiment: Sentiment;
      if (dst >= pos && dst >= neg) sentiment = "distress";
      else if (neg > pos) sentiment = "negative";
      else sentiment = "positive";

      const topScore = Math.max(pos, neg, dst);
      const sentimentScore =
        sentiment === "positive"
          ? Math.round(50 + positivePercentage * 0.45)
          : sentiment === "negative"
          ? Math.round(50 - negativePercentage * 0.35)
          : Math.max(5, 20 - Math.round(distressPercentage * 0.15));

      return {
        sentiment,
        positivePercentage,
        negativePercentage,
        distressPercentage,
        confidence: topScore,
        sentimentScore,
        raw: output,
      };
    }

    // ---- If your custom API returns the format directly ----
    if (output && output.sentiment) {
      return output as XLMroBERTaPrediction;
    }

    console.warn("[XLM-RoBERTa] Could not parse model output:", output);
    return null;
  } catch (err) {
    console.error("[XLM-RoBERTa] Model call failed:", err);
    return null;
  }
}

// =====================================================
// MAIN EXPORT
// =====================================================
export async function analyzeWithXLMRoBERTa(
  text: string | null,
  mood: string | null = null
): Promise<XLMroBERTaPrediction & { model: string }> {
  const preprocessed = preprocessText(text);
  const modelResult = await callModelAPI(preprocessed);
  if (modelResult) {
    return { ...modelResult, model: "xlm-roberta-finetuned" };
  }

  // FALLBACK to keyword-based analyzer
  const fallback = fallbackAnalyzeEntry(text, mood);
  return {
    sentiment: fallback.sentiment,
    positivePercentage: fallback.positivePercentage,
    negativePercentage: fallback.negativePercentage,
    distressPercentage: fallback.distressPercentage,
    confidence: 0.7,
    sentimentScore: fallback.sentimentScore,
    raw: null,
    model: "fallback-keyword",
  };
}

export async function analyzeWithXLMRoBERTaLegacy(
  text: string | null,
  mood: string | null = null
): Promise<AnalysisResult> {
  const xlm = await analyzeWithXLMRoBERTa(text, mood);
  const legacy = fallbackAnalyzeEntry(text, mood);
  return {
    sentiment: xlm.sentiment,
    sentimentScore: xlm.sentimentScore,
    positivePercentage: xlm.positivePercentage,
    negativePercentage: xlm.negativePercentage,
    distressPercentage: xlm.distressPercentage,
    emotions: legacy.emotions,
    keyPhrases: legacy.keyPhrases,
    feedback: legacy.feedback,
    reflection: legacy.reflection,
    suggestions: legacy.suggestions,
  };
}
