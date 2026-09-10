// =====================================================
// BEHAVIORAL ANALYTICS MODULE — Phase 4.1
// Computes 4 indicators from historical journal data.
// Uses ONLY: positive / negative / distress (no Neutral).
// Follows existing patterns in lib/sentiment.ts (analyzeMoodTrend)
// and dashboard streak logic.
// =====================================================

export type SentimentLabel = "positive" | "negative" | "distress";

export interface JournalEntryForAnalytics {
  id: string;
  user_id: string;
  created_at: string;
  sentiment: SentimentLabel | null;
  sentiment_score: number | null;
  positive_percentage: number | null;
  negative_percentage: number | null;
  distress_percentage: number | null;
  confidence: number | null;
}

// =====================================================
// SHARED: Numeric sentiment mapping
// distress = -1, negative = 0, positive = +1
// (mirrors analyzeMoodTrend in lib/sentiment.ts)
// =====================================================
export function sentimentToSignedScore(sentiment: SentimentLabel | null): number {
  if (!sentiment) return 0;
  switch (sentiment) {
    case "positive": return 1;
    case "negative": return 0;
    case "distress": return -1;
  }
}

// =====================================================
// SHARED: Normalize helpers
// =====================================================
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toDateOnlyKey(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// =====================================================
// INDICATOR #1 — BEHAVIORAL TREND SCORE
// -----------------------------------------------------
// DOCUMENTED FORMULA (Algorithm Discussion §Behavioral Analytics):
//   BehavioralTrend = NegativeEntries / TotalEntries
//
// Where:
//   NegativeEntries = entries with sentiment "negative" OR "distress" in window
//   TotalEntries    = all entries in window
//
// OUTPUT RANGE:
//   0.0  → all entries positive (best)
//   0.5  → equal positive and negative
//   1.0  → all entries negative/distress (worst)
//
// The score is stored as 0–100 (ratio × 100) to keep the same
// unit scale as JournalingFrequency and MoodConsistency scores,
// making weighted combination straightforward in the Wellness formula.
// =====================================================
export interface BehavioralTrendResult {
  /** Documented formula: (NegativeEntries / TotalEntries) × 100  →  0–100 */
  score: number;
  /** Raw counts used in the formula */
  negativeEntries: number;
  positiveEntries: number;
  distressEntries: number;
  totalEntries: number;
  entriesInWindow: number;
  oldestEntry: string | null;
  newestEntry: string | null;
}

export function computeBehavioralTrendScore(
  entries: JournalEntryForAnalytics[],
  lookbackDays: number = 30
): BehavioralTrendResult {
  const now = new Date();
  const windowStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const inWindow = entries
    .filter((e) => {
      const d = new Date(e.created_at);
      return d >= windowStart && d <= now;
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const totalEntries = inWindow.length;

  if (totalEntries === 0) {
    return {
      score: 0,
      negativeEntries: 0,
      positiveEntries: 0,
      distressEntries: 0,
      totalEntries: 0,
      entriesInWindow: 0,
      oldestEntry: null,
      newestEntry: null,
    };
  }

  const negativeEntries = inWindow.filter(e => e.sentiment === "negative").length;
  const distressEntries = inWindow.filter(e => e.sentiment === "distress").length;
  const positiveEntries = inWindow.filter(e => e.sentiment === "positive").length;

  // BehavioralTrend = NegativeEntries / TotalEntries (documented formula)
  // Scaled to 0–100 to match the unit scale of the other indicators.
  const ratio = (negativeEntries + distressEntries) / totalEntries;
  const score = round2(ratio * 100);

  return {
    score,
    negativeEntries,
    positiveEntries,
    distressEntries,
    totalEntries,
    entriesInWindow: totalEntries,
    oldestEntry: inWindow[0].created_at,
    newestEntry: inWindow[totalEntries - 1].created_at,
  };
}

// =====================================================
// INDICATOR #2 — JOURNALING FREQUENCY
// -----------------------------------------------------
// INPUT:
//   entries[] — user's journal entries (any order)
//   lookbackDays — window length in days (default 30)
//   expectedCadenceDays — expected gap between journal days
//       default 3 days → user should write ~every 3rd day
//
// COMPUTATION (follows dashboard streak date-bucketing pattern):
//   1. Filter entries inside lookback window
//   2. Count UNIQUE calendar days with ≥1 entry (uniqueDaysJournaled)
//   3. expectedUniqueDays = ceil(lookbackDays / expectedCadenceDays)
//      (For 30-day window, cadence 3 → 10 expected unique days)
//   4. raw = (uniqueDaysJournaled / expectedUniqueDays) × 100
//
// NORMALIZATION:
//   raw is clamped to [0, 100].
//   Users exceeding the cadence cap out at 100.
//
// OUTPUT RANGE:
//   0   → no entries in window
//   50  → user wrote on half the expected days
//   100 → user is at or above the expected journaling cadence
// =====================================================
export interface JournalingFrequencyResult {
  score: number;
  uniqueDaysJournaled: number;
  totalEntriesWindow: number;
  expectedUniqueDays: number;
  expectedCadenceDays: number;
  lookbackDays: number;
  dateKeys: string[];
}

export function computeJournalingFrequency(
  entries: JournalEntryForAnalytics[],
  lookbackDays: number = 30,
  expectedCadenceDays: number = 3
): JournalingFrequencyResult {
  const now = new Date();
  const windowStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const inWindow = entries.filter((e) => {
    const d = new Date(e.created_at);
    return d >= windowStart && d <= now;
  });

  const uniqueDateKeys = new Set(inWindow.map((e) => toDateOnlyKey(e.created_at)));
  const uniqueDaysJournaled = uniqueDateKeys.size;
  const totalEntriesWindow = inWindow.length;
  const expectedUniqueDays = Math.ceil(lookbackDays / expectedCadenceDays);

  const raw = (uniqueDaysJournaled / Math.max(1, expectedUniqueDays)) * 100;
  const score = clamp(round2(raw), 0, 100);

  return {
    score,
    uniqueDaysJournaled,
    totalEntriesWindow,
    expectedUniqueDays,
    expectedCadenceDays,
    lookbackDays,
    dateKeys: Array.from(uniqueDateKeys).sort(),
  };
}

// =====================================================
// INDICATOR #3 — MOOD CONSISTENCY
// -----------------------------------------------------
// INPUT:
//   entries[] — user's journal entries (any order)
//   lookbackDays — window length in days (default 30)
//
// COMPUTATION (variance-based consistency):
//   1. Filter entries inside lookback that have sentiment_score
//      (or fall back to signedScore→normalized)
//   2. If fewer than 3 scorable entries → return 0 (insufficient data)
//   3. Compute μ = mean(scores)
//   4. Compute σ = population stdDev(scores)
//   5. CV = σ / μ (coefficient of variation — volatility per unit mean)
//   6. Consistency = 100 × (1 − min(CV / refCV, 1))
//
//      Where refCV = reference max coefficient of variation.
//      For sentimentScore ∈ [0, 100] with μ ≈ 50,
//      σ = 25 → CV = 0.5 → represents "very volatile".
//      So refCV = 0.5.
//
// NORMALIZATION:
//   CV / refCV is clamped to [0,1], then 1 − that gives consistency.
//
// OUTPUT RANGE:
//   0    → extremely volatile (σ ≈ 25+ around μ≈50)
//   50   → moderate day-to-day swings
//   100  → perfectly consistent (all scores identical)
// =====================================================
export interface MoodConsistencyResult {
  score: number;
  mean: number;
  variance: number;
  std: number;
  cv: number;
  refCv: number;
  entriesScored: number;
  entriesInWindow: number;
  usedFallbackScores: boolean;
}

export function computeMoodConsistency(
  entries: JournalEntryForAnalytics[],
  lookbackDays: number = 30
): MoodConsistencyResult {
  const now = new Date();
  const windowStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const inWindow = entries.filter((e) => {
    const d = new Date(e.created_at);
    return d >= windowStart && d <= now;
  });

  let usedFallbackScores = false;
  const scores: number[] = [];
  for (const e of inWindow) {
    if (typeof e.sentiment_score === "number") {
      scores.push(e.sentiment_score);
    } else if (e.sentiment) {
      usedFallbackScores = true;
      scores.push(sentimentToSignedScore(e.sentiment) * 33.33 + 50);
    }
  }

  if (scores.length < 3) {
    return {
      score: 0,
      mean: 0,
      variance: 0,
      std: 0,
      cv: 0,
      refCv: 0.5,
      entriesScored: scores.length,
      entriesInWindow: inWindow.length,
      usedFallbackScores,
    };
  }

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / scores.length;
  const std = Math.sqrt(variance);
  const cv = mean === 0 ? 0 : std / mean;
  const refCv = 0.5;
  const normalizedCv = clamp(cv / refCv, 0, 1);
  const score = round2(100 * (1 - normalizedCv));

  return {
    score,
    mean: round2(mean),
    variance: round2(variance),
    std: round2(std),
    cv: round2(cv),
    refCv,
    entriesScored: scores.length,
    entriesInWindow: inWindow.length,
    usedFallbackScores,
  };
}

// =====================================================
// INDICATOR #4 — CONSECUTIVE NEGATIVE JOURNAL ENTRIES
// -----------------------------------------------------
// INPUT:
//   entries[] — user's journal entries (any order)
//
// COMPUTATION (walks newest → oldest):
//   1. Sort entries descending by created_at
//   2. Starting from index 0 (most recent), count how many
//      consecutive entries classify as EITHER "negative" OR "distress"
//   3. Stop on the first "positive" (or unscored) entry.
//
//   Note: Entries with NO sentiment label are treated as breaks
//   (cannot be assumed negative), since sentiment was never stored.
//
// NORMALIZATION: None — output is a raw INTEGER count.
//   (Higher = longer current negative streak → higher clinical concern)
//
// OUTPUT RANGE:
//   0 → most recent entry is positive (or no entries)
//   1 → last 1 entry is negative/distress
//   2 → last 2 entries are negative/distress
//   … unbounded
// =====================================================
export interface ConsecutiveNegativeResult {
  count: number;
  streakEntryIds: string[];
  streakSentiments: Array<{ id: string; sentiment: SentimentLabel; createdAt: string }>;
  breakEntry: { id: string; sentiment: SentimentLabel | null; createdAt: string } | null;
}

export function computeConsecutiveNegative(
  entries: JournalEntryForAnalytics[]
): ConsecutiveNegativeResult {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const streak: Array<{ id: string; sentiment: SentimentLabel; createdAt: string }> = [];
  let breakEntry: ConsecutiveNegativeResult["breakEntry"] = null;

  for (const entry of sorted) {
    if (!entry.sentiment) {
      breakEntry = {
        id: entry.id,
        sentiment: null,
        createdAt: entry.created_at,
      };
      break;
    }
    if (entry.sentiment === "negative" || entry.sentiment === "distress") {
      streak.push({
        id: entry.id,
        sentiment: entry.sentiment,
        createdAt: entry.created_at,
      });
    } else {
      breakEntry = {
        id: entry.id,
        sentiment: entry.sentiment,
        createdAt: entry.created_at,
      };
      break;
    }
  }

  return {
    count: streak.length,
    streakEntryIds: streak.map((s) => s.id),
    streakSentiments: streak,
    breakEntry,
  };
}

// =====================================================
// ORCHESTRATOR — COMPUTE ALL 4 INDICATORS
// =====================================================
export interface AllBehavioralIndicators {
  lookbackDays: number;
  windowEndDate: string;
  entriesAnalyzed: number;

  behavioralTrendScore: number;
  behavioralTrendDetails: BehavioralTrendResult;

  journalingFrequencyScore: number;
  totalEntriesWindow: number;
  uniqueDaysJournaled: number;
  journalingFrequencyDetails: JournalingFrequencyResult;

  moodConsistencyScore: number;
  sentimentScoresVariance: number | null;
  sentimentScoresStd: number | null;
  moodConsistencyDetails: MoodConsistencyResult;

  consecutiveNegativeCount: number;
  consecutiveNegativeStreak: ConsecutiveNegativeResult;
}

export function computeAllBehavioralIndicators(
  entries: JournalEntryForAnalytics[],
  lookbackDays: number = 30
): AllBehavioralIndicators {
  const trend = computeBehavioralTrendScore(entries, lookbackDays);
  const freq = computeJournalingFrequency(entries, lookbackDays);
  const consistency = computeMoodConsistency(entries, lookbackDays);
  const consec = computeConsecutiveNegative(entries);

  const now = new Date();
  const windowEndDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return {
    lookbackDays,
    windowEndDate,
    entriesAnalyzed: entries.length,

    behavioralTrendScore: trend.score,
    behavioralTrendDetails: trend,

    journalingFrequencyScore: freq.score,
    totalEntriesWindow: freq.totalEntriesWindow,
    uniqueDaysJournaled: freq.uniqueDaysJournaled,
    journalingFrequencyDetails: freq,

    moodConsistencyScore: consistency.score,
    sentimentScoresVariance: consistency.entriesScored >= 3 ? consistency.variance : null,
    sentimentScoresStd: consistency.entriesScored >= 3 ? consistency.std : null,
    moodConsistencyDetails: consistency,

    consecutiveNegativeCount: consec.count,
    consecutiveNegativeStreak: consec,
  };
}

// =====================================================
// ROW MAPPER: turn a journal_entries DB row into analytics input
// =====================================================
export function mapDbRowToAnalyticsEntry(row: {
  id: string;
  user_id: string;
  created_at: string;
  sentiment: SentimentLabel | null;
  sentiment_score: number | null;
  positive_percentage: number | null;
  negative_percentage: number | null;
  distress_percentage: number | null;
  confidence: number | null;
}): JournalEntryForAnalytics {
  return {
    id: row.id,
    user_id: row.user_id,
    created_at: row.created_at,
    sentiment: row.sentiment,
    sentiment_score: row.sentiment_score,
    positive_percentage: row.positive_percentage,
    negative_percentage: row.negative_percentage,
    distress_percentage: row.distress_percentage,
    confidence: row.confidence,
  };
}

// =====================================================
// RE-EXPORT: Wellness Assessment
// Consumers can import computeWellnessScore from this module
// rather than juggling two imports.
// =====================================================
export {
  computeWellnessScore,
  classifyWellnessLevel,
  WELLNESS_LEVEL_CONFIG,
} from "@/lib/wellness-assessment";
export type {
  WellnessLevel,
  WellnessScoreInput,
  WellnessScoreResult,
} from "@/lib/wellness-assessment";
