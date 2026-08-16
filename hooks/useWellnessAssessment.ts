"use client";

// =====================================================================
// hooks/useWellnessAssessment.ts  —  Phase 4.2
// =====================================================================
//
// Fetches stored wellness data from GET /api/wellness.
// Provides:
//   latest          — most recent stored row (null if none)
//   history         — last N rows ordered newest-first (for trend charts)
//   loading         — initial fetch in progress
//   isRecalculating — POST /api/wellness recompute in progress
//   hasData         — true when at least one row exists
//   error           — last error message, if any
//   triggerRecalculate() — POST /api/wellness to force fresh computation
//
// DATA FLOW
// ─────────
//   journal save → sentiment/analyze → (fire-and-forget) recompute
//   → behavioral_indicators row updated with wellness_score +
//     wellness_level + wellness_score_details
//   → this hook reads those rows via GET /api/wellness
//
// The hook re-fetches whenever userId or lookbackDays changes.
// Call triggerRecalculate() to force a fresh computation on demand
// (e.g. when the user opens the Insights page after adding entries).
// =====================================================================

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { WellnessLevel, WellnessScoreDetails } from "@/lib/wellness-assessment";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WellnessHistoryRow {
  id: string;
  user_id: string;

  // Window metadata
  window_end_date: string;   // "YYYY-MM-DD"
  lookback_days: number;

  // 4 indicator input values used for this computation
  behavioral_trend_score: number;
  journaling_frequency_score: number;
  mood_consistency_score: number;
  consecutive_negative_count: number;

  // Wellness Assessment outputs
  wellness_score: number | null;
  wellness_level: WellnessLevel | null;
  wellness_score_details: WellnessScoreDetails | null;

  // Metadata
  entries_analyzed: number;
  computed_at: string;
  updated_at: string;
}

export interface UseWellnessAssessmentResult {
  /** Most recently stored row, or null when no data exists yet. */
  latest: WellnessHistoryRow | null;
  /**
   * Historical rows, newest-first.
   * Use `historyLimit` to control how many are returned (default 90).
   */
  history: WellnessHistoryRow[];
  /** Initial data fetch is in progress. */
  loading: boolean;
  /** POST /api/wellness recompute is in progress. */
  isRecalculating: boolean;
  /** True when at least one stored row exists. */
  hasData: boolean;
  /** Last error message from either fetch or recalculate, or null. */
  error: string | null;
  /** Re-fetch stored data without triggering a recompute. */
  refetch: () => void;
  /**
   * POST /api/wellness — forces a fresh full computation from journal data
   * and persists the result.  Sets isRecalculating while running.
   * After completion, calls refetch() automatically.
   */
  triggerRecalculate: () => Promise<void>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param lookbackDays   Window that was used when computing. Default: 30.
 * @param historyLimit   Max rows returned for trend charts. Default: 90.
 * @param targetUserId   Only pass for admin/counselor viewing another user.
 */
export function useWellnessAssessment(
  lookbackDays: number = 30,
  historyLimit: number = 90,
  targetUserId?: string,
): UseWellnessAssessmentResult {
  const { user } = useAuth();

  const [latest, setLatest] = useState<WellnessHistoryRow | null>(null);
  const [history, setHistory] = useState<WellnessHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch stored rows from GET /api/wellness ────────────────────────────
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
        limit: String(Math.max(1, Math.min(90, historyLimit))),
      });
      if (targetUserId && targetUserId !== user.id) {
        params.set("userId", targetUserId);
      }

      const res = await fetch(`/api/wellness?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body?.error ?? `GET /api/wellness returned ${res.status}`);
      }

      const data = await res.json() as {
        history?: WellnessHistoryRow[];
      };
      const rows = data.history ?? [];
      setHistory(rows);
      setLatest(rows[0] ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[useWellnessAssessment] fetch error:", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, lookbackDays, historyLimit, targetUserId]);

  // ── POST /api/wellness — on-demand recompute ────────────────────────────
  const triggerRecalculate = useCallback(async (): Promise<void> => {
    if (!user) return;
    setIsRecalculating(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { lookbackDays };
      if (targetUserId && targetUserId !== user.id) {
        body.userId = targetUserId;
      }

      const res = await fetch("/api/wellness", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(json?.error ?? `POST /api/wellness returned ${res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[useWellnessAssessment] recalculate error:", msg);
      setError(msg);
    } finally {
      setIsRecalculating(false);
      // Always re-fetch after recompute, regardless of success/failure
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
