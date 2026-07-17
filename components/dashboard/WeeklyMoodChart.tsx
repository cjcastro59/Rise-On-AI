"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import type { MoodTrendPoint } from "@/hooks/useMoodTrend";

function MoodTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload as MoodTrendPoint;
  if (point.score === null) return null;
  return (
    <div className="rounded-lg bg-white px-3 py-2 shadow-md border border-light-gray">
      <p className="text-xs font-poppins text-dark-text/70">{point.tooltipLabel}</p>
      <p className="text-sm font-poppins text-dark-text">
        {point.emoji} {point.mood || "Mood logged"}
      </p>
      <p className="text-xs font-poppins text-dark-text/70">Score: {point.score}</p>
    </div>
  );
}

interface WeeklyMoodChartProps {
  data: MoodTrendPoint[];
  loading: boolean;
  hasData: boolean;
  heightClassName?: string;
  // Explicit sparse X-axis ticks (e.g. ["1","5","10",...]). Omit to render
  // every point as a tick — used for the fixed 7-day week view, where every
  // day must always be visible.
  ticks?: string[];
  emptyMessage?: string;
}

// Shared smooth area-line chart for mood trend data, reused by both the
// Dashboard's "Your Mood This Week" and Mood Insights' "Mood Trajectory"
// widgets so they always render the same dataset the same way.
export default function WeeklyMoodChart({
  data,
  loading,
  hasData,
  heightClassName = "h-48",
  ticks,
  emptyMessage = "No mood entries recorded this week.",
}: WeeklyMoodChartProps) {
  const gradientId = useId();

  if (loading) {
    return (
      <div className={`${heightClassName} flex items-center justify-center`}>
        <p className="text-sm text-dark-text/70 font-poppins">Loading mood data...</p>
      </div>
    );
  }

  return (
    <div className={`${heightClassName} relative`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#A8DADC" stopOpacity={0.55} />
              <stop offset="95%" stopColor="#CDB4DB" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#EAEAEA" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "rgba(79,79,79,0.6)" }}
            ticks={ticks}
            interval={ticks ? "preserveStartEnd" : 0}
          />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            allowDecimals={false}
            width={24}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "rgba(79,79,79,0.6)" }}
          />
          <Tooltip content={MoodTooltip} />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#A8DADC"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            connectNulls={false}
            dot={{ r: 4, stroke: "#A8DADC", strokeWidth: 2, fill: "#fff" }}
            activeDot={{ r: 6, stroke: "#A8DADC", strokeWidth: 2, fill: "#fff" }}
            isAnimationActive
            animationDuration={400}
          />
        </AreaChart>
      </ResponsiveContainer>
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-dark-text/70 font-poppins bg-white/85 px-3 py-1 rounded-full">
            {emptyMessage}
          </p>
        </div>
      )}
    </div>
  );
}
