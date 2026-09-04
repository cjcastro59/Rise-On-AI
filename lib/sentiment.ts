// =====================================================
// lib/sentiment.ts
//
// Pure-ML sentiment layer.
// All classification is performed by the XLM-RoBERTa model
// (lib/xlm-roberta-sentiment.ts / scripts/sentiment-server/).
// Keyword-based scoring has been removed — this file now
// contains only shared types, mood-name helpers, and the
// trend-detection utilities that operate on *stored* ML
// sentiment values (not on raw text).
// =====================================================

export type Sentiment = "positive" | "negative" | "distress";
export type MoodCategory =
  | "happy"
  | "calm"
  | "excited"
  | "anxious"
  | "sad"
  | "frustrated"
  | "overwhelmed";

export interface AnalysisResult {
  sentiment: Sentiment;
  sentimentScore: number;      // 0–100
  positivePercentage: number;  // 0–100
  negativePercentage: number;  // 0–100
  distressPercentage: number;  // 0–100
  emotions: string[];
  keyPhrases: string[];
  feedback: string;
  reflection: string;
  suggestions: string[];
}

// =====================================================
// MOOD-NAME HELPERS  (no text scanning — name-based only)
// =====================================================

export const getSentimentFromMood = (mood: string | null): Sentiment => {
  const positiveMoods = ["Happy", "Calm", "Excited"];
  const negativeMoods = ["Anxious", "Sad", "Frustrated", "Overwhelmed"];
  if (!mood) return "positive";
  if (positiveMoods.includes(mood)) return "positive";
  if (negativeMoods.includes(mood)) return "negative";
  return "positive";
};

export const getMoodCategory = (
  _text: string | null,
  mood: string | null
): MoodCategory => {
  if (mood) {
    const lower = mood.toLowerCase() as MoodCategory;
    const valid: MoodCategory[] = [
      "happy", "calm", "excited", "anxious", "sad", "frustrated", "overwhelmed",
    ];
    if (valid.includes(lower)) return lower;
  }
  return "calm";
};

// =====================================================
// THIN SHIMS  (kept so callers that haven't migrated yet
//              still compile — they return ML-neutral defaults)
// =====================================================

/**
 * @deprecated  Use the stored `sentiment` column from the DB or call
 *              analyzeWithXLMRoBERTa() for real-time ML inference.
 *              This shim always returns "positive" so it never falsely
 *              triggers keyword-based alerts.
 */
export function analyzeEntry(
  _text: string | null,
  _mood: string | null = null
): AnalysisResult {
  return {
    sentiment: "positive",
    sentimentScore: 75,
    positivePercentage: 75,
    negativePercentage: 20,
    distressPercentage: 5,
    emotions: ["Calm"],
    keyPhrases: [],
    feedback: "",
    reflection: "",
    suggestions: [],
  };
}

/**
 * @deprecated  Use the stored `sentiment` column from the DB.
 */
export const analyzeSentiment = (_text: string | null): Sentiment => "positive";

// =====================================================
// TREND DETECTION  (operates on stored ML sentiment values)
// =====================================================

export interface JournalEntry {
  id: string;
  content: string | null;
  mood: string | null;
  created_at: string;
  /** Stored ML-predicted sentiment — preferred over re-analysing content */
  sentiment?: string | null;
}

export interface MoodTrendResult {
  overall: "improving" | "declining" | "stable";
  mostCommonMood: MoodCategory;
  averageSentiment: number;
  weeklyChange: number;
}

export interface NegativeTrendResult {
  hasNegativeTrend: boolean;
  negativeCount: number;
  totalCount: number;
}

/**
 * Determine whether the user has a negative/distress trend across recent
 * entries.  Reads the stored `sentiment` column when available; falls back
 * to the mood-name helper so no text scanning is ever performed.
 */
export const checkNegativeTrend = (
  entries: JournalEntry[],
  threshold: number,
  minEntries: number,
  maxEntries: number
): NegativeTrendResult => {
  if (entries.length < minEntries) {
    return { hasNegativeTrend: false, negativeCount: 0, totalCount: entries.length };
  }

  const entriesToCheck = entries.slice(0, maxEntries);
  let negativeCount = 0;

  for (const entry of entriesToCheck) {
    const sentiment: Sentiment =
      (entry.sentiment as Sentiment | null) ??
      getSentimentFromMood(entry.mood);
    if (sentiment === "negative" || sentiment === "distress") {
      negativeCount++;
    }
  }

  const negativeRatio = negativeCount / entriesToCheck.length;
  return {
    hasNegativeTrend: negativeRatio >= threshold,
    negativeCount,
    totalCount: entriesToCheck.length,
  };
};

export const analyzeMoodTrend = (entries: JournalEntry[]): MoodTrendResult => {
  if (entries.length === 0) {
    return { overall: "stable", mostCommonMood: "calm", averageSentiment: 1, weeklyChange: 0 };
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const toScore = (entry: JournalEntry): number => {
    const s: Sentiment =
      (entry.sentiment as Sentiment | null) ??
      getSentimentFromMood(entry.mood);
    if (s === "distress") return -1;
    if (s === "positive") return 1;
    return 0;
  };

  const scores = sorted.map(toScore);

  const moods = sorted.map(entry => getMoodCategory(null, entry.mood));
  const moodCounts = moods.reduce((acc, mood) => {
    acc[mood] = (acc[mood] || 0) + 1;
    return acc;
  }, {} as Record<MoodCategory, number>);

  const mostCommonMood = (
    Object.keys(moodCounts) as MoodCategory[]
  ).reduce(
    (a, b) => (moodCounts[a] > moodCounts[b] ? a : b),
    "calm" as MoodCategory
  );

  const averageSentiment = scores.reduce((a, b) => a + b, 0) / scores.length;

  let weeklyChange = 0;
  if (scores.length >= 2) {
    const mid = Math.floor(scores.length / 2);
    const firstAvg =
      scores.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const secondAvg =
      scores.slice(mid).reduce((a, b) => a + b, 0) / (scores.length - mid);
    weeklyChange = secondAvg - firstAvg;
  }

  let overall: "improving" | "declining" | "stable" = "stable";
  if (weeklyChange > 0.2) overall = "improving";
  if (weeklyChange < -0.2) overall = "declining";

  return { overall, mostCommonMood, averageSentiment, weeklyChange };
};
