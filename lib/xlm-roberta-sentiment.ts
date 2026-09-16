/* eslint-disable */
/**
 * xlm-roberta-sentiment.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Strategy (in order):
 *  1. ONNX in-process with PROPER @huggingface/transformers tokenizer
 *     → downloads model_quantized.onnx + tokenizer from HF into /tmp once
 *     → runs 24/7 on Vercel, accurate predictions, ~200-400ms warm
 *  2. HF Inference API fallback
 *  3. Keyword fallback (last resort)
 */

import { type AnalysisResult, type Sentiment, analyzeEntry } from "@/lib/sentiment";

// ── Config ────────────────────────────────────────────────────────────────────
const HF_TOKEN   = process.env.HUGGINGFACE_API_KEY ?? "";
const REPO_ID    = "cjcastro/xlm-roberta-Rise-On-AI";
const HF_API_URL = process.env.SENTIMENT_MODEL_API_URL ?? "";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface XLMroBERTaPrediction {
  sentiment:           Sentiment;
  positivePercentage:  number;
  negativePercentage:  number;
  distressPercentage:  number;
  confidence:          number;
  sentimentScore:      number;
  raw?:                unknown;
}

// ── Preprocessing (matches training-time) ────────────────────────────────────
export function preprocessText(input: string | null): string {
  if (!input) return "";
  let t = input.trim().replace(/\s+/g, " ").normalize("NFC").toLowerCase();
  t = t.replace(/<[^>]*>/g, " ").replace(/(https?:\/\/[^\s]+)/g, " ");
  t = t.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, " ");
  return t.trim();
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function softmax(logits: number[]): number[] {
  const max  = Math.max(...logits);
  const exps = logits.map(x => Math.exp(x - max));
  const sum  = exps.reduce((a, b) => a + b, 0);
  return exps.map(x => x / sum);
}

const LABELS: Record<number, string> = { 0: "positive", 1: "negative", 2: "distress" };

function buildFromScores(preds: Array<{ label: string; score: number }>): XLMroBERTaPrediction {
  const get   = (k: string) => preds.find(p => p.label.toLowerCase().includes(k))?.score ?? 0;
  const pos   = get("positive"), neg = get("negative"), dst = get("distress");
  const total = pos + neg + dst || 1;
  const posP  = Math.round((pos / total) * 100);
  const negP  = Math.round((neg / total) * 100);
  const dstP  = Math.max(0, 100 - posP - negP);
  let sentiment: Sentiment;
  if (dst >= pos && dst >= neg) sentiment = "distress";
  else if (neg > pos)           sentiment = "negative";
  else                          sentiment = "positive";
  const top   = Math.max(pos, neg, dst);
  const score = sentiment === "positive" ? Math.round(50 + posP * 0.45)
              : sentiment === "negative" ? Math.round(50 - negP * 0.35)
              : Math.max(5, 20 - Math.round(dstP * 0.15));
  return { sentiment, positivePercentage: posP, negativePercentage: negP,
           distressPercentage: dstP, confidence: top / total, sentimentScore: score, raw: preds };
}

// ── ONNX in-process inference ─────────────────────────────────────────────────
// Module-level cache — survives warm Vercel function invocations
let _pipeline: any = null;
let _pipelineLoading = false;
let _pipelineError: string | null = null;

async function getOnnxPipeline(): Promise<any | null> {
  if (typeof window !== "undefined") return null;  // server-side only
  if (_pipeline) return _pipeline;
  if (_pipelineError) return null;   // don't retry a known failure
  if (_pipelineLoading) {
    // Wait up to 55s for concurrent cold start
    for (let i = 0; i < 55; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (_pipeline) return _pipeline;
      if (_pipelineError) return null;
    }
    return null;
  }

  _pipelineLoading = true;
  try {
    console.log("[XLM-R/onnx] Loading pipeline with @huggingface/transformers...");

    // @huggingface/transformers v3 works in Node.js with ONNX Runtime
    // It handles the real SentencePiece tokenizer automatically
    const { pipeline, env } = await import("@huggingface/transformers");

    // Cache models in /tmp (Vercel's writable dir)
    env.cacheDir = "/tmp/hf-cache";
    env.allowRemoteModels = true;

    // Use the quantized ONNX model directly from HF
    // The ONNX file is at: cjcastro/xlm-roberta-Rise-On-AI/onnx/model_quantized.onnx
    _pipeline = await pipeline(
      "text-classification",
      REPO_ID,
      {
        dtype: "q8",          // use quantized INT8 weights
        model_file_name: "onnx/model_quantized",
        top_k: null,          // return all labels
        device: "cpu",
      } as any,
    );

    console.log("[XLM-R/onnx] Pipeline ready ✓");
    _pipelineLoading = false;
    return _pipeline;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[XLM-R/onnx] Pipeline load failed:", msg);
    _pipelineError = msg;
    _pipelineLoading = false;
    return null;
  }
}

async function runOnnxInference(text: string): Promise<XLMroBERTaPrediction | null> {
  try {
    const pipe = await getOnnxPipeline();
    if (!pipe) return null;

    const result = await pipe(text, { top_k: null });
    // result is [{label: "positive", score: 0.91}, ...]
    const preds = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
    if (!preds.length) return null;

    const out = buildFromScores(preds as Array<{ label: string; score: number }>);
    console.log(`[XLM-R/onnx] ✓ ${out.sentiment} pos=${out.positivePercentage}% neg=${out.negativePercentage}% dst=${out.distressPercentage}%`);
    return out;
  } catch (err) {
    console.warn("[XLM-R/onnx] inference error:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── HF Inference API fallback ─────────────────────────────────────────────────
function parseApiOutput(output: unknown): XLMroBERTaPrediction | null {
  if (Array.isArray(output) && output.length > 0 && !Array.isArray(output[0]))
    return buildFromScores(output as Array<{ label: string; score: number }>);
  if (Array.isArray(output) && Array.isArray(output[0]))
    return buildFromScores(output[0] as Array<{ label: string; score: number }>);
  if (output && typeof output === "object" && "sentiment" in output)
    return output as XLMroBERTaPrediction;
  return null;
}

async function callHFApi(text: string): Promise<XLMroBERTaPrediction | null> {
  if (!HF_API_URL || !text) return null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(HF_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {}),
        },
        body: JSON.stringify({ inputs: text, options: { wait_for_model: true, use_cache: false } }),
      });
      if (res.status === 503 && attempt < 3) {
        await new Promise(r => setTimeout(r, 3000 * attempt)); continue;
      }
      if (!res.ok) return null;
      const output = await res.json();
      if (!Array.isArray(output) && "error" in output && "estimated_time" in output) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, Math.min((output as any).estimated_time * 1000, 8000)));
          continue;
        }
        return null;
      }
      const parsed = parseApiOutput(output);
      if (parsed) console.log(`[XLM-R/hf-api] ✓ ${parsed.sentiment}`);
      return parsed;
    } catch { if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt)); }
  }
  return null;
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export async function analyzeWithXLMRoBERTa(
  text: string | null,
  mood: string | null = null,
): Promise<XLMroBERTaPrediction & { model: string }> {
  const preprocessed = preprocessText(text);
  if (!preprocessed) {
    const fb = analyzeEntry(text, mood);
    return { ...fb, sentiment: fb.sentiment as Sentiment, confidence: 0.35, raw: null, model: "keyword-fallback" };
  }

  // 1. ONNX in-process with proper tokenizer (accurate, 24/7)
  const onnxResult = await runOnnxInference(preprocessed);
  if (onnxResult) {
    const total = onnxResult.positivePercentage + onnxResult.negativePercentage + onnxResult.distressPercentage;
    const top   = Math.max(onnxResult.positivePercentage, onnxResult.negativePercentage, onnxResult.distressPercentage);
    return { ...onnxResult, confidence: total > 0 ? top / total : onnxResult.confidence, model: "xlm-roberta-onnx" };
  }

  // 2. HF Inference API fallback
  const hfResult = await callHFApi(preprocessed);
  if (hfResult) {
    const total = hfResult.positivePercentage + hfResult.negativePercentage + hfResult.distressPercentage;
    const top   = Math.max(hfResult.positivePercentage, hfResult.negativePercentage, hfResult.distressPercentage);
    return { ...hfResult, confidence: total > 0 ? top / total : hfResult.confidence, model: "xlm-roberta-finetuned" };
  }

  // 3. Last resort keyword fallback
  console.warn("[XLM-R] All inference failed — keyword fallback.");
  const fb = analyzeEntry(text, mood);
  return {
    sentiment: fb.sentiment as Sentiment,
    positivePercentage: fb.positivePercentage,
    negativePercentage: fb.negativePercentage,
    distressPercentage: fb.distressPercentage,
    confidence: 0.35, sentimentScore: fb.sentimentScore, raw: null,
    model: "keyword-fallback",
  };
}

export async function analyzeWithXLMRoBERTaLegacy(
  text: string | null, mood: string | null = null,
): Promise<AnalysisResult> {
  const xlm = await analyzeWithXLMRoBERTa(text, mood);
  return {
    sentiment: xlm.sentiment, sentimentScore: xlm.sentimentScore,
    positivePercentage: xlm.positivePercentage, negativePercentage: xlm.negativePercentage,
    distressPercentage: xlm.distressPercentage,
    emotions: [], keyPhrases: [], feedback: "", reflection: "", suggestions: [],
  };
}
