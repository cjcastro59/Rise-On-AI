import { NextRequest, NextResponse } from "next/server";
import {
  preprocessText,
  analyzeWithXLMRoBERTa,
} from "@/lib/xlm-roberta-sentiment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// OPTIMIZATION 1: IN-MEMORY LRU CACHE
// Avoids re-analyzing identical text (uses sha256 hash of normalized text)
// =====================================================
const CACHE_MAX_SIZE = 512;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

type CacheEntry = {
  value: PredictionResult;
  createdAt: number;
};

const lruCache = new Map<string, CacheEntry>();

function cacheKey(processedText: string, mood: string | null | undefined): string {
  return `${mood ?? ""}|${processedText}`;
}

function cacheGet(key: string): PredictionResult | null {
  const entry = lruCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    lruCache.delete(key);
    return null;
  }
  // Promote to most recently used
  lruCache.delete(key);
  lruCache.set(key, entry);
  return entry.value;
}

function cacheSet(key: string, value: PredictionResult): void {
  const entry: CacheEntry = { value, createdAt: Date.now() };
  if (lruCache.size >= CACHE_MAX_SIZE) {
    // Evict oldest (first key in insertion order)
    const oldestKey = lruCache.keys().next().value;
    if (oldestKey !== undefined) lruCache.delete(oldestKey);
  }
  lruCache.set(key, entry);
}

// =====================================================
// REQUEST / RESPONSE TYPES
// =====================================================
type PredictionResult = {
  sentiment: "positive" | "negative" | "distress";
  positivePercentage: number;
  negativePercentage: number;
  distressPercentage: number;
  confidence: number;
  sentimentScore: number;
  model: string;
  cached?: boolean;
  latencyMs?: number;
};

interface PredictRequest {
  // Single mode
  text?: string | null;
  title?: string | null;
  content?: string | null;
  mood?: string | null;
  // Batch mode
  items?: Array<{
    title?: string | null;
    content?: string | null;
    mood?: string | null;
    text?: string | null;
  }>;
}

// =====================================================
// OPTIMIZATION 2: Fast hash function for cache key
// Uses Node.js crypto (fast, built-in)
// =====================================================
import { createHash } from "node:crypto";

function quickHash(input: string): string {
  return createHash("sha256").update(input).digest("base64url").slice(0, 16);
}

// =====================================================
// HELPERS
// =====================================================
function buildText(req: { title?: string | null; content?: string | null; text?: string | null }): string {
  if (req.text) return req.text;
  return [req.title, req.content].filter(Boolean).join("\n\n");
}

async function analyzeOne(
  rawText: string,
  mood: string | null
): Promise<PredictionResult> {
  const preprocessed = preprocessText(rawText);
  if (!preprocessed) return {
    sentiment: "positive",
    positivePercentage: 0,
    negativePercentage: 0,
    distressPercentage: 0,
    confidence: 0.5,
    sentimentScore: 50,
    model: "empty",
  };

  const start = performance.now();
  const xlm = await analyzeWithXLMRoBERTa(rawText, mood);
  const latencyMs = Math.round(performance.now() - start);

  return {
    sentiment: xlm.sentiment,
    positivePercentage: xlm.positivePercentage,
    negativePercentage: xlm.negativePercentage,
    distressPercentage: xlm.distressPercentage,
    confidence: xlm.confidence,
    sentimentScore: xlm.sentimentScore,
    model: xlm.model,
    latencyMs,
  };
}

// =====================================================
// MAIN HANDLER
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PredictRequest;

    // ---- BATCH MODE ----
    if (Array.isArray(body.items) && body.items.length > 0) {
      // Limit batch size to prevent timeouts!
      const items = body.items.slice(0, 50);
      const results = new Array<PredictionResult>(items.length);

      // OPTIMIZATION 3: Process up to 4 items CONCURRENTLY (controlled parallelism)
      const CONCURRENCY = 4;
      let cursor = 0;

      async function worker() {
        while (cursor < items.length) {
          const myIdx = cursor++;
          const item = items[myIdx];
          const rawText = buildText(item);
          const key = quickHash(cacheKey(preprocessText(rawText), item.mood));

          const cached = cacheGet(key);
          if (cached) {
            results[myIdx] = { ...cached, cached: true };
            continue;
          }

          const prediction = await analyzeOne(rawText, item.mood ?? null);
          cacheSet(key, prediction);
          results[myIdx] = prediction;
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker())
      );

      return NextResponse.json({
        ok: true,
        batch: true,
        count: results.length,
        results,
      });
    }

    // ---- SINGLE MODE ----
    const rawText = buildText(body);
    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "Missing 'text' (or 'title'/'content'). Nothing to analyze." },
        { status: 400 }
      );
    }

    const key = quickHash(cacheKey(preprocessText(rawText), body.mood));

    const cached = cacheGet(key);
    if (cached) {
      return NextResponse.json({ ok: true, ...cached, cached: true });
    }

    const prediction = await analyzeOne(rawText, body.mood ?? null);
    cacheSet(key, prediction);

    return NextResponse.json({ ok: true, ...prediction });
  } catch (err: any) {
    console.error("[sentiment/predict] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/sentiment/predict",
    cacheSize: lruCache.size,
    cacheMaxSize: CACHE_MAX_SIZE,
    cacheTtlMs: CACHE_TTL_MS,
    message:
      "POST here with { text } or { title, content, mood } or { items: [...] } for batch",
  });
}
