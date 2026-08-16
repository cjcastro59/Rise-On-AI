// =====================================================================
// lib/wellness-assessment.ts  —  Phase 4.2
// Wellness Assessment: Validated Score Computation
// =====================================================================
//
// PURPOSE
// ───────
// Derives a single Wellness Score (0.00–10.00) from the four behavioral
// indicators computed in lib/behavioral-analytics.ts, following the
// algorithm documented in README §8 (Wellness Assessment).
//
// INPUTS (with validated ranges)
// ──────────────────────────────
//   1. behavioralTrendScore      expected: −100 to +100   (clamped on intake)
//   2. journalingFrequencyScore  expected:    0 to  100   (clamped on intake)
//   3. moodConsistencyScore      expected:    0 to  100   (clamped on intake)
//   4. consecutiveNegativeCount  expected:    0 to  ∞     (clamped ≥ 0)
//
// ALGORITHM
// ─────────
// Each indicator is mapped to a [0, 1] sub-score, then a weighted average
// produces a raw score in [0, 1].  Finally the raw score is scaled to
// [0, 10] and rounded to 2 decimal places.
//
// Sub-score mappings
// ──────────────────
//   1. trendSub      = clamp01( (bts + 100) / 200 )
//                      −100 → 0.0 │ 0 → 0.5 │ +100 → 1.0
//   2. freqSub       = clamp01( jfs / 100 )
//                      linear; full cadence = 1.0
//   3. consistSub    = clamp01( mcs / 100 )
//                      perfectly consistent = 1.0; volatile = 0.0
//   4. streakPenalty = clamp01( streak / PENALTY_CAP ) × PENALTY_WEIGHT
//                      applied post-hoc; cap = 7 entries, max weight = 0.25
//
// WEIGHTS
// ───────
//   Behavioral Trend Score   0.40  — primary trajectory indicator
//   Journaling Frequency     0.20  — engagement proxy
//   Mood Consistency         0.15  — emotional stability
//   Baseline floor           0.25  — ensures data-sparse users ≥ 2.50
//   Streak penalty          −0.25  — post-hoc deduction (safety-critical)
//
//   Total ceiling: 0.40 + 0.20 + 0.15 + 0.25 = 1.00
//   After max penalty: 1.00 − 0.25 = 0.75 → score 7.50/10
//
// FORMULA
// ───────
//   weightedRaw   = (trendSub × 0.40) + (freqSub × 0.20)
//                   + (consistSub × 0.15) + 0.25
//   penalty       = clamp01(streak / 7) × 0.25
//   rawScore      = clamp01(weightedRaw − penalty)
//   wellnessScore = round(rawScore × 10, 2)
//
// WELLNESS LEVELS (from README §8)
// ─────────────────────────────────
//   8.00–10.00 → Healthy
//   6.00–7.99  → Stable
//   4.00–5.99  → Moderate Concern
//   2.00–3.99  → At Risk
//   0.00–1.99  → High Risk
// =====================================================================

// ── Types ─────────────────────────────────────────────────────────────────────

export type WellnessLevel =
  | "Healthy"
  | "Stable"
  | "Moderate Concern"
  | "At Risk"
  | "High Risk";

export interface WellnessScoreInput {
  /** Behavioral Trend Score  expected: −100 to +100 */
  behavioralTrendScore: number;
  /** Journaling Frequency Score  expected: 0 to 100 */
  journalingFrequencyScore: number;
  /** Mood Consistency Score  expected: 0 to 100 */
  moodConsistencyScore: number;
  /** Consecutive Negative Journal Entries count  expected: 0 → unbounded */
  consecutiveNegativeCount: number;
}

/** Breakdown of the wellness computation for Capstone transparency. */
export interface WellnessScoreDetails {
  /** BTS normalised to [0,1]:  (bts + 100) / 200 */
  trendSubScore: number;
  /** JFS normalised to [0,1]:  jfs / 100 */
  frequencySubScore: number;
  /** MCS normalised to [0,1]:  mcs / 100 */
  consistencySubScore: number;
  /** Weighted sum before penalty (includes baseline floor) */
  weightedRaw: number;
  /** Deduction applied for consecutive negative streak */
  streakPenalty: number;
  /** Final raw score in [0,1] before ×10 scaling */
  rawScore: number;
  /** Whether any input was out-of-spec and had to be clamped */
  inputClamped: boolean;
  /** Sanitised input values used in computation */
  sanitisedInput: {
    behavioralTrendScore: number;
    journalingFrequencyScore: number;
    moodConsistencyScore: number;
    consecutiveNegativeCount: number;
  };
}

export interface WellnessScoreResult {
  /** 0.00–10.00 */
  score: number;
  /** Wellness level label per README §8 */
  level: WellnessLevel;
  /** Full computation breakdown — suitable for Capstone documentation */
  details: WellnessScoreDetails;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WEIGHT_TREND        = 0.40;
const WEIGHT_FREQUENCY    = 0.20;
const WEIGHT_CONSISTENCY  = 0.15;
const BASELINE_FLOOR      = 0.25;
/** Number of consecutive negative entries that triggers the full penalty */
const PENALTY_CAP         = 7;
/** Maximum penalty deduction applied to the raw score */
const PENALTY_WEIGHT      = 0.25;

// Input validity bounds (used for clamping & logging)
const BTS_MIN  = -100;
const BTS_MAX  =  100;
const SCORE_MIN =   0;
const SCORE_MAX = 100;
const STREAK_MIN =  0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Input validation + sanitisation ──────────────────────────────────────────

interface SanitisedInput {
  behavioralTrendScore: number;
  journalingFrequencyScore: number;
  moodConsistencyScore: number;
  consecutiveNegativeCount: number;
  inputClamped: boolean;
}

function sanitiseInput(raw: WellnessScoreInput): SanitisedInput {
  let clamped = false;

  const bts = clamp(
    typeof raw.behavioralTrendScore === "number" && isFinite(raw.behavioralTrendScore)
      ? raw.behavioralTrendScore : 0,
    BTS_MIN, BTS_MAX,
  );
  if (bts !== raw.behavioralTrendScore) { clamped = true; console.warn(`[wellness] behavioralTrendScore out of range (${raw.behavioralTrendScore}) → clamped to ${bts}`); }

  const jfs = clamp(
    typeof raw.journalingFrequencyScore === "number" && isFinite(raw.journalingFrequencyScore)
      ? raw.journalingFrequencyScore : 0,
    SCORE_MIN, SCORE_MAX,
  );
  if (jfs !== raw.journalingFrequencyScore) { clamped = true; console.warn(`[wellness] journalingFrequencyScore out of range (${raw.journalingFrequencyScore}) → clamped to ${jfs}`); }

  const mcs = clamp(
    typeof raw.moodConsistencyScore === "number" && isFinite(raw.moodConsistencyScore)
      ? raw.moodConsistencyScore : 0,
    SCORE_MIN, SCORE_MAX,
  );
  if (mcs !== raw.moodConsistencyScore) { clamped = true; console.warn(`[wellness] moodConsistencyScore out of range (${raw.moodConsistencyScore}) → clamped to ${mcs}`); }

  const streak = Math.max(
    STREAK_MIN,
    typeof raw.consecutiveNegativeCount === "number" && isFinite(raw.consecutiveNegativeCount)
      ? Math.floor(raw.consecutiveNegativeCount) : 0,
  );
  if (streak !== raw.consecutiveNegativeCount) { clamped = true; console.warn(`[wellness] consecutiveNegativeCount invalid (${raw.consecutiveNegativeCount}) → sanitised to ${streak}`); }

  return {
    behavioralTrendScore:     bts,
    journalingFrequencyScore: jfs,
    moodConsistencyScore:     mcs,
    consecutiveNegativeCount: streak,
    inputClamped:             clamped,
  };
}

// ── Wellness level classifier ─────────────────────────────────────────────────

export function classifyWellnessLevel(score: number): WellnessLevel {
  if (score >= 8.0) return "Healthy";
  if (score >= 6.0) return "Stable";
  if (score >= 4.0) return "Moderate Concern";
  if (score >= 2.0) return "At Risk";
  return "High Risk";
}

// ── Core computation ──────────────────────────────────────────────────────────

export function computeWellnessScore(
  input: WellnessScoreInput,
): WellnessScoreResult {
  // 1. Validate + sanitise inputs
  const s = sanitiseInput(input);

  // 2. Map each indicator to [0, 1]
  const trendSubScore       = clamp01((s.behavioralTrendScore + 100) / 200);
  const frequencySubScore   = clamp01(s.journalingFrequencyScore / 100);
  const consistencySubScore = clamp01(s.moodConsistencyScore / 100);

  // 3. Weighted sum + baseline floor
  const weightedRaw =
    trendSubScore       * WEIGHT_TREND       +
    frequencySubScore   * WEIGHT_FREQUENCY   +
    consistencySubScore * WEIGHT_CONSISTENCY +
    BASELINE_FLOOR;

  // 4. Consecutive-negative penalty
  const streakPenalty =
    clamp01(s.consecutiveNegativeCount / PENALTY_CAP) * PENALTY_WEIGHT;

  // 5. Final raw score in [0, 1]
  const rawScore = clamp01(weightedRaw - streakPenalty);

  // 6. Scale to [0, 10]
  const score = round2(rawScore * 10);
  const level = classifyWellnessLevel(score);

  return {
    score,
    level,
    details: {
      trendSubScore:       round2(trendSubScore),
      frequencySubScore:   round2(frequencySubScore),
      consistencySubScore: round2(consistencySubScore),
      weightedRaw:         round2(weightedRaw),
      streakPenalty:       round2(streakPenalty),
      rawScore:            round2(rawScore),
      inputClamped:        s.inputClamped,
      sanitisedInput: {
        behavioralTrendScore:     s.behavioralTrendScore,
        journalingFrequencyScore: s.journalingFrequencyScore,
        moodConsistencyScore:     s.moodConsistencyScore,
        consecutiveNegativeCount: s.consecutiveNegativeCount,
      },
    },
  };
}

// ── Row helper: compute directly from a behavioral_indicators DB row ──────────

export interface BehavioralIndicatorsRowForWellness {
  behavioral_trend_score:     number;
  journaling_frequency_score: number;
  mood_consistency_score:     number;
  consecutive_negative_count: number;
}

/**
 * Compute a Wellness Score directly from a `behavioral_indicators` DB row.
 * Avoids having callers manually map field names.
 */
export function computeWellnessScoreFromIndicatorsRow(
  row: BehavioralIndicatorsRowForWellness,
): WellnessScoreResult {
  return computeWellnessScore({
    behavioralTrendScore:     row.behavioral_trend_score,
    journalingFrequencyScore: row.journaling_frequency_score,
    moodConsistencyScore:     row.mood_consistency_score,
    consecutiveNegativeCount: row.consecutive_negative_count,
  });
}

// ── UI config helpers ─────────────────────────────────────────────────────────

export const WELLNESS_LEVEL_CONFIG: Record<
  WellnessLevel,
  { color: string; bgColor: string; borderColor: string; emoji: string; description: string }
> = {
  Healthy: {
    color:       "#2D6A4F",
    bgColor:     "#B7E4C7",
    borderColor: "#52B788",
    emoji:       "🌱",
    description: "Your emotional wellness is in great shape. Keep it up!",
  },
  Stable: {
    color:       "#1D6FA4",
    bgColor:     "#A8DADC",
    borderColor: "#4EAAB3",
    emoji:       "🔵",
    description: "You're doing well overall. Maintain your journaling habit.",
  },
  "Moderate Concern": {
    color:       "#7B5E2A",
    bgColor:     "#FFE8A1",
    borderColor: "#E9C46A",
    emoji:       "🟡",
    description: "Some fluctuation detected. Regular journaling can help.",
  },
  "At Risk": {
    color:       "#9B3A1E",
    bgColor:     "#F4A6A6",
    borderColor: "#E76F51",
    emoji:       "🟠",
    description: "Patterns suggest emotional difficulty. Consider reaching out.",
  },
  "High Risk": {
    color:       "#7B1C1C",
    bgColor:     "#FECACA",
    borderColor: "#EF4444",
    emoji:       "🔴",
    description: "Significant distress signals detected. Please talk to someone.",
  },
};

/** Map a score (0–10) directly to its level config without a separate classify call. */
export function getWellnessConfig(score: number) {
  return WELLNESS_LEVEL_CONFIG[classifyWellnessLevel(score)];
}
