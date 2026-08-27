"use client";

// =====================================================================
// components/charts/WellnessScoreTrendChart.tsx  —  Phase 5
// Recharts LineChart — Wellness Score over time
// Data source: behavioral_indicators.wellness_score (0.00–10.00)
//              keyed by window_end_date
// Wellness levels shown as horizontal reference bands:
//   8–10 Healthy  6–8 Stable  4–6 Moderate Concern  2–4 At Risk  0–2 High Risk
// =====================================================================

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import type { WellnessTrendPoint } from "@/hooks/useMoodVisualization";
import { classifyWellnessLevel } from "@/lib/wellness-assessment";
import { WELLNESS_LEVEL_CONFIG } from "@/lib/wellness-assessment";

// ── Custom tooltip ────────────────────────────────────────────────────────────
function WellnessTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload as WellnessTrendPoint;
  const lvl = pt.wellnessLevel || classifyWellnessLevel(pt.wellnessScore);
  const cfg = WELLNESS_LEVEL_CONFIG[lvl as keyof typeof WELLNESS_LEVEL_CONFIG];
  return (
    <div className="rounded-xl bg-white px-4 py-2.5 shadow-lg border border-light-gray text-left min-w-[140px]">
      <p className="text-[10px] font-inter text-dark-text/50 mb-1">
        {pt.date}
      </p>
      <p className="text-sm font-poppins font-bold" style={{ color: cfg?.color ?? "#333" }}>
        {pt.wellnessScore.toFixed(2)} / 10
      </p>
      <span
        className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-poppins"
        style={{ backgroundColor: cfg?.bgColor ?? "#eee", color: cfg?.color ?? "#333" }}
      >
        {cfg?.emoji ?? ""} {lvl}
      </span>
    </div>
  );
}

// ── Formatted X-axis tick — shows MM/DD ───────────────────────────────────────
function formatDateTick(val: string) {
  if (!val || val.length < 7) return val;
  return val.slice(5); // "YYYY-MM-DD" → "MM-DD"
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface WellnessScoreTrendChartProps {
  data: WellnessTrendPoint[];
  loading: boolean;
  height?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function WellnessScoreTrendChart({
  data,
  loading,
  height = 240,
}: WellnessScoreTrendChartProps) {
  const gradId = useId();

  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-light-gray/30"
        style={{ height }}
      >
        <p className="text-xs text-dark-text/50 font-poppins">
          Loading wellness trend…
        </p>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-xl bg-light-gray/30"
        style={{ height }}
      >
        <span className="text-2xl">💚</span>
        <p className="text-xs text-dark-text/50 font-poppins text-center px-4">
          No wellness history yet.
          <br />
          Save journal entries to build your wellness trend.
        </p>
      </div>
    );
  }

  // Sparse X ticks: first, last, and every ~7th point
  const ticks: string[] = [];
  data.forEach((pt, i) => {
    if (i === 0 || i === data.length - 1 || i % 7 === 0) {
      ticks.push(pt.date);
    }
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#B7E4C7" stopOpacity={0.7} />
            <stop offset="95%" stopColor="#B7E4C7" stopOpacity={0.05} />
          </linearGradient>
        </defs>

        {/* Level reference lines */}
        <ReferenceLine y={8} stroke="#B7E4C7" strokeDasharray="4 3" strokeWidth={1}
          label={{ value: "Healthy", position: "insideTopRight", fontSize: 9, fill: "#2D6A4F" }} />
        <ReferenceLine y={6} stroke="#A8DADC" strokeDasharray="4 3" strokeWidth={1}
          label={{ value: "Stable",  position: "insideTopRight", fontSize: 9, fill: "#1D6FA4" }} />
        <ReferenceLine y={4} stroke="#FFE8A1" strokeDasharray="4 3" strokeWidth={1}
          label={{ value: "Mod.",    position: "insideTopRight", fontSize: 9, fill: "#7B5E2A" }} />
        <ReferenceLine y={2} stroke="#F4A6A6" strokeDasharray="4 3" strokeWidth={1}
          label={{ value: "At Risk", position: "insideTopRight", fontSize: 9, fill: "#9B3A1E" }} />

        <CartesianGrid stroke="#EAEAEA" strokeDasharray="3 3" vertical={false} />

        <XAxis
          dataKey="date"
          tickFormatter={formatDateTick}
          ticks={ticks}
          interval="preserveStartEnd"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "rgba(79,79,79,0.6)" }}
        />
        <YAxis
          domain={[0, 10]}
          ticks={[0, 2, 4, 6, 8, 10]}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "rgba(79,79,79,0.6)" }}
          width={22}
        />

        <Tooltip content={WellnessTooltip} />

        <Area
          type="monotone"
          dataKey="wellnessScore"
          name="Wellness Score"
          stroke="#52B788"
          strokeWidth={2.5}
          fill={`url(#${gradId})`}
          dot={{ r: 3, stroke: "#52B788", strokeWidth: 2, fill: "#fff" }}
          activeDot={{ r: 5, stroke: "#52B788", strokeWidth: 2, fill: "#fff" }}
          connectNulls={false}
          isAnimationActive
          animationDuration={500}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
