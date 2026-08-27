"use client";

// =====================================================================
// components/charts/DistressRiskChart.tsx  —  Phase 5
// Recharts BarChart — Distress Risk Level over time
// Data source: distress_risk_assessments.risk_level + total_points
//              keyed by assessed_date
// Y-axis: 1=Low Risk → 4=Critical Risk (numeric encoding of ordinal levels)
// Bar colour maps directly to the DRI level colour palette.
// =====================================================================

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import type { DistressRiskPoint } from "@/hooks/useMoodVisualization";
import { DISTRESS_RISK_CONFIG, type DistressRiskLevel } from "@/lib/distress-risk";

// ── Severity → display helpers ────────────────────────────────────────────────
const SEVERITY_LABELS: Record<number, string> = {
  1: "Low",
  2: "Moderate",
  3: "High",
  4: "Critical",
};

const RISK_FILL: Record<string, string> = {
  "Low Risk":      "#B7E4C7",
  "Moderate Risk": "#FFE8A1",
  "High Risk":     "#F4A6A6",
  "Critical Risk": "#FECACA",
};

const RISK_STROKE: Record<string, string> = {
  "Low Risk":      "#52B788",
  "Moderate Risk": "#E9C46A",
  "High Risk":     "#E76F51",
  "Critical Risk": "#EF4444",
};

// ── Custom tooltip ────────────────────────────────────────────────────────────
function RiskTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const pt  = payload[0].payload as DistressRiskPoint;
  const cfg = DISTRESS_RISK_CONFIG[pt.riskLevel as DistressRiskLevel];
  return (
    <div className="rounded-xl bg-white px-4 py-2.5 shadow-lg border border-light-gray text-left min-w-[150px]">
      <p className="text-[10px] font-inter text-dark-text/50 mb-1">{pt.date}</p>
      <p
        className="text-sm font-poppins font-bold"
        style={{ color: cfg?.color ?? "#333" }}
      >
        {cfg?.emoji ?? ""} {pt.riskLevel}
      </p>
      <p className="text-[10px] text-dark-text/50 mt-0.5">
        {pt.totalPoints} point{pt.totalPoints !== 1 ? "s" : ""}
      </p>
      <p className="text-[9px] text-dark-text/35 mt-1 max-w-[160px] leading-snug">
        Decision-support indicator · not a diagnosis
      </p>
    </div>
  );
}

function formatDateTick(val: string) {
  if (!val || val.length < 7) return val;
  return val.slice(5);
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface DistressRiskChartProps {
  data: DistressRiskPoint[];
  loading: boolean;
  height?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DistressRiskChart({
  data,
  loading,
  height = 240,
}: DistressRiskChartProps) {
  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-light-gray/30"
        style={{ height }}
      >
        <p className="text-xs text-dark-text/50 font-poppins">
          Loading distress risk data…
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
        <span className="text-2xl">🛡️</span>
        <p className="text-xs text-dark-text/50 font-poppins text-center px-4">
          No distress risk history yet.
          <br />
          Save journal entries to generate risk assessments.
        </p>
      </div>
    );
  }

  const ticks: string[] = [];
  data.forEach((pt, i) => {
    if (i === 0 || i === data.length - 1 || i % 7 === 0) ticks.push(pt.date);
  });

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid stroke="#EAEAEA" strokeDasharray="3 3" vertical={false} />

          {/* Reference lines at each risk level boundary */}
          <ReferenceLine y={3.5} stroke="#EF4444" strokeDasharray="3 3" strokeWidth={1} />
          <ReferenceLine y={2.5} stroke="#E76F51" strokeDasharray="3 3" strokeWidth={1} />
          <ReferenceLine y={1.5} stroke="#E9C46A" strokeDasharray="3 3" strokeWidth={1} />

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
            domain={[0.5, 4.5]}
            ticks={[1, 2, 3, 4]}
            tickFormatter={(v: number) => SEVERITY_LABELS[v] ?? ""}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "rgba(79,79,79,0.6)" }}
            width={52}
          />

          <Tooltip content={RiskTooltip} />

          <Bar
            dataKey="severity"
            name="Risk Level"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
            isAnimationActive
            animationDuration={500}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={RISK_FILL[entry.riskLevel] ?? "#e5e7eb"}
                stroke={RISK_STROKE[entry.riskLevel] ?? "#94a3b8"}
                strokeWidth={1.5}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Risk level colour legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
        {(["Low Risk", "Moderate Risk", "High Risk", "Critical Risk"] as DistressRiskLevel[]).map((lvl) => {
          const cfg = DISTRESS_RISK_CONFIG[lvl];
          return (
            <div key={lvl} className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm border"
                style={{ backgroundColor: RISK_FILL[lvl], borderColor: RISK_STROKE[lvl] }}
              />
              <span className="text-[10px] font-inter text-dark-text/60">
                {cfg.emoji} {lvl}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-dark-text/30 text-center mt-2 font-inter">
        Decision-support indicator only · not a clinical diagnosis
      </p>
    </div>
  );
}
