"use client";

// =====================================================================
// hooks/useMoodVisualization.ts  —  Phase 5
// Aggregates all 6 visualization datasets from real DB tables.
//
// DATA SOURCES (no fabrication — only stored DB values):
//   1. Mood Distribution   → journal_entries.sentiment (stored XLM-R label)
//   2. Weekly Mood Trend   → mood_logs.score + journal_entries.mood
//   3. Monthly Mood Trend  → same two tables, monthly buckets
//   4. Wellness Score Trend→ behavioral_indicators.wellness_score over time
//   5. Behavioral Trend    → behavioral_indicators.behavioral_trend_score over time
//   6. Distress Risk       → distress_risk_assessments.risk_level over time
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMoodTrend, type MoodTrendPoint, type MoodTrendRange } from "@/hooks/useMoodTrend";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Mood Distribution: counts per sentiment class from journal_entries.sentiment */
export interface MoodDistributionData {
  positive: number;
  negative: number;
  distress: number;
  total:    number;
  /** Pre-computed percentages (0–100, rounded) */
  positivePercent: number;
  negativePercent: number;
  distressPercent: number;
}

/** One point on the Wellness Score trend line */
export interface WellnessTrendPoint {
  date:          string;   // "YYYY-MM-DD"
  wellnessScore: number;   // 0.00–10.00
  wellnessLevel: string;   // "Healthy" | "Stable" | ...
}

/** One point on the Behavioral Trend Score line */
export interface BehavioralTrendPoint {
  date: string;  // "YYYY-MM-DD"
  bts:  number;  // 0-100 concern score
}

/** One point on the Distress Risk bar chart */
export interface DistressRiskPoint {
  date:       string;  // "YYYY-MM-DD"
  riskLevel:  string;  // "Low Risk" | "Moderate Risk" | "High Risk" | "Critical Risk"
  severity:   number;  // 1=Low, 2=Moderate, 3=High, 4=Critical (for Y-axis)
  totalPoints: number; // raw DRI points (for tooltip)
}

export interface UseMoodVisualizationResult {
  // 1. Mood Distribution
  distribution:       MoodDistributionData | null;
  distributionLoading: boolean;

  // 2 + 3. Mood Trend (week / month / 3-months / all-time via useMoodTrend)
  moodTrendData:      MoodTrendPoint[];
  moodTrendLoading:   boolean;
  moodTrendHasData:   boolean;
  moodTrendAvg:       number | null;
  moodTrendTicks:     string[] | undefined;
  moodTrendRange:     MoodTrendRange;
  setMoodTrendRange:  (r: MoodTrendRange) => void;

  // 4. Wellness Score Trend
  wellnessTrend:      WellnessTrendPoint[];
  wellnessTrendLoading: boolean;

  // 5. Behavioral Trend
  behavioralTrend:      BehavioralTrendPoint[];
  behavioralTrendLoading: boolean;

  // 6. Distress Risk History
  distressRisk:         DistressRiskPoint[];
  distressRiskLoading:  boolean;

  /** Re-fetch all data */
  refetch: () => void;
}

// ── Risk level → severity integer ────────────────────────────────────────────

const RISK_SEVERITY: Record<string, number> = {
  "Low Risk":      1,
  "Moderate Risk": 2,
  "High Risk":     3,
  "Critical Risk": 4,
};

const clampNumber = (value: unknown, min: number, max: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : null;
};

const percent = (value: number, total: number) =>
  total > 0 ? Math.round((value / total) * 100) : 0;

const asDateKey = (value: unknown) => {
  if (typeof value !== "string" || value.length < 10) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : value.slice(0, 10);
};

// ─────────────────────────────────────────────────────────────────────────────

export function useMoodVisualization(): UseMoodVisualizationResult {
  const { user } = useAuth();
  const supabase  = useMemo(() => createClient() as any, []);

  // ── Mood Trend (re-exports useMoodTrend) ──────────────────────────────────
  const [moodTrendRange, setMoodTrendRange] = useState<MoodTrendRange>("Month");
  const {
    data:     moodTrendData,
    loading:  moodTrendLoading,
    hasData:  moodTrendHasData,
    avgScore: moodTrendAvg,
    ticks:    moodTrendTicks,
    refetch:  refetchMoodTrend,
  } = useMoodTrend(moodTrendRange);

  // ── Dataset state ─────────────────────────────────────────────────────────
  const [distribution,          setDistribution]          = useState<MoodDistributionData | null>(null);
  const [distributionLoading,   setDistributionLoading]   = useState(true);
  const [wellnessTrend,         setWellnessTrend]         = useState<WellnessTrendPoint[]>([]);
  const [wellnessTrendLoading,  setWellnessTrendLoading]  = useState(true);
  const [behavioralTrend,       setBehavioralTrend]       = useState<BehavioralTrendPoint[]>([]);
  const [behavioralTrendLoading,setBehavioralTrendLoading]= useState(true);
  const [distressRisk,          setDistressRisk]          = useState<DistressRiskPoint[]>([]);
  const [distressRiskLoading,   setDistressRiskLoading]   = useState(true);

  // ── 1. Mood Distribution ──────────────────────────────────────────────────
  // Counts from journal_entries.sentiment (stored XLM-R classification).
  // Only uses entries where sentiment IS NOT NULL (i.e. AI has run).
  const fetchDistribution = useCallback(async () => {
    if (!user) { setDistributionLoading(false); return; }
    setDistributionLoading(true);
    try {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("sentiment")
        .eq("user_id", user.id)
        .not("sentiment", "is", null);

      if (error) {
        console.error("[useMoodVisualization] distribution:", error);
        setDistribution(null);
        return;
      }

      const rows = (data ?? []) as { sentiment: string }[];
      const positive = rows.filter(r => r.sentiment === "positive").length;
      const negative = rows.filter(r => r.sentiment === "negative").length;
      const distress = rows.filter(r => r.sentiment === "distress").length;
      const total    = positive + negative + distress;

      setDistribution(total === 0 ? null : {
        positive, negative, distress, total,
        positivePercent: percent(positive, total),
        negativePercent: percent(negative, total),
        distressPercent: percent(distress, total),
      });
    } finally {
      setDistributionLoading(false);
    }
  }, [user, supabase]);

  // ── 4. Wellness Score Trend ───────────────────────────────────────────────
  // Reads behavioral_indicators.wellness_score ordered by window_end_date.
  // Excludes rows where wellness_score IS NULL.
  const fetchWellnessTrend = useCallback(async () => {
    if (!user) { setWellnessTrendLoading(false); return; }
    setWellnessTrendLoading(true);
    try {
      const { data, error } = await supabase
        .from("behavioral_indicators")
        .select("window_end_date, wellness_score, wellness_level")
        .eq("user_id",      user.id)
        .eq("lookback_days", 30)
        .not("wellness_score", "is", null)
        .order("window_end_date", { ascending: true })
        .limit(90);

      if (error) {
        console.error("[useMoodVisualization] wellness trend:", error);
        setWellnessTrend([]);
        return;
      }

      setWellnessTrend(
        ((data ?? []) as any[])
          .map((r) => {
            const date = asDateKey(r.window_end_date);
            const wellnessScore = clampNumber(r.wellness_score, 0, 10);
            if (!date || wellnessScore === null) return null;
            return {
              date,
              wellnessScore,
              wellnessLevel: typeof r.wellness_level === "string" ? r.wellness_level : "Unknown",
            };
          })
          .filter((point): point is WellnessTrendPoint => Boolean(point))
      );
    } finally {
      setWellnessTrendLoading(false);
    }
  }, [user, supabase]);

  // ── 5. Behavioral Trend Score ─────────────────────────────────────────────
  // Reads behavioral_indicators.behavioral_trend_score over time.
  const fetchBehavioralTrend = useCallback(async () => {
    if (!user) { setBehavioralTrendLoading(false); return; }
    setBehavioralTrendLoading(true);
    try {
      const { data, error } = await supabase
        .from("behavioral_indicators")
        .select("window_end_date, behavioral_trend_score")
        .eq("user_id",      user.id)
        .eq("lookback_days", 30)
        .order("window_end_date", { ascending: true })
        .limit(90);

      if (error) {
        console.error("[useMoodVisualization] behavioral trend:", error);
        setBehavioralTrend([]);
        return;
      }

      setBehavioralTrend(
        ((data ?? []) as any[])
          .map((r) => {
            const date = asDateKey(r.window_end_date);
            const bts = clampNumber(r.behavioral_trend_score, 0, 100);
            return date && bts !== null ? { date, bts } : null;
          })
          .filter((point): point is BehavioralTrendPoint => Boolean(point))
      );
    } finally {
      setBehavioralTrendLoading(false);
    }
  }, [user, supabase]);

  // ── 6. Distress Risk History ──────────────────────────────────────────────
  // Reads distress_risk_assessments.risk_level over assessed_date.
  const fetchDistressRisk = useCallback(async () => {
    if (!user) { setDistressRiskLoading(false); return; }
    setDistressRiskLoading(true);
    try {
      const { data, error } = await supabase
        .from("distress_risk_assessments")
        .select("assessed_date, risk_level, total_points")
        .eq("user_id",      user.id)
        .eq("lookback_days", 30)
        .order("assessed_date", { ascending: true })
        .limit(90);

      if (error) {
        console.error("[useMoodVisualization] distress risk:", error);
        setDistressRisk([]);
        return;
      }

      setDistressRisk(
        ((data ?? []) as any[])
          .map((r) => {
            const date = asDateKey(r.assessed_date);
            const riskLevel = typeof r.risk_level === "string" ? r.risk_level : "Low Risk";
            const totalPoints = clampNumber(r.total_points, 0, 100) ?? 0;
            if (!date) return null;
            return {
              date,
              riskLevel,
              severity: RISK_SEVERITY[riskLevel] ?? 1,
              totalPoints,
            };
          })
          .filter((point): point is DistressRiskPoint => Boolean(point))
      );
    } finally {
      setDistressRiskLoading(false);
    }
  }, [user, supabase]);

  // ── Unified refetch ───────────────────────────────────────────────────────
  const refetch = useCallback(() => {
    fetchDistribution();
    fetchWellnessTrend();
    fetchBehavioralTrend();
    fetchDistressRisk();
    refetchMoodTrend();
  }, [fetchDistribution, fetchWellnessTrend, fetchBehavioralTrend, fetchDistressRisk, refetchMoodTrend]);

  useEffect(() => {
    if (!user) {
      setDistribution(null);
      setDistributionLoading(false);
      setWellnessTrend([]);
      setWellnessTrendLoading(false);
      setBehavioralTrend([]);
      setBehavioralTrendLoading(false);
      setDistressRisk([]);
      setDistressRiskLoading(false);
      return;
    }
    fetchDistribution();
    fetchWellnessTrend();
    fetchBehavioralTrend();
    fetchDistressRisk();
  }, [user, fetchDistribution, fetchWellnessTrend, fetchBehavioralTrend, fetchDistressRisk]);

  return {
    distribution, distributionLoading,
    moodTrendData, moodTrendLoading, moodTrendHasData, moodTrendAvg, moodTrendTicks,
    moodTrendRange, setMoodTrendRange,
    wellnessTrend, wellnessTrendLoading,
    behavioralTrend, behavioralTrendLoading,
    distressRisk, distressRiskLoading,
    refetch,
  };
}
