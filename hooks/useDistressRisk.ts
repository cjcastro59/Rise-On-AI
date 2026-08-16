"use client";

// =====================================================================
// hooks/useDistressRisk.ts  —  Phase 4.3
// =====================================================================
//
// Fetches stored Distress Risk Indicator assessments for the
// authenticated user from GET /api/distress-risk.
//
// Exposes:
//   latest           — most recent stored row (null if none)
//   history          — last N rows, newest-first (for trend charts)
//   loading          — initial fetch in progress
//   isRecalculating  — POST /api/distress-risk in progress
//   hasData          — true when at least one row exists
//   error            — last error message, or null
//   refetch()        — re-fetch stored data without recomputing
//   triggerRecalculate() — POST to force fresh computation + persist
//
// DISCLAIMER:
//   The DRI is a decision-support indicator only.
//   It is NOT a clinical diagnosis.
// =====================================================================

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { DistressRiskLevel, DistressRiskDetails } from "@/lib/distress-risk";
import type { SentimentLabel } from "@/lib/behavioral-analytics";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DistressRiskRow {
  id: string;
  user_id: string;

  // Window
  assessed_date: string;       // "YYYY-MM-DD"
  lookback_days: number;

  // DRI output
  risk_level: DistressRiskLevel;
  total_points: number;

  // Input snapshot
  latest_sentiment: SentimentLabel | null;
  behavioral_trend_score: number | null;
  consecutive_negative_count: number | null;
  wellness_score: number | null;
  total_entries_window: number | null;
  distress_entries_window: number | null;

  // Full breakdown
  condition_results: DistressRiskDetails["conditions"] | null;
  assessment_details: DistressRiskDetails | null;

  // Metadata
  assessed_at: string;
  updated_at: string;
}

export interface UseDistressRiskResult {
  /** Most recent stored row, or null if not yet computed. */
  latest: DistressRiskRow | null;
  /** Historical rows, newest-first. */
  history: DistressRiskRow[];
  /** Initial fetch in progress. */
  loading: boolean;
  /** POST /api/distress-risk recompute in progress. */
  isRecalculating: boolean;
  /** True when at least one row exists. */
  hasData: boolean;
  /** Last error message, or null. */
  error: string | null;
  /** Re-fetch stored rows without triggering recompute. */
  refetch: () => void;
  /**
   * POST /api/distress-risk — forces fresh computation and persists.
   * Automatically calls refetch() after completion.
   */
  triggerRecalculate: () => Promise<void>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param lookbackDays   Window used when computing. Default: 30.
 * @param historyLimit   Max rows for trend view. Default: 30.
 * @param targetUserId   Admin/counselor only — omit for own data.
 */
export function useDistressRisk(
  lookbackDays: number = 30,
  historyLimit: number = 30,
  targetUserId?: string,
): UseDistressRiskResult {
  const { user } = useAuth();

  const [latest, setLatest] = useState<DistressRiskRow | null>(null);
  const [history, setHistory] = useState<DistressRiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch stored rows ──────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    if (!user) {
      setLatest(null);
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        lookbackDays: String(Math.max(1, Math.min(365, lookbackDays))),
        limit: String(Math.max(1, Math.min(90,  historyLimit))),
      });
      if (targetUserId && targetUserId !== user.id) {
        params.set("userId", targetUserId);
      }

      const res = await fetch(`/api/distress-risk?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body?.error ?? `GET /api/distress-risk returned ${res.status}`);
      }

      const data = await res.json() as { history?: DistressRiskRow[] };
      const rows = data.history ?? [];
      setHistory(rows);
      setLatest(rows[0] ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[useDistressRisk] fetch error:", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, lookbackDays, historyLimit, targetUserId]);

  // ── Recompute on demand ────────────────────────────────────────────────────
  const triggerRecalculate = useCallback(async (): Promise<void> => {
    if (!user) return;
    setIsRecalculating(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { lookbackDays };
      if (targetUserId && targetUserId !== user.id) body.userId = targetUserId;

      const res = await fetch("/api/distress-risk", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(json?.error ?? `POST /api/distress-risk returned ${res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[useDistressRisk] recalculate error:", msg);
      setError(msg);
    } finally {
      setIsRecalculating(false);
      await refetch();
    }
  }, [user, lookbackDays, targetUserId, refetch]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    latest,
    history,
    loading,
    isRecalculating,
    hasData: latest !== null,
    error,
    refetch,
    triggerRecalculate,
  };
}
