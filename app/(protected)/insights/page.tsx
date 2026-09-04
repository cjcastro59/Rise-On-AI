"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/layout/PageHeader";
import WeeklyMoodChart from "@/components/dashboard/WeeklyMoodChart";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMoodTrend, type MoodTrendRange } from "@/hooks/useMoodTrend";
import { useBehavioralIndicators } from "@/hooks/useBehavioralIndicators";
import { useWellnessAssessment } from "@/hooks/useWellnessAssessment";
import { useDistressRisk } from "@/hooks/useDistressRisk";
import { getSentimentFromMood, type Sentiment } from "@/lib/sentiment";
import {
  WELLNESS_LEVEL_CONFIG,
  type WellnessLevel,
  type WellnessScoreDetails,
} from "@/lib/wellness-assessment";
import {
  DISTRESS_RISK_CONFIG,
  DISTRESS_RISK_POINT_RANGES,
  type DistressRiskLevel,
} from "@/lib/distress-risk";

type JournalEntry = {
  id: string;
  content: string | null;
  mood: string | null;
  emotions: string[] | null;
  created_at: string;
  /** ML-predicted sentiment stored at save time */
  sentiment?: string | null;
  sentiment_score?: number | null;
};

const TIME_RANGES: MoodTrendRange[] = ["Week", "Month", "3 Months", "All Time"];

// ── Indicator bar helper ──────────────────────────────────────────────────────
function IndicatorBar({
  value,
  max = 100,
  color,
}: {
  value: number;
  max?: number;
  color: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-2 bg-[#d8e2ed] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ── Trend Score bar: centred around 0, range −100 to +100 ────────────────────
function TrendScoreBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, ((value + 100) / 200) * 100));
  const color =
    value >= 10 ? "#52b788" : value <= -10 ? "#f77f7f" : "#a8c7dc";
  return (
    <div className="relative h-2 bg-[#d8e2ed] rounded-full overflow-hidden">
      {/* Centre tick */}
      <div className="absolute inset-y-0 left-1/2 w-px bg-white/60 z-10" />
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ── Wellness Score gauge ──────────────────────────────────────────────────────
function WellnessGauge({
  score,
  level,
}: {
  score: number;
  level: WellnessLevel;
}) {
  const cfg   = WELLNESS_LEVEL_CONFIG[level];
  const angle = (score / 10) * 180 - 90; // −90° (0) → +90° (10)

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Semi-circle gauge */}
      <div className="relative w-36 h-[72px] overflow-hidden select-none">
        <svg
          viewBox="0 0 120 60"
          className="w-full h-full"
          aria-label={`Wellness score ${score} out of 10`}
        >
          {/* Track */}
          <path
            d="M10,60 A50,50 0 0,1 110,60"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Coloured fill proportional to score */}
          <path
            d="M10,60 A50,50 0 0,1 110,60"
            fill="none"
            stroke={cfg.bgColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(score / 10) * 157} 157`}
          />
          {/* Needle */}
          <line
            x1="60"
            y1="60"
            x2={60 + 38 * Math.cos(((angle - 90) * Math.PI) / 180)}
            y2={60 + 38 * Math.sin(((angle - 90) * Math.PI) / 180)}
            stroke={cfg.color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="60" cy="60" r="4" fill={cfg.color} />
        </svg>
      </div>
      {/* Score + level */}
      <div className="text-center">
        <p
          className="text-2xl font-bold"
          style={{ color: cfg.color }}
        >
          {score.toFixed(1)}
          <span className="text-sm font-normal text-dark-text/50"> / 10</span>
        </p>
        <span
          className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-poppins font-medium"
          style={{ backgroundColor: cfg.bgColor, color: cfg.color }}
        >
          {cfg.emoji} {level}
        </span>
      </div>
    </div>
  );
}

// ── Wellness history bar chart ────────────────────────────────────────────────
interface WellnessHistoryChartRow {
  window_end_date: string;
  wellness_score: number | null;
  wellness_level?: WellnessLevel | null;
}
function WellnessHistoryChart({
  history,
  color,
  bgColor,
}: {
  history: WellnessHistoryChartRow[];
  color: string;
  bgColor: string;
}) {
  // Show at most 14 points to keep the chart readable
  const pts = history.slice(-14);
  if (pts.length < 2) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-end gap-1 h-20">
        {pts.map((row, i) => {
          const score = row.wellness_score ?? 0;
          const heightPct = Math.max(4, (score / 10) * 100);
          const lvl = row.wellness_level as WellnessLevel | null;
          const barColor = lvl
            ? WELLNESS_LEVEL_CONFIG[lvl]?.bgColor ?? bgColor
            : bgColor;
          return (
            <div
              key={row.window_end_date ?? i}
              className="flex-1 rounded-t-sm transition-all"
              style={{ height: `${heightPct}%`, backgroundColor: barColor, minWidth: 6 }}
              title={`${row.window_end_date}: ${score.toFixed(1)}`}
            />
          );
        })}
      </div>
      {/* X-axis: first and last date */}
      <div className="flex justify-between text-[9px] text-dark-text/40 font-inter px-0.5">
        <span>{pts[0]?.window_end_date?.slice(5)}</span>
        <span>{pts[pts.length - 1]?.window_end_date?.slice(5)}</span>
      </div>
      {/* Y-axis legend */}
      <div className="flex justify-between text-[9px] text-dark-text/30 font-inter">
        <span>0</span><span>5</span><span>10</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function MoodInsightsPage() {
  const [timeRange, setTimeRange] = useState<MoodTrendRange>("Week");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const {
    data: moodTrendData,
    loading: moodTrendLoading,
    hasData: moodTrendHasData,
    avgScore: moodTrendAvg,
    ticks: moodTrendTicks,
  } = useMoodTrend(timeRange);

  // ── Behavioral indicators from stored DB row ───────────────────────────────
  const {
    latest: indicators,
    loading: indicatorsLoading,
    hasData: indicatorsHasData,
  } = useBehavioralIndicators(30);

  // ── Wellness assessment history (90 rows = up to 90 compute dates) ─────────
  const {
    latest: wellnessLatest,
    history: wellnessHistory,
    loading: wellnessLoading,
    isRecalculating: wellnessRecalculating,
    triggerRecalculate,
  } = useWellnessAssessment(30, 90, undefined, true); // includeDetails=true for breakdown table

  // ── Distress Risk Indicator ────────────────────────────────────────────────
  const {
    latest: driLatest,
    history: driHistory,
    loading: driLoading,
    isRecalculating: driRecalculating,
    triggerRecalculate: triggerDRI,
  } = useDistressRisk(30, 30);

  // Mood options for scoring
  const moodColors = {
    "Joy & Hope": "#A8DADC",
    "Uncertainty":"#CDB4DB",
    "Anxiety / Stress": "#F4A6A6",
  };

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("id, content, mood, emotions, created_at, sentiment, sentiment_score")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching entries:", error);
        return;
      }
      setEntries(data || []);
    } catch (error) {
      console.error("Error fetching entries:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    if (user) fetchEntries();
  }, [fetchEntries, user]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const calculateStreak = (): number => {
    if (entries.length === 0) return 0;
    const sortedDates = entries
      .map((e) => new Date(e.created_at).toDateString())
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const uniqueDates = [...new Set(sortedDates)];
    let streak = 0;
    for (const dateStr of uniqueDates) {
      const entryDate = new Date(dateStr);
      entryDate.setHours(0, 0, 0, 0);
      const dayDiff = Math.floor(
        (Date.now() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (dayDiff === streak) streak++;
      else if (dayDiff > streak) break;
    }
    return streak;
  };

  const getFilteredEntries = (): JournalEntry[] => {
    const now    = new Date();
    const cutoff = new Date();
    switch (timeRange) {
      case "Week": cutoff.setDate(now.getDate() - 7);      break;
      case "Month": cutoff.setMonth(now.getMonth() - 1);    break;
      case "3 Months": cutoff.setMonth(now.getMonth() - 3);    break;
      default: return entries;
    }
    return entries.filter((e) => new Date(e.created_at) >= cutoff);
  };

  // ── Per-entry sentiment helpers (ML column, no keyword scanning) ─────────

  const getEntrySentiment = (entry: JournalEntry): Sentiment => {
    if (entry.sentiment) return entry.sentiment as Sentiment;
    return getSentimentFromMood(entry.mood);
  };

  /** Sentiment score 0-100 derived from the stored column, or a mood-based default. */
  const getEntrySentimentScore = (entry: JournalEntry): number => {
    if (entry.sentiment_score != null) return entry.sentiment_score;
    const s = getEntrySentiment(entry);
    if (s === "positive") return 75;
    if (s === "distress") return 10;
    return 35;
  };

  const getEmotionCategory = (
    entry: JournalEntry
  ): keyof typeof moodColors => {
    const s = getEntrySentiment(entry);
    if (s === "positive") return "Joy & Hope";
    if (s === "distress")  return "Anxiety / Stress";
    if (entry.mood === "Anxious" || entry.mood === "Overwhelmed")
      return "Anxiety / Stress";
    return "Uncertainty";
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const filteredEntries = getFilteredEntries();
  const totalEntries = filteredEntries.length;
  const positiveCount = filteredEntries.filter(
    (e) => getEntrySentiment(e) === "positive"
  ).length;
  const positivePercentage =
    totalEntries > 0 ? Math.round((positiveCount / totalEntries) * 100) : 0;
  const currentStreak = calculateStreak();

  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekEntries = entries.filter(
    (e) => new Date(e.created_at) >= lastWeek
  );
  const avgScoreLastWeek =
    lastWeekEntries.length > 0
      ? lastWeekEntries.reduce((sum, e) => {
          return sum + getEntrySentimentScore(e) / 10;
        }, 0) / lastWeekEntries.length
      : 5;
  const moodGrowth = Math.round((avgScoreLastWeek - 5) * 10);

  const emotionDistribution: Record<string, number> = {
    "Joy & Hope":  0,
    "Uncertainty": 0,
    "Anxiety / Stress": 0,
  };
  filteredEntries.forEach((e) => {
    emotionDistribution[getEmotionCategory(e)]++;
  });

  const moodTrend = (() => {
    const pts = moodTrendData.filter((p) => p.score !== null);
    if (pts.length < 2) return { direction: pts.length === 1 ? "flat" : "none" } as const;
    const diff =
      (pts[pts.length - 1].score as number) - (pts[0].score as number);
    if (diff >  0.3) return { direction: "up"   } as const;
    if (diff < -0.3) return { direction: "down" } as const;
    return { direction: "flat" } as const;
  })();

  const extractKeywords = () => {
    const stop = new Set([
      "the","a","and","of","to","in","for","is","are","on",
      "with","that","this","ang","ng","ko","na","sa",
    ]);
    const wc: Record<string, number> = {};
    filteredEntries.forEach((e) => {
      if (!e.content) return;
      e.content
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 2 && !stop.has(w))
        .forEach((w) => { wc[w] = (wc[w] || 0) + 1; });
    });
    const palette = ["#A8DADC","#CDB4DB","#B8E0D2","#B7E4C7","#F4A6A6"];
    return Object.entries(wc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([word], i) => ({ word, color: palette[i % palette.length] }));
  };
  const topKeywords = extractKeywords();

  // ── Behavioral indicator display values ───────────────────────────────────
  // Trend score: map −100…+100 to a readable label
  const trendLabel = (score: number) => {
    if (score >=  33) return "↑ Improving";
    if (score <= -33) return "↓ Declining";
    return "→ Stable";
  };
  const trendColor = (score: number) =>
    score >= 10 ? "#52b788" : score <= -10 ? "#f77f7f" : "#a8c7dc";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-dark-text/70">Loading your insights...</p>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <PageHeader
        title="Mood Insights"
        subtitle="Your emotional journey over time"
        actions={TIME_RANGES.map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-3 py-1.5 rounded-full text-xs font-poppins transition-all ${
              timeRange === range
                ? "bg-[#A8DADC] text-white shadow-md"
                : "bg-gray-100 text-dark-text/60 hover:bg-[#F5F5F5]"
            }`}
          >
            {range}
          </button>
        ))}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-text/70 text-xs font-poppins mb-1">Total Entries</p>
              <p className="text-2xl font-bold text-dark-text">{totalEntries}</p>
            </div>
            <div className="w-10 h-10 bg-[#A8DADC]/30 rounded-full flex items-center justify-center">
              <span className="text-lg">📝</span>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-text/70 text-xs font-poppins mb-1">Positive Entries</p>
              <p className="text-2xl font-bold text-dark-text">{positivePercentage}%</p>
            </div>
            <div className="w-10 h-10 bg-[#B7E4C7]/40 rounded-full flex items-center justify-center">
              <span className="text-lg">😊</span>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-text/70 text-xs font-poppins mb-1">Current Streak</p>
              <p className="text-2xl font-bold text-dark-text">{currentStreak}</p>
            </div>
            <div className="w-10 h-10 bg-[#FFE8A1]/40 rounded-full flex items-center justify-center">
              <span className="text-lg">🔥</span>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-text/70 text-xs font-poppins mb-1">Mood Growth</p>
              <p className="text-2xl font-bold text-dark-text">
                {moodGrowth > 0 ? "+" : ""}{moodGrowth}%
              </p>
            </div>
            <div className="w-10 h-10 bg-[#CDB4DB]/30 rounded-full flex items-center justify-center">
              <span className="text-lg">📈</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── CARD 1: BEHAVIORAL ANALYTICS (4 indicators) ──────────────── */}
      <Card className="p-6 bg-white mb-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 flex items-center gap-2">
            <span>🧠</span>
            Behavioral Analytics
          </h3>
          <span className="text-[10px] font-normal text-dark-text/40">
            Last 30 days
          </span>
        </div>
        <p className="text-[11px] text-dark-text/50 font-inter mb-5">
          Computed from your journal history · updates automatically after each entry
        </p>

        {indicatorsLoading ? (
          <p className="text-xs text-dark-text/50 py-4 text-center">
            Loading behavioral data…
          </p>
        ) : !indicatorsHasData || !indicators ? (
          <div className="text-center py-6 space-y-2">
            <p className="text-sm text-dark-text/60">No behavioral data yet.</p>
            <p className="text-xs text-dark-text/40">
              Write a few journal entries — indicators are computed automatically after each save.
            </p>
            <Link href="/journal">
              <Button size="sm" variant="secondary"
                className="mt-2 text-xs border-[#A8DADC] text-[#A8DADC] hover:bg-[#A8DADC]/10">
                Start Journaling →
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
            {/* 1. Behavioral Trend Score */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-poppins text-dark-text/80">
                  Behavioral Trend Score
                </span>
                <span className="text-xs font-semibold"
                  style={{ color: trendColor(indicators.behavioral_trend_score) }}>
                  {trendLabel(indicators.behavioral_trend_score)}{" "}
                  <span className="font-normal text-dark-text/50">
                    ({indicators.behavioral_trend_score > 0 ? "+" : ""}
                    {indicators.behavioral_trend_score})
                  </span>
                </span>
              </div>
              <TrendScoreBar value={indicators.behavioral_trend_score} />
              <p className="text-[10px] text-dark-text/40 mt-1">
                Compares older vs. recent half of entries in window. Range: −100 (declining) to +100 (improving).
              </p>
            </div>

            {/* 2. Journaling Frequency */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-poppins text-dark-text/80">
                  Journaling Frequency
                </span>
                <span className="text-xs font-semibold text-dark-text/70">
                  {indicators.journaling_frequency_score.toFixed(0)}
                  <span className="font-normal text-dark-text/40"> / 100</span>
                  <span className="ml-2 font-normal text-dark-text/50">
                    ({indicators.unique_days_journaled} day{indicators.unique_days_journaled !== 1 ? "s" : ""})
                  </span>
                </span>
              </div>
              <IndicatorBar value={indicators.journaling_frequency_score} color="#A8DADC" />
              <p className="text-[10px] text-dark-text/40 mt-1">
                Unique journaling days vs. expected cadence (every 3 days). 100 = at or above target.
              </p>
            </div>

            {/* 3. Mood Consistency */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-poppins text-dark-text/80">
                  Mood Consistency
                </span>
                <span className="text-xs font-semibold text-dark-text/70">
                  {indicators.mood_consistency_score.toFixed(0)}
                  <span className="font-normal text-dark-text/40"> / 100</span>
                </span>
              </div>
              <IndicatorBar value={indicators.mood_consistency_score} color="#CDB4DB" />
              <p className="text-[10px] text-dark-text/40 mt-1">
                How stable your mood scores are day-to-day. 100 = no variation; 0 = highly volatile.
              </p>
            </div>

            {/* 4. Consecutive Negative Entries */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-poppins text-dark-text/80">
                  Consecutive Negative Entries
                </span>
                <span className={`text-xs font-semibold ${
                  indicators.consecutive_negative_count >= 5
                    ? "text-[#f77f7f]"
                    : indicators.consecutive_negative_count >= 3
                    ? "text-[#f4a261]"
                    : "text-dark-text/70"
                }`}>
                  {indicators.consecutive_negative_count}
                  <span className="font-normal text-dark-text/40">
                    {" "}entr{indicators.consecutive_negative_count !== 1 ? "ies" : "y"}
                  </span>
                </span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: Math.min(14, Math.max(1, indicators.consecutive_negative_count || 1)) }).map(
                  (_, i) => (
                    <div key={i} className="w-4 h-4 rounded-sm"
                      style={{
                        backgroundColor:
                          i < indicators.consecutive_negative_count
                            ? indicators.consecutive_negative_count >= 5 ? "#f77f7f" : "#f4a261"
                            : "#e5e7eb",
                      }}
                    />
                  )
                )}
                {indicators.consecutive_negative_count > 14 && (
                  <span className="text-[10px] text-dark-text/50 self-center ml-1">
                    +{indicators.consecutive_negative_count - 14} more
                  </span>
                )}
              </div>
              <p className="text-[10px] text-dark-text/40 mt-1">
                Most recent unbroken streak of negative or distress entries.
                {indicators.consecutive_negative_count >= 5 && (
                  <span className="text-[#f77f7f] ml-1">Consider reaching out to a counselor.</span>
                )}
              </p>
            </div>
          </div>
        )}
      </Card>
      {/* ── END CARD 1 ────────────────────────────────────────────────────── */}

      {/* ── CARD 2: WELLNESS ASSESSMENT ───────────────────────────────────── */}
      <Card className="p-6 bg-white mb-8">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 flex items-center gap-2">
            <span>💚</span>
            Wellness Assessment
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-dark-text/40">0–10 scale</span>
            <button
              onClick={() => triggerRecalculate()}
              disabled={wellnessRecalculating}
              className="text-[10px] font-poppins text-[#4EAAB3] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {wellnessRecalculating ? "Recalculating…" : "↻ Recalculate"}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-dark-text/50 font-inter mb-5">
          Derived from the 4 behavioral indicators above · scale: 0 (High Risk) → 10 (Healthy)
        </p>

        {wellnessLoading ? (
          <p className="text-xs text-dark-text/50 py-4 text-center">Loading wellness data…</p>
        ) : !wellnessLatest || wellnessLatest.wellness_score === null ? (
          <div className="text-center py-6 space-y-2">
            <p className="text-sm text-dark-text/60">Wellness score not yet computed.</p>
            <p className="text-xs text-dark-text/40">
              Save a journal entry — the score updates automatically. Or use the Recalculate button above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
            {/* Left: gauge + description */}
            <div className="flex flex-col items-center gap-4">
              <WellnessGauge
                score={wellnessLatest.wellness_score}
                level={wellnessLatest.wellness_level as WellnessLevel}
              />
              <p className="text-[11px] text-dark-text/50 text-center max-w-[220px]">
                {WELLNESS_LEVEL_CONFIG[wellnessLatest.wellness_level as WellnessLevel].description}
              </p>

              {/* Sub-score breakdown table */}
              {wellnessLatest.wellness_score_details && (() => {
                const d = wellnessLatest.wellness_score_details as unknown as WellnessScoreDetails;
                return (
                  <div className="w-full pt-3 border-t border-[#F5F5F5]">
                    <p className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/50 mb-2">
                      Computation Breakdown
                    </p>
                    <table className="w-full text-[10px] font-inter">
                      <tbody className="divide-y divide-[#F5F5F5]">
                        {[
                          ["Trend sub-score (×0.40)",       (d.trendSubScore       * 0.40).toFixed(3), d.trendSubScore.toFixed(3)],
                          ["Frequency sub-score (×0.20)",   (d.frequencySubScore   * 0.20).toFixed(3), d.frequencySubScore.toFixed(3)],
                          ["Consistency sub-score (×0.15)", (d.consistencySubScore * 0.15).toFixed(3), d.consistencySubScore.toFixed(3)],
                          ["Baseline floor",                "0.250", "—"],
                          ["Streak penalty",                `−${d.streakPenalty.toFixed(3)}`, "—"],
                          ["Raw score [0–1]",               d.rawScore.toFixed(3), "—"],
                          ["Wellness Score [0–10]",         (d.rawScore * 10).toFixed(2), "—"],
                        ].map(([label, contribution, sub]) => (
                          <tr key={label as string}>
                            <td className="py-1 text-dark-text/50 pr-2">{label}</td>
                            <td className="py-1 text-dark-text/70 text-right font-medium">{contribution}</td>
                            <td className="py-1 text-dark-text/40 text-right pl-2">
                              {sub !== "—" ? `sub=${sub}` : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {d.inputClamped && (
                      <p className="text-[9px] text-[#f4a261] mt-1">
                        ⚠ One or more inputs were out of expected range and were clamped.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Right: history trend + metadata */}
            <div className="flex flex-col gap-4">
              {/* History sparkline / bar chart */}
              {wellnessHistory.filter(r => r.wellness_score !== null).length >= 2 && (
                <div>
                  <p className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/50 mb-3">
                    Wellness Score History
                  </p>
                  <WellnessHistoryChart
                    history={wellnessHistory
                      .filter(r => r.wellness_score !== null)
                      .slice()
                      .reverse()  // oldest → newest for chart
                    }
                    color={WELLNESS_LEVEL_CONFIG[wellnessLatest.wellness_level as WellnessLevel].color}
                    bgColor={WELLNESS_LEVEL_CONFIG[wellnessLatest.wellness_level as WellnessLevel].bgColor}
                  />
                </div>
              )}

              {/* Wellness level legend */}
              <div className="pt-3 border-t border-[#F5F5F5]">
                <p className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/50 mb-2">
                  Wellness Level Scale
                </p>
                <div className="space-y-1.5">
                  {(
                    [
                      ["Healthy", "8.00–10.00"],
                      ["Stable", "6.00–7.99"],
                      ["Moderate Concern", "4.00–5.99"],
                      ["At Risk",  "2.00–3.99"],
                      ["High Risk",  "0.00–1.99"],
                    ] as [WellnessLevel, string][]
                  ).map(([lvl, range]) => {
                    const c = WELLNESS_LEVEL_CONFIG[lvl];
                    const isActive = wellnessLatest.wellness_level === lvl;
                    return (
                      <div key={lvl}
                        className={`flex items-center justify-between px-2 py-1 rounded-md transition-all ${
                          isActive ? "ring-1" : ""
                        }`}
                        style={{
                          backgroundColor: isActive ? c.bgColor + "60" : "transparent",
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px]">{c.emoji}</span>
                          <span className="text-[10px] font-poppins"
                            style={{ color: isActive ? c.color : undefined }}
                          >
                            {isActive ? <strong>{lvl}</strong> : lvl}
                          </span>
                        </div>
                        <span className="text-[10px] text-dark-text/50 font-inter">{range}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Metadata */}
              <div className="pt-3 border-t border-[#F5F5F5] space-y-1">
                <div className="flex justify-between text-[10px] text-dark-text/40">
                  <span>Entries analysed</span>
                  <span className="font-medium text-dark-text/60">{wellnessLatest.entries_analyzed}</span>
                </div>
                <div className="flex justify-between text-[10px] text-dark-text/40">
                  <span>Lookback window</span>
                  <span className="font-medium text-dark-text/60">Last {wellnessLatest.lookback_days} days</span>
                </div>
                <div className="flex justify-between text-[10px] text-dark-text/40">
                  <span>Last updated</span>
                  <span className="font-medium text-dark-text/60">
                    {new Date(wellnessLatest.updated_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-dark-text/40">
                  <span>Compute history rows</span>
                  <span className="font-medium text-dark-text/60">{wellnessHistory.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
      {/* ── END CARD 2 ────────────────────────────────────────────────────── */}

      {/* ── CARD 3: DISTRESS RISK INDICATOR ──────────────────────────────── */}
      <Card className="p-6 bg-white mb-8">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 flex items-center gap-2">
            <span>⚠️</span>
            Distress Risk Indicator
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-dark-text/40">Decision-support only · not a diagnosis</span>
            <button
              onClick={() => triggerDRI()}
              disabled={driRecalculating}
              className="text-[10px] font-poppins text-[#4EAAB3] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {driRecalculating ? "Recalculating…" : "↻ Recalculate"}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-dark-text/50 font-inter mb-5">
          Evaluates patterns across sentiment, behavioral trend, wellness, streak, and distress frequency
          · updates automatically after each journal entry
        </p>

        {driLoading ? (
          <p className="text-xs text-dark-text/50 py-4 text-center">Loading risk indicator…</p>
        ) : !driLatest ? (
          <div className="text-center py-6 space-y-2">
            <p className="text-sm text-dark-text/60">Risk assessment not yet computed.</p>
            <p className="text-xs text-dark-text/40">
              Save a journal entry — the indicator updates automatically. Or use the Recalculate button above.
            </p>
          </div>
        ) : (() => {
          const cfg = DISTRESS_RISK_CONFIG[driLatest.risk_level as DistressRiskLevel];
          const conditions = driLatest.condition_results ?? [];
          const isCritical  = driLatest.risk_level === "Critical Risk";
          const isHigh      = driLatest.risk_level === "High Risk";

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">

              {/* Left — risk badge + score + description */}
              <div className="flex flex-col gap-4">

                {/* Risk level badge */}
                <div
                  className="flex items-center gap-4 p-4 rounded-xl border-l-4"
                  style={{ backgroundColor: cfg.bgColor + "50", borderLeftColor: cfg.borderColor }}
                >
                  <span className="text-3xl">{cfg.emoji}</span>
                  <div>
                    <p className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/50 mb-0.5">
                      Risk Level
                    </p>
                    <p className="text-xl font-poppins font-bold" style={{ color: cfg.color }}>
                      {driLatest.risk_level}
                    </p>
                    <p className="text-[10px] text-dark-text/50 font-inter mt-0.5">
                      {DISTRESS_RISK_POINT_RANGES[driLatest.risk_level as DistressRiskLevel]}
                      {" "}· {driLatest.total_points} point{driLatest.total_points !== 1 ? "s" : ""} total
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-dark-text/70 font-inter leading-relaxed">
                  {cfg.description}
                </p>

                {/* Support message — shown for High/Critical */}
                {(isHigh || isCritical) && (
                  <div
                    className="p-3 rounded-lg text-xs font-inter leading-relaxed border"
                    style={{
                      backgroundColor: cfg.bgColor + "40",
                      borderColor: cfg.borderColor + "80",
                      color: cfg.color,
                    }}
                  >
                    <strong>Support recommendation:</strong> {cfg.supportMessage}
                  </div>
                )}

                {/* Risk level legend */}
                <div className="pt-3 border-t border-[#F5F5F5]">
                  <p className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/50 mb-2">
                    Risk Level Scale
                  </p>
                  <div className="space-y-1.5">
                    {(["Low Risk", "Moderate Risk", "High Risk", "Critical Risk"] as DistressRiskLevel[]).map((lvl) => {
                      const c = DISTRESS_RISK_CONFIG[lvl];
                      const isActive = driLatest.risk_level === lvl;
                      return (
                        <div key={lvl}
                          className={`flex items-center justify-between px-2 py-1 rounded-md ${isActive ? "ring-1" : ""}`}
                          style={{
                            backgroundColor: isActive ? c.bgColor + "60" : "transparent",
                            // @ts-ignore ring-color via inline style not standard but works in Tailwind JIT
                            "--tw-ring-color": c.borderColor,
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px]">{c.emoji}</span>
                            <span className="text-[10px] font-poppins" style={{ color: isActive ? c.color : undefined }}>
                              {isActive ? <strong>{lvl}</strong> : lvl}
                            </span>
                          </div>
                          <span className="text-[10px] text-dark-text/50 font-inter">
                            {DISTRESS_RISK_POINT_RANGES[lvl]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Disclaimer */}
                <p className="text-[9px] text-dark-text/30 font-inter leading-relaxed border-t border-[#F5F5F5] pt-2 mt-1">
                  This indicator is a system-generated decision-support tool only. It does not constitute
                  a clinical diagnosis, medical assessment, or mental health evaluation.
                </p>
              </div>

              {/* Right — condition breakdown + history + metadata */}
              <div className="flex flex-col gap-4">

                {/* Condition breakdown table */}
                <div>
                  <p className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/50 mb-2">
                    Condition Breakdown
                  </p>
                  <div className="space-y-2">
                    {conditions.map((c) => (
                      <div key={c.conditionId}
                        className={`flex items-start justify-between gap-3 p-2 rounded-lg ${
                          c.triggered ? "bg-[#FFF1F1]" : "bg-[#F9FAFB]"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-poppins font-medium text-dark-text/80 truncate">
                            {c.label}
                          </p>
                          <p className="text-[9px] text-dark-text/50 font-inter">{c.observedValue}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-poppins font-bold px-1.5 py-0.5 rounded ${
                              c.points >= 3 ? "bg-[#FECACA] text-[#7B1C1C]"
                              : c.points >= 2 ? "bg-[#F4A6A6] text-[#9B3A1E]"
                              : c.points >= 1 ? "bg-[#FFE8A1] text-[#7B5E2A]"
                              : "bg-[#F3F4F6] text-dark-text/40"
                            }`}
                          >
                            {c.points > 0 ? `+${c.points}` : "0"}
                          </span>
                          <span className="text-[9px] text-dark-text/40">pts</span>
                        </div>
                      </div>
                    ))}

                    {/* Total points footer */}
                    <div className="flex justify-between items-center pt-2 border-t border-[#F5F5F5]">
                      <span className="text-[10px] font-poppins font-semibold text-dark-text/70">Total Points</span>
                      <span
                        className="text-sm font-bold font-poppins"
                        style={{ color: cfg.color }}
                      >
                        {driLatest.total_points}
                      </span>
                    </div>
                  </div>
                </div>

                {/* History mini-chart */}
                {driHistory.filter(r => r.total_points !== undefined).length >= 2 && (
                  <div>
                    <p className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/50 mb-2">
                      Risk History
                    </p>
                    <div className="flex items-end gap-1 h-16">
                      {driHistory
                        .filter(r => r.total_points !== undefined)
                        .slice()
                        .reverse()
                        .slice(-14)
                        .map((row, i) => {
                          const lvl = row.risk_level as DistressRiskLevel;
                          const c = DISTRESS_RISK_CONFIG[lvl] ?? cfg;
                          const maxPts = 13;
                          const heightPct = Math.max(6, (row.total_points / maxPts) * 100);
                          return (
                            <div
                              key={row.assessed_date ?? i}
                              className="flex-1 rounded-t-sm transition-all"
                              style={{ height: `${heightPct}%`, backgroundColor: c.bgColor, minWidth: 6 }}
                              title={`${row.assessed_date}: ${lvl} (${row.total_points} pts)`}
                            />
                          );
                        })}
                    </div>
                    <div className="flex justify-between text-[9px] text-dark-text/40 font-inter mt-1">
                      <span>
                        {driHistory
                          .filter(r => r.total_points !== undefined)
                          .slice()
                          .reverse()
                          .slice(-14)[0]?.assessed_date?.slice(5) ?? ""}
                      </span>
                      <span>{driLatest.assessed_date?.slice(5)}</span>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="pt-3 border-t border-[#F5F5F5] space-y-1">
                  <div className="flex justify-between text-[10px] text-dark-text/40">
                    <span>Latest sentiment</span>
                    <span className="font-medium text-dark-text/60 capitalize">
                      {driLatest.latest_sentiment ?? "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-dark-text/40">
                    <span>Consecutive negative</span>
                    <span className="font-medium text-dark-text/60">
                      {driLatest.consecutive_negative_count ?? 0} entries
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-dark-text/40">
                    <span>Distress entries in window</span>
                    <span className="font-medium text-dark-text/60">
                      {driLatest.distress_entries_window ?? 0} / {driLatest.total_entries_window ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-dark-text/40">
                    <span>Lookback window</span>
                    <span className="font-medium text-dark-text/60">Last {driLatest.lookback_days} days</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-dark-text/40">
                    <span>Last updated</span>
                    <span className="font-medium text-dark-text/60">
                      {new Date(driLatest.updated_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </Card>
      {/* ── END CARD 3 ────────────────────────────────────────────────────── */}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Mood Trajectory Chart */}
          <Card className="p-6 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70">
                Mood Trajectory — This {timeRange}
              </h3>
              {moodTrend.direction !== "none" && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-poppins ${
                    moodTrend.direction === "up"
                      ? "bg-success-green/20 text-success-dark"
                      : moodTrend.direction === "down"
                      ? "bg-[#F4A6A6]/20 text-[#F4A6A6]"
                      : "bg-light-gray text-dark-text/60"
                  }`}
                >
                  {moodTrend.direction === "up"
                    ? "↑ Improving"
                    : moodTrend.direction === "down"
                    ? "↓ Declining"
                    : "→ Stable"}
                  {moodTrendAvg !== null && ` · Avg ${moodTrendAvg}`}
                </span>
              )}
            </div>
            <WeeklyMoodChart
              data={moodTrendData}
              loading={moodTrendLoading}
              hasData={moodTrendHasData}
              heightClassName="h-52"
              ticks={moodTrendTicks}
              emptyMessage={
                timeRange === "Week"
                  ? "No mood entries recorded this week."
                  : timeRange === "Month"
                  ? "No mood entries recorded this month."
                  : timeRange === "3 Months"
                  ? "No mood entries recorded in the last 3 months."
                  : "No mood entries recorded yet."
              }
            />
          </Card>

          {/* Journaling Calendar */}
          <Card className="p-6 bg-white">
            <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-4 flex items-center gap-2">
              <span>🗓️</span>
              Journaling Calendar —{" "}
              {new Date().toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </h3>
            <div className="mb-4 grid grid-cols-7 gap-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                <div
                  key={i}
                  className="text-center text-[10px] font-poppins text-[#4F4F4F]/60 py-1"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => {
                const firstDay = new Date(
                  new Date().getFullYear(),
                  new Date().getMonth(),
                  1
                ).getDay();
                const date  = i - firstDay + 1;
                const year  = new Date().getFullYear();
                const month = new Date().getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                if (date < 1 || date > daysInMonth) {
                  return (
                    <div key={i} className="aspect-square bg-transparent" />
                  );
                }

                const entryDate = new Date(year, month, date);
                const dayEntries = entries.filter(
                  (e) =>
                    new Date(e.created_at).toDateString() ===
                    entryDate.toDateString()
                );
                const sentiment =
                  dayEntries.length > 0
                    ? getEntrySentiment(dayEntries[0])
                    : null;
                const bgColor =
                  sentiment === "positive"
                    ? "bg-[#A8DADC]"
                    : sentiment === "negative"
                    ? "bg-[#F4A6A6]"
                    : sentiment === "distress"
                    ? "bg-[#fca5a5]"
                    : "bg-white border border-[#F5F5F5]";

                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-sm flex items-center justify-center text-[10px] font-inter text-[#4F4F4F] ${bgColor}`}
                  >
                    {date}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Emotion Distribution */}
          <Card className="p-6 bg-white">
            <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-6 flex items-center gap-2">
              <span>🎨</span>
              Emotion Distribution
            </h3>
            <div className="flex items-center gap-6">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="25" fill="white" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xl font-dm-serif text-[#4F4F4F]">
                      {positivePercentage}%
                    </p>
                    <p className="text-[10px] font-inter text-[#4F4F4F]/60">
                      Positive
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {Object.entries(emotionDistribution).map(([label, count]) => {
                  const pct =
                    totalEntries > 0
                      ? Math.round((count / totalEntries) * 100)
                      : 0;
                  return (
                    <div
                      key={label}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor:
                              moodColors[label as keyof typeof moodColors],
                          }}
                        />
                        <span className="text-xs font-inter text-[#4F4F4F]">
                          {label}
                        </span>
                      </div>
                      <span className="text-xs font-poppins text-[#4F4F4F]/70">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Top Emotional Keywords */}
          <Card className="p-6 bg-white">
            <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-4 flex items-center gap-2">
              <span>🔤</span>
              Top Emotional Keywords
            </h3>
            <div className="flex flex-wrap gap-2">
              {topKeywords.map((kw, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-full text-xs font-inter text-[#4F4F4F]"
                  style={{ backgroundColor: `${kw.color}40` }}
                >
                  {kw.word}
                </span>
              ))}
            </div>

            {/* Emotional Trend */}
            <div className="mt-6 pt-4 border-t border-[#F5F5F5]">
              <h4 className="text-xs font-poppins uppercase tracking-wider text-[#4F4F4F]/60 mb-4 flex items-center gap-2">
                <span>📉</span>
                Emotional Trend
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-inter text-[#4F4F4F] mb-1">
                    <span>Positivity trend</span>
                    <span
                      className={
                        positivePercentage >= 50
                          ? "text-[#A8DADC]"
                          : "text-[#F4A6A6]"
                      }
                    >
                      {positivePercentage >= 50 ? "↑ Growing" : "↓ Decreasing"}
                    </span>
                  </div>
                  <div className="h-2 bg-[#d8e2ed] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-blue to-success-green rounded-full"
                      style={{ width: `${positivePercentage}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-inter text-[#4F4F4F] mb-1">
                    <span>Stress levels</span>
                    <span className="text-[#F4A6A6]">
                      {positivePercentage >= 50 ? "↓ Decreasing" : "↑ Increasing"}
                    </span>
                  </div>
                  <div className="h-2 bg-[#d8e2ed] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-error-red to-warning-yellow rounded-full"
                      style={{ width: `${100 - positivePercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Quick nav to dedicated Mood Trends visualization page ────── */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-light-gray">
        <div>
          <p className="text-sm font-poppins font-semibold text-dark-text">
            📊 Mood Trend Visualization
          </p>
          <p className="text-xs text-dark-text/50 font-inter mt-0.5">
            Full charts: Distribution · Weekly · Monthly · Wellness Trend · Behavioral Trend · Distress Risk
          </p>
        </div>
        <Link
          href="/mood-trends"
          className="shrink-0 px-4 py-2 bg-[#A8DADC] hover:bg-[#4EAAB3] text-white text-xs font-poppins font-semibold rounded-full transition-colors"
        >
          View All Charts →
        </Link>
      </div>
    </>
  );
}
