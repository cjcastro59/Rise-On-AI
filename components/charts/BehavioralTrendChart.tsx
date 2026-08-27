"use client";

// =====================================================================
// components/charts/BehavioralTrendChart.tsx  —  Phase 5
// Recharts LineChart — Behavioral Trend Score over time
// Data source: behavioral_indicators.behavioral_trend_score (−100 to +100)
//              keyed by window_end_date
// Zero reference line separates improving (+) from declining (−) regions.
// Line colour reflects current direction: green ≥ 10, red ≤ −10, blue neutral.
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
import type { BehavioralTrendPoint } from "@/hooks/useMoodVisualization";

// ── Custom tooltip ────────────────────────────────────────────────────────────
function BTSTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const pt  = payload[0].payload as BehavioralTrendPoint;
  const bts = pt.bts;
  const dir = bts >= 10 ? "↑ Improving" : bts <= -10 ? "↓ Declining" : "→ Stable";
  const clr = bts >= 10 ? "#52b788"     : bts <= -10 ? "#f77f7f"    : "#a8c7dc";
  return (
    <div className="rounded-xl bg-white px-4 py-2.5 shadow-lg border border-light-gray text-left min-w-[140px]">
      <p className="text-[10px] font-inter text-dark-text/50 mb-1">{pt.date}</p>
      <p className="text-sm font-poppins font-bold" style={{ color: clr }}>
        {bts > 0 ? "+" : ""}{bts}
      </p>
      <p className="text-[10px] font-poppins mt-0.5" style={{ color: clr }}>
        {dir}
      </p>
    </div>
  );
}

function formatDateTick(val: string) {
  if (!val || val.length < 7) return val;
  return val.slice(5); // "MM-DD"
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface BehavioralTrendChartProps {
  data: BehavioralTrendPoint[];
  loading: boolean;
  height?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BehavioralTrendChart({
  data,
  loading,
  height = 240,
}: BehavioralTrendChartProps) {
  const gradPosId = useId();
  const gradNegId = useId() + "neg";

  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-light-gray/30"
        style={{ height }}
      >
        <p className="text-xs text-dark-text/50 font-poppins">
          Loading behavioral trend…
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
        <span className="text-2xl">📈</span>
        <p className="text-xs text-dark-text/50 font-poppins text-center px-4">
          No behavioral trend data yet.
          <br />
          Save journal entries to track your trend.
        </p>
      </div>
    );
  }

  const ticks: string[] = [];
  data.forEach((pt, i) => {
    if (i === 0 || i === data.length - 1 || i % 7 === 0) ticks.push(pt.date);
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          {/* Positive region: green tint above zero */}
          <linearGradient id={gradPosId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#B7E4C7" stopOpacity={0.55} />
            <stop offset="50%" stopColor="#B7E4C7" stopOpacity={0.05} />
          </linearGradient>
          {/* Negative region: red tint below zero */}
          <linearGradient id={gradNegId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="5%"  stopColor="#F4A6A6" stopOpacity={0.45} />
            <stop offset="50%" stopColor="#F4A6A6" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Zone labels */}
        <ReferenceLine y={33}  stroke="#B7E4C7" strokeDasharray="4 3" strokeWidth={1}
          label={{ value: "Improving", position: "insideTopLeft", fontSize: 9, fill: "#52B788" }} />
        <ReferenceLine y={0}   stroke="#94a3b8" strokeWidth={1.5} />
        <ReferenceLine y={-33} stroke="#F4A6A6" strokeDasharray="4 3" strokeWidth={1}
          label={{ value: "Declining", position: "insideBottomLeft", fontSize: 9, fill: "#f77f7f" }} />

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
          domain={[-100, 100]}
          ticks={[-100, -50, 0, 50, 100]}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "rgba(79,79,79,0.6)" }}
          width={30}
        />

        <Tooltip content={BTSTooltip} />

        {/* Positive area (above 0) */}
        <Area
          type="monotone"
          dataKey="bts"
          name="Behavioral Trend Score"
          stroke="#A8DADC"
          strokeWidth={2.5}
          fill={`url(#${gradPosId})`}
          dot={(props: any) => {
            const { cx, cy, payload } = props;
            const clr = payload.bts >= 10 ? "#52b788" : payload.bts <= -10 ? "#f77f7f" : "#a8c7dc";
            return (
              <circle
                key={`dot-${cx}-${cy}`}
                cx={cx} cy={cy} r={3}
                stroke={clr} strokeWidth={2}
                fill="#fff"
              />
            );
          }}
          activeDot={{ r: 5, fill: "#fff", strokeWidth: 2, stroke: "#A8DADC" }}
          connectNulls={false}
          isAnimationActive
          animationDuration={500}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
