"use client";

// =====================================================================
// hooks/useAdaptiveResponse.ts  —  Phase 4.4
// =====================================================================
//
// Fetches a stored ACI response for a specific journal entry from
// GET /api/aci?entryId=<uuid>.
//
// DATA FLOW
// ─────────
//   journal save → sentiment/analyze → (fire-and-forget)
//     → behavioral+wellness → DRI → ACI → aci_responses table
//   → this hook reads the stored row via GET /api/aci?entryId=
//
// If no stored response exists yet (entry was just saved and the
// fire-and-forget chain hasn't completed), the hook:
//   1. Returns loading=true on mount
//   2. Returns hasResponse=false when no row found
//   3. Exposes regenerate() which POSTs to /api/aci to trigger
//      on-demand generation if the automatic chain missed it
//
// DISCLAIMER: ACI responses are for reflection support only.
// They do not constitute clinical advice or professional counseling.
// =====================================================================

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { ACIResponseCategory, ACIResponseTone } from "@/lib/adaptive-response";
import type { SentimentLabel } from "@/lib/behavioral-analytics";
import type { WellnessLevel } from "@/lib/wellness-assessment";
import type { DistressRiskLevel } from "@/lib/distress-risk";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StoredACIResponse {
  id: string;
  user_id: string;
  journal_entry_id: string | null;

  // ACI output
  response_category: ACIResponseCategory;
  tone: ACIResponseTone;
  greeting: string;
  message: string;
  reflection: string;
  suggestions: string[];
  crisis_note: string | null;
  disclaimer: string;

  // Context snapshot
  context_used: {
    sentiment:  SentimentLabel;
    wellnessScore: number | null;
    wellnessLevel: WellnessLevel | null;
    distressRiskLevel: DistressRiskLevel | null;
    behavioralTrendScore: number;
    consecutiveNegativeCount: number;
  } | null;

  // Metadata
  generated_at: string;
  updated_at: string;
}

export interface UseAdaptiveResponseResult {
  /** The stored ACI response row, or null if not yet generated. */
  response: StoredACIResponse | null;
  /** Initial fetch in progress. */
  loading: boolean;
  /** regenerate() POST call in progress. */
  isRegenerating: boolean;
  /** True when a stored row exists. */
  hasResponse: boolean;
  /** Last error message, or null. */
  error: string | null;
  /**
   * Re-fetch the stored row without triggering re-generation.
   * Useful for polling shortly after a journal save to pick up the
   * fire-and-forget result once it lands.
   */
  refetch: () => void;
  /**
   * POST /api/aci — triggers on-demand generation and persists the result.
   * Use when the automatic chain hasn't run yet, or to force a refresh
   * after new behavioral/wellness/risk data is available.
   */
  regenerate: () => Promise<void>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param entryId  Journal entry UUID to fetch/generate a response for.
 *                 Pass null/undefined to skip fetching.
 */
const ACI_REQUEST_TIMEOUT_MS = 20_000;

const VALID_CATEGORIES = new Set<ACIResponseCategory>(["positive", "negative", "distress"]);
const VALID_TONES = new Set<ACIResponseTone>([
  "sustained_growth",
  "positive_vigilant",
  "positive_default",
  "extended_streak",
  "declining_trend",
  "at_risk_wellness",
  "negative_default",
  "critical_safety",
  "high_risk_urgent",
  "distress_support",
]);

function safeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function safeSuggestions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function normalizeStoredACIResponse(value: unknown): StoredACIResponse | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const category = VALID_CATEGORIES.has(row.response_category as ACIResponseCategory)
    ? (row.response_category as ACIResponseCategory)
    : "positive";
  const tone = VALID_TONES.has(row.tone as ACIResponseTone)
    ? (row.tone as ACIResponseTone)
    : "positive_default";

  return {
    ...(row as unknown as StoredACIResponse),
    id: safeText(row.id),
    user_id: safeText(row.user_id),
    journal_entry_id: row.journal_entry_id === null ? null : safeText(row.journal_entry_id),
    response_category: category,
    tone,
    greeting: safeText(row.greeting, "Thanks for checking in."),
    message: safeText(row.message, "Your adaptive response is not available yet. Please try generating it again."),
    reflection: safeText(row.reflection),
    suggestions: safeSuggestions(row.suggestions),
    crisis_note: row.crisis_note === null ? null : safeText(row.crisis_note),
    disclaimer: safeText(
      row.disclaimer,
      "This response is for self-reflection only and does not replace professional support.",
    ),
    context_used: row.context_used && typeof row.context_used === "object"
      ? (row.context_used as StoredACIResponse["context_used"])
      : null,
    generated_at: safeText(row.generated_at),
    updated_at: safeText(row.updated_at),
  };
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ACI_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "AI response request timed out. Please try again.";
  }
  return error instanceof Error ? error.message : "Unknown error";
}

export function useAdaptiveResponse(
  entryId: string | null | undefined,
): UseAdaptiveResponseResult {
  const { user } = useAuth();

  const [response, setResponse] = useState<StoredACIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch stored row ───────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    if (!user || !entryId) {
      setResponse(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetchWithTimeout(
        `/api/aci?entryId=${encodeURIComponent(entryId)}`,
        { method: "GET", credentials: "same-origin", cache: "no-store" },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body?.error ?? `GET /api/aci returned ${res.status}`);
      }

      const data = await res.json() as { response?: unknown };
      const row = normalizeStoredACIResponse(data.response ?? null);
      setResponse(row);
    } catch (err) {
      const msg = errorMessage(err);
      console.error("[useAdaptiveResponse] fetch error:", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, entryId]);

  // ── On-demand regeneration ─────────────────────────────────────────────────
  const regenerate = useCallback(async (): Promise<void> => {
    if (!user || !entryId) return;
    setIsRegenerating(true);
    setError(null);

    try {
      const res = await fetchWithTimeout("/api/aci", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });

      if (!res.ok && res.status !== 207) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(json?.error ?? `POST /api/aci returned ${res.status}`);
      }

      // POST now returns the persisted DB row (snake_case StoredACIResponse).
      // On a 207 the row may be null — fall back to a GET refetch in that case.
      const data = await res.json() as { ok: boolean; response?: unknown };
      const row = normalizeStoredACIResponse(data.response ?? null);

      if (row) {
        setResponse(row);
      } else {
        // Generation succeeded but re-fetch failed server-side — poll once.
        await refetch();
      }
    } catch (err) {
      const msg = errorMessage(err);
      console.error("[useAdaptiveResponse] regenerate error:", msg);
      setError(msg);
    } finally {
      setIsRegenerating(false);
    }
  }, [user, entryId, refetch]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    response,
    loading,
    isRegenerating,
    hasResponse: response !== null,
    error,
    refetch,
    regenerate,
  };
}
