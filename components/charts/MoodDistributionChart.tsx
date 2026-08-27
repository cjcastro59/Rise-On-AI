"use client";

// =====================================================================
// components/charts/MoodDistributionChart.tsx  —  Phase 5
// Recharts PieChart — Positive / Negative / Distress distribution
// Data source: journal_entries.sentiment (stored XLM-R classification)
// Only counts entries where sentiment IS NOT NULL.
// Sentiment classes: POSITIVE | NEGATIVE | DISTRESS  (no Neutral)
// =====================================================================

import { useId } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  TooltipContentProps,
} from "recharts";
import type { MoodDistributionData } from "@/hooks/useMoodVisualization";

// ── Colour tokens — must match the project's 3-class palette ─────────────────
const COLOURS = {
  positive: { fill: "#A8DADC", stroke: "#4EAAB3", label: "Positive" },
  negative: { fill: "#FFE8A1", stroke: "#E9C46A", label: "Negative" },
  distress: { fill: "#F4A6A6", stroke: "#E76F51", label: "Distress" },
} as const;

// ── Custom tooltip ────────────────────────────────────────────────────────────
function DistributionTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: pt } = payload[0];
  const pct = (pt as any)?.percent != null
    ? `${Math.round((pt as any).percent * 100)}%`
    : "";
  return (
    <div className="rounded-xl bg-white px-4 py-2.5 shadow-lg border border-light-gray text-left">
      <p className="text-xs font-poppins text-dark-text/60 mb-0.5">{name}</p>
      <p className="text-sm font-poppins font-semibold text-dark-text">
        {value} entr{value === 1 ? "y" : "ies"}
      </p>
      {pct && <p className="text-xs text-dark-text/50">{pct} of total</p>}
    </div>
  );
}

// ── Custom legend ──────────────────────────────────────────────────────────────
function DistributionLegend({
  data,
}: {
  data: { name: string; value: number; percent: number; colour: string }[];
}) {
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-3">
      {data.map((d) => (
        <div key={d.name} className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: d.colour }}
          />
          <span className="text-[11px] font-inter text-dark-text/70">
            {d.name}
          </span>
          <span className="text-[11px] font-poppins font-semibold text-dark-text/80">
            {d.percent}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface MoodDistributionChartProps {
  data: MoodDistributionData | null;
  loading: boolean;
  /** Chart height in px. Default: 220 */
  height?: number;
  /** Show the total-entries label in the centre. Default: true */
  showCentreLabel?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MoodDistributionChart({
  data,
  loading,
  height = 220,
  showCentreLabel = true,
}: MoodDistributionChartProps) {
  const gradId = useId();

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-light-gray/30"
        style={{ height }}
      >
        <p className="text-xs text-dark-text/50 font-poppins">
          Loading distribution…
        </p>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!data || data.total === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-xl bg-light-gray/30"
        style={{ height }}
      >
        <span className="text-2xl">📊</span>
        <p className="text-xs text-dark-text/50 font-poppins text-center px-4">
          No classified entries yet.
          <br />
          Write a journal entry to see your mood distribution.
        </p>
      </div>
    );
  }

  // ── Pie data ───────────────────────────────────────────────────────────────
  const pieData = [
    {
      name:    COLOURS.positive.label,
      value:   data.positive,
      percent: data.positivePercent,
      colour:  COLOURS.positive.fill,
      stroke:  COLOURS.positive.stroke,
    },
    {
      name:    COLOURS.negative.label,
      value:   data.negative,
      percent: data.negativePercent,
      colour:  COLOURS.negative.fill,
      stroke:  COLOURS.negative.stroke,
    },
    {
      name:    COLOURS.distress.label,
      value:   data.distress,
      percent: data.distressPercent,
      colour:  COLOURS.distress.fill,
      stroke:  COLOURS.distress.stroke,
    },
  ].filter((d) => d.value > 0); // hide zero-count slices from pie

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={3}
            dataKey="value"
            nameKey="name"
            animationBegin={0}
            animationDuration={500}
            isAnimationActive
          >
            {pieData.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.colour}
                stroke={entry.stroke}
                strokeWidth={1.5}
              />
            ))}
          </Pie>
          <Tooltip content={DistributionTooltip} />
        </PieChart>
      </ResponsiveContainer>

      {/* Centre label (donut centre) — rendered as an overlay */}
      {showCentreLabel && (
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          aria-hidden
        >
          <p className="text-2xl font-dm-serif text-dark-text leading-none">
            {data.total}
          </p>
          <p className="text-[10px] font-inter text-dark-text/50 mt-0.5">
            entries
          </p>
        </div>
      )}

      {/* Legend below chart */}
      <DistributionLegend data={pieData} />
    </div>
  );
}
