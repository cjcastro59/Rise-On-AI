"use client";

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

const clampTrendScore = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : null;
};

function getTrendState(score: number) {
  if (score >= 70) return { label: "Elevated concern", color: "#f77f7f" };
  if (score >= 40) return { label: "Moderate concern", color: "#E9C46A" };
  return { label: "Low concern", color: "#52b788" };
}

function BTSTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload as BehavioralTrendPoint;
  const score = clampTrendScore(pt.bts) ?? 0;
  const state = getTrendState(score);

  return (
    <div className="rounded-xl bg-white px-4 py-2.5 shadow-lg border border-light-gray text-left min-w-[140px]">
      <p className="text-[10px] font-inter text-dark-text/50 mb-1">{pt.date}</p>
      <p className="text-sm font-poppins font-bold" style={{ color: state.color }}>
        {score.toFixed(0)} / 100
      </p>
      <p className="text-[10px] font-poppins mt-0.5" style={{ color: state.color }}>
        {state.label}
      </p>
    </div>
  );
}

function formatDateTick(val: string) {
  if (!val || val.length < 7) return val;
  return val.slice(5);
}

interface BehavioralTrendChartProps {
  data: BehavioralTrendPoint[];
  loading: boolean;
  height?: number;
}

export default function BehavioralTrendChart({
  data,
  loading,
  height = 240,
}: BehavioralTrendChartProps) {
  const gradId = useId();
  const safeData = (Array.isArray(data) ? data : [])
    .map((pt) => {
      const bts = clampTrendScore(pt?.bts);
      const date = typeof pt?.date === "string" ? pt.date : "";
      return date && bts !== null ? { date, bts } : null;
    })
    .filter((pt): pt is BehavioralTrendPoint => Boolean(pt));

  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-light-gray/30"
        style={{ height }}
      >
        <p className="text-xs text-dark-text/50 font-poppins">
          Loading behavioral trend...
        </p>
      </div>
    );
  }

  if (!safeData.length) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-xl bg-light-gray/30"
        style={{ height }}
      >
        <span className="text-2xl">BT</span>
        <p className="text-xs text-dark-text/50 font-poppins text-center px-4">
          No behavioral trend data yet.
          <br />
          Save journal entries to track your trend.
        </p>
      </div>
    );
  }

  const ticks: string[] = [];
  safeData.forEach((pt, i) => {
    if (i === 0 || i === safeData.length - 1 || i % 7 === 0) ticks.push(pt.date);
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={safeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F4A6A6" stopOpacity={0.55} />
            <stop offset="95%" stopColor="#B7E4C7" stopOpacity={0.08} />
          </linearGradient>
        </defs>

        <ReferenceLine
          y={70}
          stroke="#F4A6A6"
          strokeDasharray="4 3"
          strokeWidth={1}
          label={{ value: "Elevated", position: "insideTopLeft", fontSize: 9, fill: "#f77f7f" }}
        />
        <ReferenceLine
          y={40}
          stroke="#E9C46A"
          strokeDasharray="4 3"
          strokeWidth={1}
          label={{ value: "Moderate", position: "insideTopLeft", fontSize: 9, fill: "#7B5E2A" }}
        />

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
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "rgba(79,79,79,0.6)" }}
          width={30}
        />

        <Tooltip content={BTSTooltip} />

        <Area
          type="monotone"
          dataKey="bts"
          name="Behavioral Trend Score"
          stroke="#A8DADC"
          strokeWidth={2.5}
          fill={`url(#${gradId})`}
          dot={(props: any) => {
            const { cx, cy, payload } = props;
            const score = clampTrendScore(payload?.bts) ?? 0;
            const state = getTrendState(score);
            return (
              <circle
                key={`dot-${cx}-${cy}`}
                cx={cx}
                cy={cy}
                r={3}
                stroke={state.color}
                strokeWidth={2}
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
