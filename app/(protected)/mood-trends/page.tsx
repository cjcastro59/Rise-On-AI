"use client";

// =====================================================================
// app/(protected)/mood-trends/page.tsx  —  Phase 5
// Mood Trend Visualization — all 6 required charts
//
// Chart 1 — Mood Distribution     (PieChart)
// Chart 2 — Weekly Mood Trend     (AreaChart — useMoodTrend "Week")
// Chart 3 — Monthly Mood Trend    (AreaChart — useMoodTrend "Month")
// Chart 4 — Wellness Score Trend  (AreaChart — behavioral_indicators)
// Chart 5 — Behavioral Trend      (AreaChart — behavioral_indicators)
// Chart 6 — Distress Risk History (BarChart  — distress_risk_assessments)
//
// ALL charts use only stored database values — no fabricated data.
// Sentiment classes: Positive | Negative | Distress (no Neutral)
// =====================================================================

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/layout/PageHeader";
import WeeklyMoodChart from "@/components/dashboard/WeeklyMoodChart";
import { useMoodVisualization } from "@/hooks/useMoodVisualization";
import { useMoodTrend, type MoodTrendRange } from "@/hooks/useMoodTrend";
import { WELLNESS_LEVEL_CONFIG, type WellnessLevel } from "@/lib/wellness-assessment";
import { DISTRESS_RISK_CONFIG, type DistressRiskLevel } from "@/lib/distress-risk";

// ── Dynamic imports for recharts-heavy chart components ──────────────────────
// Baseline: eager import bundled all 4 recharts charts into the page chunk
// → 19.6 kB page size.
// After: charts lazy-load after hydration, reducing initial JS parse cost.
// Loading fallbacks show skeleton cards to prevent layout shift.
const ChartSkeleton = () => (
  <div className="h-52 flex items-center justify-center rounded-xl bg-light-gray/30 animate-pulse">
    <p className="text-xs text-dark-text/30 font-inter">Loading chart…</p>
  </div>
);

const MoodDistributionChart   = dynamic(
  () => import("@/components/charts/MoodDistributionChart"),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const WellnessScoreTrendChart = dynamic(
  () => import("@/components/charts/WellnessScoreTrendChart"),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const BehavioralTrendChart    = dynamic(
  () => import("@/components/charts/BehavioralTrendChart"),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const DistressRiskChart       = dynamic(
  () => import("@/components/charts/DistressRiskChart"),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

// ── Time range pill button ────────────────────────────────────────────────────
function RangePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-poppins transition-all ${
        active
          ? "bg-[#A8DADC] text-white shadow-md"
          : "bg-gray-100 text-dark-text/60 hover:bg-[#F5F5F5]"
      }`}
    >
      {label}
    </button>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({
  emoji,
  title,
  subtitle,
  action,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-1">
      <div>
        <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 flex items-center gap-2">
          <span>{emoji}</span>
          {title}
        </h3>
        {subtitle && (
          <p className="text-[11px] text-dark-text/40 font-inter mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Summary stat pill ─────────────────────────────────────────────────────────
function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-light-gray">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[10px] font-inter text-dark-text/60">{label}</span>
      <span className="text-xs font-poppins font-semibold text-dark-text">{value}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const MOOD_RANGES: MoodTrendRange[] = ["Week", "Month", "3 Months", "All Time"];

export default function MoodTrendsPage() {
  // Mood trend range for charts 2 & 3 (shared range selector)
  const [moodRange, setMoodRange] = useState<MoodTrendRange>("Month");

  // All 6 visualization datasets from the hook
  const {
    distribution,
    distributionLoading,
    wellnessTrend,
    wellnessTrendLoading,
    behavioralTrend,
    behavioralTrendLoading,
    distressRisk,
    distressRiskLoading,
    refetch,
  } = useMoodVisualization();

  // Charts 2 & 3 use useMoodTrend directly — range driven by moodRange state
  const {
    data:    moodData,
    loading: moodLoading,
    hasData: moodHasData,
    avgScore: moodAvg,
    ticks:   moodTicks,
  } = useMoodTrend(moodRange);

  // ── Derived summary values ─────────────────────────────────────────────────
  const latestWellness   = wellnessTrend.length ? wellnessTrend[wellnessTrend.length - 1] : null;
  const latestBTS        = behavioralTrend.length ? behavioralTrend[behavioralTrend.length - 1] : null;
  const latestRisk       = distressRisk.length ? distressRisk[distressRisk.length - 1] : null;
  const wellnessCfg      = latestWellness?.wellnessLevel
    ? WELLNESS_LEVEL_CONFIG[latestWellness.wellnessLevel as WellnessLevel]
    : null;
  const riskCfg          = latestRisk?.riskLevel
    ? DISTRESS_RISK_CONFIG[latestRisk.riskLevel as DistressRiskLevel]
    : null;
  const btsDir           = latestBTS
    ? latestBTS.bts >= 10 ? "↑ Improving" : latestBTS.bts <= -10 ? "↓ Declining" : "→ Stable"
    : null;

  return (
    <>
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="Mood Trend Visualization"
        subtitle="Historical emotional patterns from your journal data"
        actions={
          <button
            onClick={refetch}
            className="text-xs font-poppins text-[#4EAAB3] hover:underline px-2 py-1"
          >
            ↻ Refresh all
          </button>
        }
      />

      {/* ── Summary banner ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-8">
        {distribution && distribution.total > 0 && (
          <>
            <StatPill label="Positive" value={`${distribution.positivePercent}%`} color="#A8DADC" />
            <StatPill label="Negative" value={`${distribution.negativePercent}%`} color="#FFE8A1" />
            <StatPill label="Distress" value={`${distribution.distressPercent}%`} color="#F4A6A6" />
            <StatPill label="Total entries" value={distribution.total} color="#CDB4DB" />
          </>
        )}
        {latestWellness && wellnessCfg && (
          <StatPill
            label="Wellness"
            value={`${latestWellness.wellnessScore.toFixed(1)} — ${latestWellness.wellnessLevel}`}
            color={wellnessCfg.color}
          />
        )}
        {latestBTS && btsDir && (
          <StatPill
            label="Trend"
            value={`${latestBTS.bts > 0 ? "+" : ""}${latestBTS.bts} ${btsDir}`}
            color={latestBTS.bts >= 10 ? "#52b788" : latestBTS.bts <= -10 ? "#f77f7f" : "#a8c7dc"}
          />
        )}
        {latestRisk && riskCfg && (
          <StatPill
            label="Risk"
            value={`${riskCfg.emoji} ${latestRisk.riskLevel}`}
            color={riskCfg.color}
          />
        )}
      </div>

      {/* ── Row 1: Mood Distribution + Weekly/Monthly Mood Trend ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* ── Chart 1: Mood Distribution ──────────────────────────────── */}
        <Card className="p-6 bg-white">
          <SectionHeader
            emoji="🎯"
            title="Mood Distribution"
            subtitle={`Sentiment breakdown from ${distribution?.total ?? 0} classified entries`}
          />
          {/* Data source disclosure */}
          <p className="text-[10px] text-dark-text/30 font-inter mb-4">
            Source: journal_entries.sentiment · Positive / Negative / Distress only
          </p>
          {/* Relative wrapper so the centre donut label can be absolute */}
          <div className="relative">
            <MoodDistributionChart
              data={distribution}
              loading={distributionLoading}
              height={220}
              showCentreLabel
            />
          </div>
        </Card>

        {/* ── Charts 2 + 3: Mood Trend (time-range toggled) ───────────── */}
        <Card className="p-6 bg-white">
          <SectionHeader
            emoji="📈"
            title={moodRange === "Week" ? "Weekly Mood Trend" : moodRange === "Month" ? "Monthly Mood Trend" : `Mood Trend — ${moodRange}`}
            subtitle="Mood score over time (mood_logs + journal_entries)"
            action={
              moodAvg !== null && (
                <span className="text-[11px] font-poppins text-dark-text/60 bg-light-gray px-2 py-0.5 rounded-full">
                  Avg {moodAvg} / 5
                </span>
              )
            }
          />
          {/* Range selector */}
          <div className="flex flex-wrap gap-1.5 mb-4 mt-2">
            {MOOD_RANGES.map((r) => (
              <RangePill
                key={r}
                label={r}
                active={moodRange === r}
                onClick={() => setMoodRange(r)}
              />
            ))}
          </div>
          <WeeklyMoodChart
            data={moodData}
            loading={moodLoading}
            hasData={moodHasData}
            heightClassName="h-52"
            ticks={moodTicks}
            emptyMessage="No mood data recorded for this period."
          />
          <p className="text-[10px] text-dark-text/30 font-inter mt-2">
            Score 1–5 · mood_logs.score (authoritative) + journal_entries.mood
          </p>
        </Card>
      </div>

      {/* ── Row 2: Wellness Score Trend + Behavioral Trend ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* ── Chart 4: Wellness Score Trend ─────────────────────────── */}
        <Card className="p-6 bg-white">
          <SectionHeader
            emoji="💚"
            title="Wellness Score Trend"
            subtitle="0–10 scale · from behavioral_indicators table"
            action={
              latestWellness && wellnessCfg ? (
                <span
                  className="text-[10px] font-poppins px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: wellnessCfg.bgColor, color: wellnessCfg.color }}
                >
                  {wellnessCfg.emoji} {latestWellness.wellnessScore.toFixed(1)} — {latestWellness.wellnessLevel}
                </span>
              ) : null
            }
          />
          <p className="text-[10px] text-dark-text/30 font-inter mb-4">
            Source: behavioral_indicators.wellness_score · lookback_days=30
          </p>
          <WellnessScoreTrendChart
            data={wellnessTrend}
            loading={wellnessTrendLoading}
            height={240}
          />
          {/* Level scale legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
            {(["Healthy","Stable","Moderate Concern","At Risk","High Risk"] as WellnessLevel[]).map((lvl) => {
              const c = WELLNESS_LEVEL_CONFIG[lvl];
              return (
                <div key={lvl} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.bgColor }} />
                  <span className="text-[9px] font-inter text-dark-text/50">{c.emoji} {lvl}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Chart 5: Behavioral Trend ─────────────────────────────── */}
        <Card className="p-6 bg-white">
          <SectionHeader
            emoji="🧠"
            title="Behavioral Trend"
            subtitle="−100 to +100 · sentiment trajectory over 30-day windows"
            action={
              latestBTS ? (
                <span
                  className="text-[10px] font-poppins px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: latestBTS.bts >= 10 ? "#B7E4C7" : latestBTS.bts <= -10 ? "#F4A6A6" : "#E5E7EB",
                    color:           latestBTS.bts >= 10 ? "#2D6A4F" : latestBTS.bts <= -10 ? "#7B1C1C" : "#6B7280",
                  }}
                >
                  {btsDir} ({latestBTS.bts > 0 ? "+" : ""}{latestBTS.bts})
                </span>
              ) : null
            }
          />
          <p className="text-[10px] text-dark-text/30 font-inter mb-4">
            Source: behavioral_indicators.behavioral_trend_score · positive = improving
          </p>
          <BehavioralTrendChart
            data={behavioralTrend}
            loading={behavioralTrendLoading}
            height={240}
          />
          <div className="flex gap-4 mt-3">
            {[
              { color: "#B7E4C7", label: "+ Improving" },
              { color: "#a8c7dc", label: "→ Stable" },
              { color: "#F4A6A6", label: "− Declining" },
            ].map((d) => (
              <div key={d.label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-[9px] font-inter text-dark-text/50">{d.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Row 3: Distress Risk History (full width) ───────────────────── */}
      <Card className="p-6 bg-white mb-8">
        <SectionHeader
          emoji="🛡️"
          title="Distress Risk Indicators"
          subtitle="Risk level over time · from distress_risk_assessments table"
          action={
            latestRisk && riskCfg ? (
              <span
                className="text-[10px] font-poppins px-2 py-0.5 rounded-full"
                style={{ backgroundColor: riskCfg.bgColor, color: riskCfg.color }}
              >
                {riskCfg.emoji} Latest: {latestRisk.riskLevel}
              </span>
            ) : null
          }
        />
        <p className="text-[10px] text-dark-text/30 font-inter mb-4">
          Source: distress_risk_assessments.risk_level · decision-support only · not a clinical diagnosis
        </p>
        <DistressRiskChart
          data={distressRisk}
          loading={distressRiskLoading}
          height={260}
        />
      </Card>

      {/* ── Bottom disclaimer + navigation ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
        <p className="text-[10px] text-dark-text/35 font-inter max-w-xl text-center sm:text-left">
          All charts reflect stored database values only. Charts update automatically after
          each journal entry. No data is fabricated or interpolated.
          Distress Risk is a decision-support indicator — not a clinical diagnosis.
        </p>
        <div className="flex gap-3 shrink-0">
          <Link
            href="/insights"
            className="text-xs font-poppins text-[#4EAAB3] hover:underline px-3 py-1.5 bg-[#A8DADC]/10 rounded-full"
          >
            Full Insights →
          </Link>
          <Link
            href="/journal"
            className="text-xs font-poppins text-white px-3 py-1.5 bg-[#A8DADC] hover:bg-[#4EAAB3] rounded-full transition-colors"
          >
            Write Entry →
          </Link>
        </div>
      </div>
    </>
  );
}
