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
      const res = await fetch(
        `/api/aci?entryId=${encodeURIComponent(entryId)}`,
        { method: "GET", credentials: "same-origin", cache: "no-store" },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body?.error ?? `GET /api/aci returned ${res.status}`);
      }

      const data = await res.json() as { response?: StoredACIResponse | null };

      // Parse suggestions — DB returns a JSON array; ensure it's a plain string[]
      const row = data.response ?? null;
      if (row && !Array.isArray(row.suggestions)) {
        row.suggestions = [];
      }
      setResponse(row);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
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
      const res = await fetch("/api/aci", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(json?.error ?? `POST /api/aci returned ${res.status}`);
      }

      // POST returns the response directly; update state immediately
      const data = await res.json() as { response?: StoredACIResponse | null };
      const row = data.response ?? null;
      if (row && !Array.isArray(row.suggestions)) {
        row.suggestions = [];
      }
      setResponse(row);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[useAdaptiveResponse] regenerate error:", msg);
      setError(msg);
    } finally {
      setIsRegenerating(false);
    }
  }, [user, entryId]);

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
