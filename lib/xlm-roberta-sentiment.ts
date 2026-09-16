/* eslint-disable */
import {
  type AnalysisResult,
  type Sentiment,
  analyzeEntry,
} from "@/lib/sentiment";
import fs   from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const HF_TOKEN   = process.env.HUGGINGFACE_API_KEY ?? "";
const REPO_ID    = "cjcastro/xlm-roberta-Rise-On-AI";
const HF_URL     = `https://huggingface.co/${REPO_ID}/resolve/main/onnx/model_quantized.onnx`;
const TMP_DIR    = "/tmp/xlm-roberta-onnx";
const MODEL_PATH = path.join(TMP_DIR, "model_quantized.onnx");

const TOKENIZER_FILES = [
  "tokenizer.json",
  "tokenizer_config.json",
  "sentencepiece.bpe.model",
  "special_tokens_map.json",
];

// ─────────────────────────────────────────────────────────────────────────────
// Module-level cache — survives warm Vercel invocations
// ─────────────────────────────────────────────────────────────────────────────
let _session:   unknown = null;
let _tokenizer: OnnxTokenizer | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Minimal BPE tokenizer
// ─────────────────────────────────────────────────────────────────────────────
class OnnxTokenizer {
  private vocab:  Map<string, number>;
  private merges: [string, string][];
  private unkId: number;
  private clsId: number;
  private sepId: number;
  private padId: number;
  private maxLen: number;

  constructor(tokenizerJson: Record<string, unknown>) {
    this.vocab = new Map();
    const model = tokenizerJson?.model as Record<string, unknown> | undefined;
    if (model?.vocab && typeof model.vocab === "object") {
      for (const [token, id] of Object.entries(model.vocab as Record<string, number>)) {
        this.vocab.set(token, id);
      }
    }
    const rawMerges = (model?.merges ?? []) as string[];
    this.merges = rawMerges.map(m => m.split(" ") as [string, string]);
    this.unkId  = this.vocab.get("<unk>") ?? 3;
    this.clsId  = this.vocab.get("<s>")   ?? 0;
    this.sepId  = this.vocab.get("</s>")  ?? 2;
    this.padId  = this.vocab.get("<pad>") ?? 1;
    this.maxLen = 256;
  }

  private bpe(token: string): number[] {
    let chars = token.split("").map((c, i) => (i === 0 ? "▁" + c : c));
    if (!chars.length) return [this.unkId];
    while (true) {
      let bestIdx = -1, bestRank = Infinity;
      for (let i = 0; i < chars.length - 1; i++) {
        const rank = this.merges.findIndex(([a, b]) => a === chars[i] && b === chars[i + 1]);
        if (rank !== -1 && rank < bestRank) { bestRank = rank; bestIdx = i; }
      }
      if (bestIdx === -1) break;
      chars = [...chars.slice(0, bestIdx), chars[bestIdx] + chars[bestIdx + 1], ...chars.slice(bestIdx + 2)];
    }
    return chars.map(c => this.vocab.get(c) ?? this.unkId);
  }

  encode(text: string): { inputIds: number[]; attentionMask: number[] } {
    const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const ids: number[] = [this.clsId];
    for (const w of words) { ids.push(...this.bpe(w)); if (ids.length >= this.maxLen - 1) break; }
    ids.push(this.sepId);
    const mask = ids.map(() => 1);
    while (ids.length < this.maxLen) { ids.push(this.padId); mask.push(0); }
    return { inputIds: ids.slice(0, this.maxLen), attentionMask: mask.slice(0, this.maxLen) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Download helper
// ─────────────────────────────────────────────────────────────────────────────
async function downloadFile(url: string, dest: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (HF_TOKEN) headers["Authorization"] = `Bearer ${HF_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

// ─────────────────────────────────────────────────────────────────────────────
// Load ONNX model + tokenizer (once per Vercel instance)
// ─────────────────────────────────────────────────────────────────────────────
async function ensureOnnxLoaded(): Promise<{ session: unknown; tokenizer: OnnxTokenizer } | null> {
  // Only works server-side (Node.js runtime)
  if (typeof window !== "undefined") return null;

  try {
    if (_session && _tokenizer) return { session: _session, tokenizer: _tokenizer };

    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

    // Download ONNX model to /tmp (Vercel's only writable dir)
    if (!fs.existsSync(MODEL_PATH)) {
      console.log("[XLM-R/onnx] Downloading model_quantized.onnx (~266MB)...");
      await downloadFile(HF_URL, MODEL_PATH);
      console.log("[XLM-R/onnx] Download complete ✓");
    }

    // Download tokenizer files
    for (const fname of TOKENIZER_FILES) {
      const dest = path.join(TMP_DIR, fname);
      if (!fs.existsSync(dest)) {
        await downloadFile(`https://huggingface.co/${REPO_ID}/resolve/main/${fname}`, dest);
      }
    }

    // Load tokenizer
    const tokJson = JSON.parse(fs.readFileSync(path.join(TMP_DIR, "tokenizer.json"), "utf-8"));
    _tokenizer    = new OnnxTokenizer(tokJson);

    // Load ONNX session via require() — keeps webpack from bundling .node binaries
    const ort  = require("onnxruntime-node");
    _session   = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all",
    });
    console.log("[XLM-R/onnx] Session ready ✓");
    return { session: _session, tokenizer: _tokenizer };
  } catch (err) {
    console.error("[XLM-R/onnx] Failed to load model:", err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Softmax
// ─────────────────────────────────────────────────────────────────────────────
function softmax(logits: number[]): number[] {
  const max  = Math.max(...logits);
  const exps = logits.map(x => Math.exp(x - max));
  const sum  = exps.reduce((a, b) => a + b, 0);
  return exps.map(x => x / sum);
}

const ONNX_LABELS: Record<number, string> = { 0: "positive", 1: "negative", 2: "distress" };

// ─────────────────────────────────────────────────────────────────────────────
// Run ONNX inference directly in-process (no HTTP call needed)
// ─────────────────────────────────────────────────────────────────────────────
async function runOnnxInference(text: string): Promise<XLMroBERTaPrediction | null> {
  const loaded = await ensureOnnxLoaded();
  if (!loaded) return null;

  const { session, tokenizer } = loaded;
  const ort = require("onnxruntime-node");

  const { inputIds, attentionMask } = tokenizer.encode(text);
  const len = inputIds.length;

  const feeds = {
    input_ids:      new ort.Tensor("int64", BigInt64Array.from(inputIds.map(BigInt)),      [1, len]),
    attention_mask: new ort.Tensor("int64", BigInt64Array.from(attentionMask.map(BigInt)), [1, len]),
  };

  const out    = await (session as any).run(feeds);
  const logits = Array.from(out["logits"].data as Float32Array);
  const probs  = softmax(logits);

  const preds  = probs.map((score, i) => ({ label: ONNX_LABELS[i] ?? String(i), score }));
  return buildFromLabelScores(preds);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared types + helpers
// ─────────────────────────────────────────────────────────────────────────────
export interface XLMroBERTaPrediction {
  sentiment:           Sentiment;
  positivePercentage:  number;
  negativePercentage:  number;
  distressPercentage:  number;
  confidence:          number;
  sentimentScore:      number;
  raw?:                unknown;
}

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

function buildFromLabelScores(preds: Array<{ label: string; score: number }>): XLMroBERTaPrediction {
  const get  = (key: string) => preds.find(p => p.label.toLowerCase().includes(key))?.score ?? 0;
  const pos  = get("positive");
  const neg  = get("negative");
  const dst  = get("distress");
  const total = pos + neg + dst || 1;

  const posP = Math.round((pos / total) * 100);
  const negP = Math.round((neg / total) * 100);
  const dstP = Math.max(0, 100 - posP - negP);

  let sentiment: Sentiment;
  if (dst >= pos && dst >= neg)   sentiment = "distress";
  else if (neg > pos)             sentiment = "negative";
  else                            sentiment = "positive";

  const top   = Math.max(pos, neg, dst);
  const score =
    sentiment === "positive"  ? Math.round(50 + posP * 0.45) :
    sentiment === "negative"  ? Math.round(50 - negP * 0.35) :
                                Math.max(5, 20 - Math.round(dstP * 0.15));

  return { sentiment, positivePercentage: posP, negativePercentage: negP,
           distressPercentage: dstP, confidence: top / total, sentimentScore: score, raw: preds };
}

function parseApiOutput(output: unknown): XLMroBERTaPrediction | null {
  if (Array.isArray(output) && output.length > 0 && !Array.isArray(output[0]))
    return buildFromLabelScores(output as Array<{ label: string; score: number }>);
  if (Array.isArray(output) && Array.isArray(output[0]))
    return buildFromLabelScores(output[0] as Array<{ label: string; score: number }>);
  if (output && typeof output === "object" && "sentiment" in output)
    return output as XLMroBERTaPrediction;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HF Inference API fallback
// ─────────────────────────────────────────────────────────────────────────────
const HF_MODEL_URL = process.env.SENTIMENT_MODEL_API_URL ?? "";

async function callHFApi(text: string): Promise<XLMroBERTaPrediction | null> {
  if (!HF_MODEL_URL || !text) return null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(HF_MODEL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {}),
        },
        body: JSON.stringify({ inputs: text, options: { wait_for_model: true, use_cache: false } }),
      });
      if (res.status === 503 && attempt < 3) { await new Promise(r => setTimeout(r, 3000 * attempt)); continue; }
      if (!res.ok) return null;
      const output = await res.json();
      if (!Array.isArray(output) && "error" in output && "estimated_time" in output) {
        if (attempt < 3) { await new Promise(r => setTimeout(r, Math.min((output as any).estimated_time * 1000, 8000))); continue; }
        return null;
      }
      return parseApiOutput(output);
    } catch { if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt)); }
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
    const fb = analyzeEntry(text, mood);
    return { ...fb, sentiment: fb.sentiment as Sentiment, confidence: 0.35, raw: null, model: "keyword-fallback" };
  }

  // 1. ONNX in-process (runs directly in Vercel Node.js — no HTTP call)
  try {
    const onnxResult = await runOnnxInference(preprocessed);
    if (onnxResult) {
      const total = onnxResult.positivePercentage + onnxResult.negativePercentage + onnxResult.distressPercentage;
      const top   = Math.max(onnxResult.positivePercentage, onnxResult.negativePercentage, onnxResult.distressPercentage);
      console.log(`[XLM-R/onnx] ✓ ${onnxResult.sentiment} (${Math.round(top/total*100)}% confidence)`);
      return { ...onnxResult, confidence: total > 0 ? top / total : onnxResult.confidence, model: "xlm-roberta-onnx" };
    }
  } catch (err) {
    console.warn("[XLM-R/onnx] inference failed:", err);
  }

  // 2. HF Inference API fallback
  try {
    const hfResult = await callHFApi(preprocessed);
    if (hfResult) {
      const total = hfResult.positivePercentage + hfResult.negativePercentage + hfResult.distressPercentage;
      const top   = Math.max(hfResult.positivePercentage, hfResult.negativePercentage, hfResult.distressPercentage);
      return { ...hfResult, confidence: total > 0 ? top / total : hfResult.confidence, model: "xlm-roberta-finetuned" };
    }
  } catch (err) {
    console.warn("[XLM-R/hf-api] failed:", err);
  }

  // 3. Keyword fallback
  console.warn("[XLM-R] All inference methods failed — keyword fallback.");
  const fb = analyzeEntry(text, mood);
  return {
    sentiment: fb.sentiment as Sentiment,
    positivePercentage: fb.positivePercentage,
    negativePercentage: fb.negativePercentage,
    distressPercentage: fb.distressPercentage,
    confidence: 0.35,
    sentimentScore: fb.sentimentScore,
    raw: null,
    model: "keyword-fallback",
  };
}

export async function analyzeWithXLMRoBERTaLegacy(
  text: string | null,
  mood: string | null = null,
): Promise<AnalysisResult> {
  const xlm = await analyzeWithXLMRoBERTa(text, mood);
  return {
    sentiment: xlm.sentiment, sentimentScore: xlm.sentimentScore,
    positivePercentage: xlm.positivePercentage, negativePercentage: xlm.negativePercentage,
    distressPercentage: xlm.distressPercentage,
    emotions: [], keyPhrases: [], feedback: "", reflection: "", suggestions: [],
  };
}
