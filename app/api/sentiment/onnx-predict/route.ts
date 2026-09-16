/* eslint-disable */
/**
 * /api/sentiment/onnx-predict
 * Runs XLM-RoBERTa ONNX model locally on Vercel Node.js runtime.
 * Cold start: downloads model_quantized.onnx (~266MB) from HF into /tmp.
 * Warm calls: session cached in module scope → ~200-400ms.
 */

import { NextRequest, NextResponse } from "next/server";
import fs   from "fs";
import path from "path";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 60;

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

let _session:   unknown = null;
let _tokenizer: TokenizerWrapper | null = null;

class TokenizerWrapper {
  private vocab:  Map<string, number>;
  private merges: [string, string][];
  private unkId: number;
  private clsId: number;
  private sepId: number;
  private padId: number;
  private maxLen: number;

  constructor(tokenizerJson: Record<string, unknown>) {
    this.vocab  = new Map();
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
    if (chars.length === 0) return [this.unkId];
    while (true) {
      let bestIdx  = -1;
      let bestRank = Infinity;
      for (let i = 0; i < chars.length - 1; i++) {
        const rank = this.merges.findIndex(([a, b]) => a === chars[i] && b === chars[i + 1]);
        if (rank !== -1 && rank < bestRank) { bestRank = rank; bestIdx = i; }
      }
      if (bestIdx === -1) break;
      const merged = chars[bestIdx] + chars[bestIdx + 1];
      chars = [...chars.slice(0, bestIdx), merged, ...chars.slice(bestIdx + 2)];
    }
    return chars.map(c => this.vocab.get(c) ?? this.unkId);
  }

  encode(text: string): { inputIds: number[]; attentionMask: number[] } {
    const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const ids: number[] = [this.clsId];
    for (const word of words) {
      ids.push(...this.bpe(word));
      if (ids.length >= this.maxLen - 1) break;
    }
    ids.push(this.sepId);
    const attMask = ids.map(() => 1);
    while (ids.length < this.maxLen) { ids.push(this.padId); attMask.push(0); }
    return { inputIds: ids.slice(0, this.maxLen), attentionMask: attMask.slice(0, this.maxLen) };
  }
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (HF_TOKEN) headers["Authorization"] = `Bearer ${HF_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function ensureLoaded() {
  if (_session && _tokenizer) return { session: _session, tokenizer: _tokenizer };

  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

  if (!fs.existsSync(MODEL_PATH)) {
    console.log("[onnx-predict] Downloading model (~266 MB)…");
    await downloadFile(HF_URL, MODEL_PATH);
    console.log("[onnx-predict] Model downloaded ✓");
  }

  for (const fname of TOKENIZER_FILES) {
    const dest = path.join(TMP_DIR, fname);
    if (!fs.existsSync(dest)) {
      await downloadFile(`https://huggingface.co/${REPO_ID}/resolve/main/${fname}`, dest);
    }
  }

  const tokJson = JSON.parse(fs.readFileSync(path.join(TMP_DIR, "tokenizer.json"), "utf-8"));
  _tokenizer    = new TokenizerWrapper(tokJson);

  // Use require() so webpack never sees this import and won't try to bundle .node binaries
  const ort  = require("onnxruntime-node");
  _session   = await ort.InferenceSession.create(MODEL_PATH, {
    executionProviders:     ["cpu"],
    graphOptimizationLevel: "all",
  });
  console.log("[onnx-predict] Session ready ✓");
  return { session: _session, tokenizer: _tokenizer };
}

function softmax(logits: number[]): number[] {
  const max  = Math.max(...logits);
  const exps = logits.map(x => Math.exp(x - max));
  const sum  = exps.reduce((a, b) => a + b, 0);
  return exps.map(x => x / sum);
}

const LABELS: Record<number, string> = { 0: "positive", 1: "negative", 2: "distress" };

export async function POST(req: NextRequest) {
  try {
    const { inputs } = (await req.json()) as { inputs?: string };
    if (!inputs?.trim()) return NextResponse.json({ error: "Empty input" }, { status: 400 });

    const { session, tokenizer } = await ensureLoaded();
    const ort = require("onnxruntime-node");

    const { inputIds, attentionMask } = (tokenizer as TokenizerWrapper).encode(inputs);
    const len = inputIds.length;

    const feeds = {
      input_ids:      new ort.Tensor("int64", BigInt64Array.from(inputIds.map(BigInt)),      [1, len]),
      attention_mask: new ort.Tensor("int64", BigInt64Array.from(attentionMask.map(BigInt)), [1, len]),
    };

    const out    = await (session as any).run(feeds);
    const logits = Array.from(out["logits"].data as Float32Array);
    const probs  = softmax(logits);
    const result = probs
      .map((score, i) => ({ label: LABELS[i] ?? String(i), score }))
      .sort((a, b) => b.score - a.score);

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[onnx-predict] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status:       "ok",
    modelCached:  fs.existsSync(MODEL_PATH),
    sessionReady: _session !== null,
  });
}
