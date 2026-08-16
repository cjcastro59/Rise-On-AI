// =====================================================================
// lib/distress-risk.ts  —  Phase 4.3
// Distress Risk Indicator (DRI)
// =====================================================================
//
// IMPORTANT DISCLAIMER
// ────────────────────
// This module is a DECISION-SUPPORT TOOL only.
// It does NOT diagnose mental health disorders.
// It does NOT provide clinical assessments.
// It does NOT replace professional counseling or psychiatric evaluation.
// Output is a system-generated risk indicator for informational purposes.
//
// DOCUMENTED MODULE (README §9)
// ──────────────────────────────
// Inputs (per README):
//   1. Predicted Sentiment Classification  → latest sentiment label
//   2. Behavioral Trend Score              → from behavioral_indicators
//   3. Wellness Score                      → from behavioral_indicators
//   4. Consecutive Negative Journal Entries→ from behavioral_indicators
//   5. Historical Emotional Patterns       → distress frequency in window
//
// Conditions evaluated (per README):
//   - Frequency of negative entries
//   - Consecutive negative entries
//   - Declining Wellness Score
//   - Repeated distress-related classifications
//
// Risk levels (per README):
//   Low Risk → Moderate Risk → High Risk → Critical Risk
//
// ── DECISION LOGIC ───────────────────────────────────────────────────
//
// Five independent conditions are checked. Each adds points.
// The total point tally maps to a risk level.
//
// CONDITION 1 — Latest Sentiment Classification
//   "distress"  → +3  (repeated distress classification, highest weight)
//   "negative"  → +1  (negative tone, moderate weight)
//   "positive"  → +0
//   Maps to: "Repeated distress-related classifications"
//
// CONDITION 2 — Consecutive Negative/Distress Streak
//   streak ≥ 7  → +3  (sustained unbroken pattern)
//   streak ≥ 5  → +2  (moderate pattern)
//   streak ≥ 3  → +1  (emerging pattern)
//   streak < 3  → +0
//   Maps to: "Consecutive negative entries"
//
// CONDITION 3 — Wellness Score (current level)
//   score < 2.0 → +3  (High Risk wellness)
//   score < 4.0 → +2  (At Risk wellness)
//   score < 6.0 → +1  (Moderate Concern)
//   score ≥ 6.0 → +0
//   Maps to: "Declining Wellness Score"
//
// CONDITION 4 — Behavioral Trend Score (trajectory)
//   bts ≤ −50  → +2  (sharply declining trajectory)
//   bts ≤ −20  → +1  (mild decline)
//   bts > −20  → +0
//   Maps to: "Frequency of negative entries" (via trajectory direction)
//
// CONDITION 5 — Distress Entry Frequency in Window
//   distressRatio ≥ 0.50  → +2  (majority of entries are distress)
//   distressRatio ≥ 0.25  → +1  (notable distress frequency)
//   otherwise              → +0
//   Maps to: "Historical emotional patterns" + "Frequency of negative entries"
//
// POINT → RISK LEVEL MAPPING:
//   0–1   → Low Risk       (no meaningful pattern)
//   2–3   → Moderate Risk  (one or two signals present)
//   4–6   → High Risk      (multiple signals compounding)
//   7+    → Critical Risk  (strong multi-condition pattern)
//
//   Maximum possible: 3 + 3 + 3 + 2 + 2 = 13 points.
//   Critical threshold at 7 = 54% of max.
//   A single "distress" sentiment alone scores 3 → Moderate Risk only.
//   Critical requires at least two conditions firing together.
//
// =====================================================================

import type { SentimentLabel } from "@/lib/behavioral-analytics";
import type { WellnessLevel }  from "@/lib/wellness-assessment";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DistressRiskLevel =
  | "Low Risk"
  | "Moderate Risk"
  | "High Risk"
  | "Critical Risk";

export interface DistressRiskInput {
  // Step 1 — Latest sentiment classification
  latestSentiment: SentimentLabel | null;

  // Step 2 — Behavioral indicators (from behavioral_indicators row)
  behavioralTrendScore:    number;          // −100 to +100
  consecutiveNegativeCount: number;         // 0 → unbounded

  // Step 3 — Wellness Assessment outputs
  wellnessScore: number | null;             // 0.00–10.00, null = not yet computed
  wellnessLevel: WellnessLevel | null;

  // Step 5 — Historical pattern: distress frequency in lookback window
  totalEntriesWindow: number;              // total entries in window (≥ 0)
  distressEntriesWindow: number;           // entries with sentiment = "distress" in window
}

/** Per-condition breakdown — which condition fired and how many points it contributed */
export interface DistressRiskConditionResult {
  /** Short identifier for the condition */
  conditionId: string;
  /** Human-readable label for Capstone documentation */
  label: string;
  /** Points awarded by this condition (0–3) */
  points: number;
  /** Whether this condition fired (points > 0) */
  triggered: boolean;
  /** Observed value that was evaluated */
  observedValue: string;
}

export interface DistressRiskDetails {
  /** Sanitised input values actually used in computation */
  sanitisedInput: {
    latestSentiment: SentimentLabel | "none";
    behavioralTrendScore: number;
    consecutiveNegativeCount: number;
    wellnessScore: number;
    totalEntriesWindow: number;
    distressEntriesWindow: number;
    distressRatio: number;
  };
  /** Results for each of the 5 conditions */
  conditions: DistressRiskConditionResult[];
  /** Sum of all condition points */
  totalPoints: number;
  /** Whether any input was out of expected range */
  inputClamped: boolean;
  /** Point threshold used for each risk level */
  thresholds: {
    lowRisk:      [number, number];   // [min, max] inclusive
    moderateRisk: [number, number];
    highRisk:     [number, number];
    criticalRisk: [number, number];
  };
}

export interface DistressRiskResult {
  /** Risk level classification per README §9 */
  riskLevel: DistressRiskLevel;
  /** Total points accumulated across all conditions */
  totalPoints: number;
  /** Full breakdown for Capstone documentation */
  details: DistressRiskDetails;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const THRESHOLDS: DistressRiskDetails["thresholds"] = {
  lowRisk:      [0, 1],
  moderateRisk: [2, 3],
  highRisk:     [4, 6],
  criticalRisk: [7, 99],
};

const MAX_WELLNESS_SCORE = 10;
const MIN_WELLNESS_SCORE = 0;
const BTS_MIN = -100;
const BTS_MAX =  100;

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Input sanitisation ────────────────────────────────────────────────────────

interface SanitisedDRIInput {
  latestSentiment:         SentimentLabel | "none";
  behavioralTrendScore:    number;
  consecutiveNegativeCount: number;
  wellnessScore:           number;    // defaults to mid-point (5.0) when null
  totalEntriesWindow:      number;
  distressEntriesWindow:   number;
  distressRatio:           number;
  inputClamped:            boolean;
}

function sanitise(raw: DistressRiskInput): SanitisedDRIInput {
  let clamped = false;

  const latestSentiment: SentimentLabel | "none" =
    raw.latestSentiment === "positive" ||
    raw.latestSentiment === "negative" ||
    raw.latestSentiment === "distress"
      ? raw.latestSentiment
      : "none";

  const bts = clamp(
    isFinite(raw.behavioralTrendScore) ? raw.behavioralTrendScore : 0,
    BTS_MIN, BTS_MAX,
  );
  if (bts !== raw.behavioralTrendScore) {
    clamped = true;
    console.warn(`[distress-risk] behavioralTrendScore out of range → clamped to ${bts}`);
  }

  const streak = Math.max(
    0,
    isFinite(raw.consecutiveNegativeCount) ? Math.floor(raw.consecutiveNegativeCount) : 0,
  );
  if (streak !== raw.consecutiveNegativeCount) clamped = true;

  // If wellness score is null (not yet computed), default to 5.0 (Moderate Concern boundary)
  // so the module can still run — the wellness condition simply contributes 0 points at 5.0
  const wellnessScore = raw.wellnessScore !== null && isFinite(raw.wellnessScore)
    ? clamp(raw.wellnessScore, MIN_WELLNESS_SCORE, MAX_WELLNESS_SCORE)
    : 5.0;
  if (raw.wellnessScore !== null && wellnessScore !== raw.wellnessScore) {
    clamped = true;
    console.warn(`[distress-risk] wellnessScore out of range → clamped to ${wellnessScore}`);
  }

  const total   = Math.max(0, isFinite(raw.totalEntriesWindow) ? Math.floor(raw.totalEntriesWindow) : 0);
  const distress = Math.min(total, Math.max(0, isFinite(raw.distressEntriesWindow) ? Math.floor(raw.distressEntriesWindow) : 0));
  const ratio   = total > 0 ? round2(distress / total) : 0;

  return {
    latestSentiment,
    behavioralTrendScore:    bts,
    consecutiveNegativeCount: streak,
    wellnessScore,
    totalEntriesWindow:      total,
    distressEntriesWindow:   distress,
    distressRatio:           ratio,
    inputClamped:            clamped,
  };
}

// ── Risk level classifier ─────────────────────────────────────────────────────

export function classifyDistressRiskLevel(points: number): DistressRiskLevel {
  if (points >= THRESHOLDS.criticalRisk[0]) return "Critical Risk";
  if (points >= THRESHOLDS.highRisk[0])     return "High Risk";
  if (points >= THRESHOLDS.moderateRisk[0]) return "Moderate Risk";
  return "Low Risk";
}

// ── Condition evaluators ──────────────────────────────────────────────────────

function evalCondition1(s: SanitisedDRIInput): DistressRiskConditionResult {
  let points = 0;
  if      (s.latestSentiment === "distress")  points = 3;
  else if (s.latestSentiment === "negative")  points = 1;
  return {
    conditionId:   "C1_SENTIMENT",
    label:         "Latest Sentiment Classification",
    points,
    triggered:     points > 0,
    observedValue: s.latestSentiment,
  };
}

function evalCondition2(s: SanitisedDRIInput): DistressRiskConditionResult {
  let points = 0;
  if      (s.consecutiveNegativeCount >= 7) points = 3;
  else if (s.consecutiveNegativeCount >= 5) points = 2;
  else if (s.consecutiveNegativeCount >= 3) points = 1;
  return {
    conditionId:   "C2_STREAK",
    label:         "Consecutive Negative/Distress Entries",
    points,
    triggered:     points > 0,
    observedValue: `${s.consecutiveNegativeCount} consecutive entries`,
  };
}

function evalCondition3(s: SanitisedDRIInput): DistressRiskConditionResult {
  let points = 0;
  if      (s.wellnessScore < 2.0) points = 3;
  else if (s.wellnessScore < 4.0) points = 2;
  else if (s.wellnessScore < 6.0) points = 1;
  return {
    conditionId:   "C3_WELLNESS",
    label:         "Wellness Score Level",
    points,
    triggered:     points > 0,
    observedValue: `${s.wellnessScore.toFixed(2)} / 10`,
  };
}

function evalCondition4(s: SanitisedDRIInput): DistressRiskConditionResult {
  let points = 0;
  if      (s.behavioralTrendScore <= -50) points = 2;
  else if (s.behavioralTrendScore <= -20) points = 1;
  return {
    conditionId:   "C4_TREND",
    label:         "Behavioral Trend Score (Declining Trajectory)",
    points,
    triggered:     points > 0,
    observedValue: `BTS = ${s.behavioralTrendScore}`,
  };
}

function evalCondition5(s: SanitisedDRIInput): DistressRiskConditionResult {
  let points = 0;
  if      (s.distressRatio >= 0.5)  points = 2;
  else if (s.distressRatio >= 0.25) points = 1;
  return {
    conditionId:   "C5_DISTRESS_FREQ",
    label:         "Distress Entry Frequency in Window",
    points,
    triggered:     points > 0,
    observedValue: `${s.distressEntriesWindow}/${s.totalEntriesWindow} entries (${Math.round(s.distressRatio * 100)}%)`,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compute the Distress Risk Indicator from the documented inputs.
 *
 * This is a decision-support tool — NOT a clinical diagnosis.
 * Output must always be presented with appropriate disclaimers in the UI.
 */
export function computeDistressRisk(input: DistressRiskInput): DistressRiskResult {
  const s = sanitise(input);

  const c1 = evalCondition1(s);
  const c2 = evalCondition2(s);
  const c3 = evalCondition3(s);
  const c4 = evalCondition4(s);
  const c5 = evalCondition5(s);

  const totalPoints = c1.points + c2.points + c3.points + c4.points + c5.points;
  const riskLevel   = classifyDistressRiskLevel(totalPoints);

  return {
    riskLevel,
    totalPoints,
    details: {
      sanitisedInput: {
        latestSentiment:         s.latestSentiment,
        behavioralTrendScore:    s.behavioralTrendScore,
        consecutiveNegativeCount: s.consecutiveNegativeCount,
        wellnessScore:           s.wellnessScore,
        totalEntriesWindow:      s.totalEntriesWindow,
        distressEntriesWindow:   s.distressEntriesWindow,
        distressRatio:           s.distressRatio,
      },
      conditions:  [c1, c2, c3, c4, c5],
      totalPoints,
      inputClamped: s.inputClamped,
      thresholds:  THRESHOLDS,
    },
  };
}

// ── UI configuration ──────────────────────────────────────────────────────────

export const DISTRESS_RISK_CONFIG: Record<
  DistressRiskLevel,
  { color: string; bgColor: string; borderColor: string; emoji: string; description: string; supportMessage: string }
> = {
  "Low Risk": {
    color:          "#2D6A4F",
    bgColor:        "#B7E4C7",
    borderColor:    "#52B788",
    emoji:          "🟢",
    description:    "No significant distress patterns detected.",
    supportMessage: "Keep journaling regularly to maintain awareness of your emotional health.",
  },
  "Moderate Risk": {
    color:          "#7B5E2A",
    bgColor:        "#FFE8A1",
    borderColor:    "#E9C46A",
    emoji:          "🟡",
    description:    "Some patterns suggest emotional difficulty.",
    supportMessage: "Consider reaching out to a trusted person. Regular journaling and self-care can help.",
  },
  "High Risk": {
    color:          "#9B3A1E",
    bgColor:        "#F4A6A6",
    borderColor:    "#E76F51",
    emoji:          "🟠",
    description:    "Multiple distress-related patterns detected.",
    supportMessage: "We encourage you to speak with a counselor or trusted adult. You are not alone.",
  },
  "Critical Risk": {
    color:          "#7B1C1C",
    bgColor:        "#FECACA",
    borderColor:    "#EF4444",
    emoji:          "🔴",
    description:    "Strong and persistent distress signals detected across multiple indicators.",
    supportMessage: "Please reach out to a counselor, trusted adult, or crisis support line as soon as possible.",
  },
};

/** Point range description for each risk level (for Capstone documentation) */
export const DISTRESS_RISK_POINT_RANGES: Record<DistressRiskLevel, string> = {
  "Low Risk":      "0–1 points",
  "Moderate Risk": "2–3 points",
  "High Risk":     "4–6 points",
  "Critical Risk": "7+ points",
};
