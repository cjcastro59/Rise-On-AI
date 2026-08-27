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
  bts:  number;  // −100 to +100
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

      if (error) { console.error("[useMoodVisualization] distribution:", error); return; }

      const rows = (data ?? []) as { sentiment: string }[];
      const positive = rows.filter(r => r.sentiment === "positive").length;
      const negative = rows.filter(r => r.sentiment === "negative").length;
      const distress = rows.filter(r => r.sentiment === "distress").length;
      const total    = positive + negative + distress;

      setDistribution(total === 0 ? null : {
        positive, negative, distress, total,
        positivePercent: Math.round((positive / total) * 100),
        negativePercent: Math.round((negative / total) * 100),
        distressPercent: Math.round((distress / total) * 100),
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

      if (error) { console.error("[useMoodVisualization] wellness trend:", error); return; }

      setWellnessTrend(
        ((data ?? []) as any[]).map(r => ({
          date:          r.window_end_date as string,
          wellnessScore: r.wellness_score  as number,
          wellnessLevel: r.wellness_level  as string ?? "Unknown",
        }))
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

      if (error) { console.error("[useMoodVisualization] behavioral trend:", error); return; }

      setBehavioralTrend(
        ((data ?? []) as any[]).map(r => ({
          date: r.window_end_date        as string,
          bts:  r.behavioral_trend_score as number,
        }))
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

      if (error) { console.error("[useMoodVisualization] distress risk:", error); return; }

      setDistressRisk(
        ((data ?? []) as any[]).map(r => ({
          date:        r.assessed_date as string,
          riskLevel:   r.risk_level    as string,
          severity:    RISK_SEVERITY[r.risk_level as string] ?? 1,
          totalPoints: r.total_points  as number,
        }))
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
    if (!user) return;
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
