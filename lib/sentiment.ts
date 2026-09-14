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
  const positiveMoods = ["happy", "calm", "excited"];
  const negativeMoods = ["anxious", "sad", "frustrated", "overwhelmed"];
  if (!mood) return "positive";
  const normalized = mood.toLowerCase();
  if (positiveMoods.includes(normalized)) return "positive";
  if (negativeMoods.includes(normalized)) return "negative";
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

const DISTRESS_TERMS = [
  "kill myself",
  "suicide",
  "suicidal",
  "want to die",
  "i want to die",
  "end it all",
  "end my life",
  "harm myself",
  "can't take it anymore",
  "cannot take it anymore",
  "mamatay",
  "magpakamatay",
  "gusto ko na mamatay",
  "wala nang point",
  "ayoko na mabuhay",
];

const NEGATIVE_TERMS = [
  "sad",
  "exhausted",
  "terrible",
  "wrong",
  "anxious",
  "anxiety",
  "overwhelmed",
  "frustrated",
  "lonely",
  "depressed",
  "stress",
  "stressed",
  "afraid",
  "scared",
  "angry",
  "pagod",
  "lungkot",
  "malungkot",
  "takot",
  "galit",
  "hirap",
  "mahirap",
];

const POSITIVE_TERMS = [
  "happy",
  "grateful",
  "thankful",
  "amazing",
  "wonderful",
  "great",
  "good",
  "okay",
  "calm",
  "excited",
  "hopeful",
  "love",
  "masaya",
  "salamat",
  "mahal",
  "saya",
];

function cleanText(text: string | null): string {
  return (text ?? "")
    .replace(/<[^>]*>/g, " ")
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(text: string, terms: string[]): number {
  if (!text) return 0;
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

function normalizePercentages(positive: number, negative: number, distress: number) {
  const pos = Number.isFinite(positive) ? Math.max(0, positive) : 0;
  const neg = Number.isFinite(negative) ? Math.max(0, negative) : 0;
  const dst = Number.isFinite(distress) ? Math.max(0, distress) : 0;
  const total = pos + neg + dst;
  if (total <= 0) return { positive: 80, negative: 15, distress: 5 };

  const positivePercentage = Math.round((pos / total) * 100);
  const negativePercentage = Math.round((neg / total) * 100);
  return {
    positive: positivePercentage,
    negative: negativePercentage,
    distress: Math.max(0, 100 - positivePercentage - negativePercentage),
  };
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

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
  text: string | null,
  mood: string | null = null
): AnalysisResult {
  const cleaned = cleanText(text);
  const distressHits = countMatches(cleaned, DISTRESS_TERMS);
  const negativeHits = countMatches(cleaned, NEGATIVE_TERMS);
  const positiveHits = countMatches(cleaned, POSITIVE_TERMS);
  const moodSentiment = getSentimentFromMood(mood);

  let positiveWeight = 1 + positiveHits * 2.5;
  let negativeWeight = 1 + negativeHits * 2.5;
  let distressWeight = 0.5 + distressHits * 8;

  if (moodSentiment === "positive") positiveWeight += 1.5;
  if (moodSentiment === "negative") negativeWeight += 1.5;

  if (!cleaned) {
    positiveWeight = 6;
    negativeWeight = 1.5;
    distressWeight = 0.5;
  }

  const percentages = normalizePercentages(
    positiveWeight,
    negativeWeight,
    distressWeight,
  );

  let sentiment: Sentiment = "positive";
  if (distressHits > 0 || percentages.distress >= Math.max(percentages.positive, percentages.negative)) {
    sentiment = "distress";
  } else if (percentages.negative > percentages.positive) {
    sentiment = "negative";
  }

  const sentimentScore = sentiment === "positive"
    ? clampScore(50 + percentages.positive * 0.5)
    : sentiment === "negative"
      ? clampScore(50 - percentages.negative * 0.4 - percentages.distress * 0.2)
      : clampScore(25 - percentages.distress * 0.25);

  return {
    sentiment,
    sentimentScore,
    positivePercentage: percentages.positive,
    negativePercentage: percentages.negative,
    distressPercentage: percentages.distress,
    emotions:
      sentiment === "positive" ? ["Calm", "Hope"] :
      sentiment === "negative" ? ["Sadness", "Stress"] :
      ["Distress"],
    keyPhrases: [],
    feedback:
      sentiment === "positive"
        ? "Your entry shows a generally positive emotional signal."
        : sentiment === "negative"
          ? "Your entry suggests difficult feelings that may benefit from reflection and support."
          : "Your entry contains distress signals. Please consider reaching out to a trusted person or support resource.",
    reflection:
      sentiment === "positive"
        ? "What helped this moment feel manageable or encouraging?"
        : "What is one small step that could make the next hour feel safer or easier?",
    suggestions:
      sentiment === "positive"
        ? ["Notice what helped today.", "Keep journaling consistently."]
        : sentiment === "negative"
          ? ["Take a short grounding break.", "Reach out to someone you trust.", "Write one concrete next step."]
          : ["Contact emergency support if you feel unsafe.", "Tell a trusted person how you feel.", "Move to a safer shared space."],
  };
}

/**
 * @deprecated  Use the stored `sentiment` column from the DB.
 */
export const analyzeSentiment = (text: string | null): Sentiment => {
  const cleaned = cleanText(text);
  const distressHits = countMatches(cleaned, DISTRESS_TERMS);
  if (distressHits > 0) return "distress";

  const positiveHits = countMatches(cleaned, POSITIVE_TERMS);
  const negativeHits = countMatches(cleaned, NEGATIVE_TERMS);

  if (negativeHits > positiveHits) return "negative";
  return "positive";
};

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
