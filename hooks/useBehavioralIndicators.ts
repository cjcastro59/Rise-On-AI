"use client";

// =====================================================================
// hooks/useBehavioralIndicators.ts  —  Phase 4.1
// =====================================================================
// Fetches the latest stored behavioral indicators for the current user
// from GET /api/behavioral.
//
// DATA FLOW
// ─────────
// 1. On mount (and whenever `userId` or `lookbackDays` changes) the hook
//    calls GET /api/behavioral?lookbackDays=N.
// 2. The API returns the most-recently-stored row from behavioral_indicators.
//    If no row exists yet, `latest` is null and `hasData` is false.
// 3. `refetch()` can be called imperatively (e.g. right after a journal save).
//
// TYPES
// ─────
// The returned `latest` row shape mirrors the behavioral_indicators DB row
// exactly, with all four indicator scores, sub-details, and the wellness
// score / level added in Phase 4.1.
// =====================================================================

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { WellnessLevel } from "@/lib/wellness-assessment";

// ── Public interface ─────────────────────────────────────────────────────────

export interface BehavioralIndicatorsRow {
  id: string;
  user_id: string;

  // Window
  window_end_date: string;     // "YYYY-MM-DD"
  lookback_days: number;

  // Indicator 1 — Behavioral Trend Score  −100 to +100
  behavioral_trend_score: number;
  behavioral_trend_details: Record<string, unknown> | null;

  // Indicator 2 — Journaling Frequency  0–100
  journaling_frequency_score: number;
  total_entries_window: number;
  unique_days_journaled: number;
  journaling_frequency_details: Record<string, unknown> | null;

  // Indicator 3 — Mood Consistency  0–100
  mood_consistency_score: number;
  sentiment_scores_variance: number | null;
  sentiment_scores_std: number | null;
  mood_consistency_details: Record<string, unknown> | null;

  // Indicator 4 — Consecutive Negative Entries
  consecutive_negative_count: number;
  consecutive_negative_streak: Record<string, unknown> | null;

  // Wellness Score  0.00–10.00
  wellness_score: number | null;
  wellness_level: WellnessLevel | null;
  wellness_score_details: Record<string, unknown> | null;

  // Metadata
  entries_analyzed: number;
  computed_at: string;
  updated_at: string;
}

export interface UseBehavioralIndicatorsResult {
  /** Most recent stored row, or null if not yet computed. */
  latest: BehavioralIndicatorsRow | null;
  /** Full history (up to `historyLimit` rows), newest first. */
  history: BehavioralIndicatorsRow[];
  loading: boolean;
  /** True when at least one row exists for this user. */
  hasData: boolean;
  /** Re-fetch from the server — call after a journal save if needed. */
  refetch: () => void;
  /** Last fetch error message, if any. */
  error: string | null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetch stored behavioral indicators for the authenticated user.
 *
 * @param lookbackDays  Lookback window to query (default: 30).
 *                      Must match the value used when the indicators were computed.
 * @param historyLimit  Max number of historical rows returned (default: 1).
 *                      Pass a higher number to plot a trend over multiple compute dates.
 * @param targetUserId  Only privileged roles (admin/counselor) can
 *                      view another user's data.  Leave undefined for own data.
 */
export function useBehavioralIndicators(
  lookbackDays: number = 30,
  historyLimit: number = 1,
  targetUserId?: string
): UseBehavioralIndicatorsResult {
  const { user } = useAuth();
  const [latest,  setLatest]  = useState<BehavioralIndicatorsRow | null>(null);
  const [history, setHistory] = useState<BehavioralIndicatorsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchIndicators = useCallback(async () => {
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
        lookbackDays: String(lookbackDays),
        limit:        String(Math.min(90, Math.max(1, historyLimit))),
      });
      if (targetUserId && targetUserId !== user.id) {
        params.set("userId", targetUserId);
      }

      const res = await fetch(`/api/behavioral?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.error ?? `GET /api/behavioral returned ${res.status}`
        );
      }

      const data = await res.json();
      const rows = (data.history ?? []) as BehavioralIndicatorsRow[];
      setHistory(rows);
      setLatest(rows[0] ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[useBehavioralIndicators]", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user, lookbackDays, historyLimit, targetUserId]);

  useEffect(() => {
    fetchIndicators();
  }, [fetchIndicators]);

  return {
    latest,
    history,
    loading,
    hasData: latest !== null,
    refetch: fetchIndicators,
    error,
  };
}
