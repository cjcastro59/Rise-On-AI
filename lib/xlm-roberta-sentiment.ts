import { type AnalysisResult, type Sentiment, analyzeEntry } from "@/lib/sentiment";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// SENTIMENT_MODEL_API_URL  = https://rise-on-ai-sentiment.onrender.com/predict
// HUGGINGFACE_API_KEY      = hf_xxxx (optional HF fallback)
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
// Text preprocessing — matches training-time preprocessing exactly
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
// Build prediction from [{label, score}] array
// ─────────────────────────────────────────────────────────────────────────────
function buildFromLabelScores(
  preds: Array<{ label: string; score: number }>,
): XLMroBERTaPrediction {
  const get   = (k: string) => preds.find(p => p.label.toLowerCase().includes(k))?.score ?? 0;
  const pos   = get("positive");
  const neg   = get("negative");
  const dst   = get("distress");
  const total = pos + neg + dst || 1;

  const posP  = Math.round((pos / total) * 100);
  const negP  = Math.round((neg / total) * 100);
  const dstP  = Math.max(0, 100 - posP - negP);

  let sentiment: Sentiment;
  if (dst >= pos && dst >= neg)   sentiment = "distress";
  else if (neg > pos)             sentiment = "negative";
  else                            sentiment = "positive";

  const top   = Math.max(pos, neg, dst);
  const score =
    sentiment === "positive" ? Math.round(50 + posP * 0.45) :
    sentiment === "negative" ? Math.round(50 - negP * 0.35) :
                               Math.max(5, 20 - Math.round(dstP * 0.15));

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

function parseOutput(output: unknown): XLMroBERTaPrediction | null {
  // Flat array: [{label, score}, ...]  ← our Render server returns this
  if (Array.isArray(output) && output.length > 0 && !Array.isArray(output[0]))
    return buildFromLabelScores(output as Array<{ label: string; score: number }>);
  // Nested: [[{label, score}, ...]]
  if (Array.isArray(output) && Array.isArray(output[0]))
    return buildFromLabelScores(output[0] as Array<{ label: string; score: number }>);
  // Direct object
  if (output && typeof output === "object" && "sentiment" in output)
    return output as XLMroBERTaPrediction;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Call the inference server (Render or HF Inference API)
// ─────────────────────────────────────────────────────────────────────────────
async function callModelAPI(text: string): Promise<XLMroBERTaPrediction | null> {
  if (!MODEL_API_URL || !text) return null;

  const isRenderServer = MODEL_API_URL.includes("render.com") || MODEL_API_URL.includes("onrender.com");
  const maxAttempts    = isRenderServer ? 3 : 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(MODEL_API_URL, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(HF_API_TOKEN && !isRenderServer
            ? { Authorization: `Bearer ${HF_API_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          inputs:  text,
          options: { wait_for_model: true, use_cache: false },
        }),
      });

      // Handle HF 503 cold start
      if (res.status === 503 && attempt < maxAttempts) {
        const waitMs = 3000 * attempt;
        console.warn(`[XLM-R] 503 attempt ${attempt}, waiting ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      if (!res.ok) {
        console.error(`[XLM-R] HTTP ${res.status} from model API`);
        return null;
      }

      const output = await res.json();

      // HF loading response: {"error": "...", "estimated_time": N}
      if (
        !Array.isArray(output) &&
        typeof output === "object" &&
        "error" in output &&
        "estimated_time" in output
      ) {
        if (attempt < maxAttempts) {
          const wait = Math.min(((output as { estimated_time: number }).estimated_time ?? 20) * 1000, 10000);
          console.warn(`[XLM-R] Model loading, waiting ${Math.round(wait / 1000)}s...`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        return null;
      }

      const parsed = parseOutput(output);
      if (parsed) {
        console.log(`[XLM-R] ✓ ${parsed.sentiment} pos=${parsed.positivePercentage}% neg=${parsed.negativePercentage}% dst=${parsed.distressPercentage}%`);
        return parsed;
      }

      console.warn("[XLM-R] Unexpected output:", JSON.stringify(output).slice(0, 200));
      return null;
    } catch (err) {
      console.error(`[XLM-R] attempt ${attempt} error:`, err instanceof Error ? err.message : err);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      return null;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeWithXLMRoBERTa(
  text: string | null,
  mood: string | null = null,
): Promise<XLMroBERTaPrediction & { model: string }> {
  const preprocessed = preprocessText(text);
  if (!preprocessed) {
    const fb = analyzeEntry(text, mood);
    return { ...fb, sentiment: fb.sentiment as Sentiment, confidence: 0.35, raw: null, model: "keyword-fallback" };
  }

  // 1. Call inference server (Render) or HF API
  const result = await callModelAPI(preprocessed);
  if (result) {
    const total = result.positivePercentage + result.negativePercentage + result.distressPercentage;
    const top   = Math.max(result.positivePercentage, result.negativePercentage, result.distressPercentage);
    return {
      ...result,
      confidence: total > 0 ? top / total : result.confidence,
      model:      "xlm-roberta-finetuned",
    };
  }

  // 2. Keyword fallback (Tagalog/English)
  console.warn("[XLM-R] Model unreachable — keyword fallback.");
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
