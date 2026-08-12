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
// INPUT:
//   entries[] — user's journal entries (any order) with sentiment and dates
//   lookbackDays — window length in days (default 30)
//
// COMPUTATION (follows analyzeMoodTrend split-comparison pattern):
//   1. Filter entries inside [now - lookbackDays, now]
//   2. Sort oldest → newest
//   3. If fewer than 2 entries → return 0 (insufficient data)
//   4. Split chronologically into OLD half and NEW half
//   5. Compute half-means of EITHER:
//        a) sentiment_score (0-100) — authoritative when stored
//        b) fallback: sentimentToSignedScore (+1/0/-1) × 33.33 + 50
//   6. Compute delta = newHalfMean − oldHalfMean
//   7. Apply exponential recency weighting inside each half
//        (newest entry in half gets weight 1.0, oldest gets 0.5)
//   8. Normalize delta to [-100, +100] by dividing by maxPossibleDelta
//        (e.g., for score 0-100: max delta between half-means ≈ 100)
//
// NORMALIZATION:
//   raw delta ∈ [-100, +100] is clamped and used as-is
//
// OUTPUT RANGE:
//   -100  → sharply declining (new half much worse)
//   -33+  → mild decline
//     0   → stable or insufficient data
//   +33+  → mild improvement
//   +100  → sharply improving (new half much better)
// =====================================================
export interface BehavioralTrendResult {
  score: number;
  halfSplitDelta: number;
  oldHalfMean: number;
  newHalfMean: number;
  entriesInWindow: number;
  oldestEntry: string | null;
  newestEntry: string | null;
  usedFallbackScores: boolean;
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

  if (inWindow.length < 2) {
    return {
      score: 0,
      halfSplitDelta: 0,
      oldHalfMean: 0,
      newHalfMean: 0,
      entriesInWindow: inWindow.length,
      oldestEntry: null,
      newestEntry: null,
      usedFallbackScores: true,
    };
  }

  let usedFallbackScores = false;
  const scores = inWindow.map((e) => {
    if (typeof e.sentiment_score === "number") {
      return e.sentiment_score;
    }
    usedFallbackScores = true;
    return sentimentToSignedScore(e.sentiment) * 33.33 + 50;
  });

  const mid = Math.floor(scores.length / 2);
  const oldScores = scores.slice(0, mid);
  const newScores = scores.slice(mid);

  function weightedHalfMean(arr: number[]): number {
    if (arr.length === 0) return 50;
    let weightedSum = 0;
    let weightTotal = 0;
    arr.forEach((val, i) => {
      const weight = 0.5 + (0.5 * (i + 1)) / arr.length;
      weightedSum += val * weight;
      weightTotal += weight;
    });
    return weightedSum / weightTotal;
  }

  const oldHalfMean = weightedHalfMean(oldScores);
  const newHalfMean = weightedHalfMean(newScores);
  const delta = newHalfMean - oldHalfMean;

  const normalized = clamp(delta, -100, 100);

  return {
    score: round2(normalized),
    halfSplitDelta: round2(delta),
    oldHalfMean: round2(oldHalfMean),
    newHalfMean: round2(newHalfMean),
    entriesInWindow: inWindow.length,
    oldestEntry: inWindow[0].created_at,
    newestEntry: inWindow[inWindow.length - 1].created_at,
    usedFallbackScores,
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
