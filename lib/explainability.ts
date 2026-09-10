// =====================================================================
// lib/explainability.ts  —  Phase 6
// Explainable AI — Confidence + comparison signal layer
// =====================================================================
//
// DESIGN RATIONALE
// ────────────────
// XLM-RoBERTa produces three class probabilities (positive, negative,
// distress). The model's internal decision process is not directly
// interpretable from the API output alone. This module provides two
// technically honest, non-fabricated explanation layers:
//
//   LAYER 1 — Confidence Signal (from class probabilities)
//     • Probability gap = top_prob − second_prob
//     • High gap  (≥0.40) → model is certain: one class dominates clearly
//     • Medium gap(0.20–0.39) → model leans toward prediction but has notable
//       mass on another class
//     • Low gap   (0.10–0.19) → weak signal, consider fallback
//     • Ambiguous (<0.10) → probabilities nearly equal; treat with caution
//     This is mathematically sound and requires no extra model calls.
//
//   LAYER 2 — Independent Comparison Signal
//     • A separate comparison signal may be provided when an independent
//       check is available.
//     • When the comparison agrees → stronger signal
//     • When it disagrees → the entry may be mixed or ambiguous
//     • IMPORTANT: this is not the same as the model's attention or saliency.
//
//   LAYER 3 — On-demand Integrated Gradients (offline only)
//     • Word-level attribution via captum, requested explicitly by user
//     • Handled by /api/sentiment/explain → Python server /explain endpoint
//     • Never called automatically; never affects the production inference path
//     • Results are returned with clear disclaimers about subword aggregation
//       approximation (XLM-RoBERTa uses WordPiece — words are split into
//       subword tokens and scores are summed back to word level)
//
// WHAT THIS MODULE DOES NOT DO
// ─────────────────────────────
// • Does NOT claim keywords are the reason the AI made its prediction
// • Does NOT fabricate attention weights or saliency scores
// • Does NOT modify the production inference path
// • Does NOT run LIME/SHAP (requires 50–500 model calls, not viable on CPU)
// =====================================================================

import type { Sentiment } from "@/lib/sentiment";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConfidenceLevel = "high" | "medium" | "low" | "ambiguous";

export interface ConfidenceSignal {
  /** 0–1: probability assigned to the predicted class */
  topClassProbability: number;
  /** 0–1: probability of the second-ranked class */
  secondClassProbability: number;
  /** topClassProbability − secondClassProbability */
  probabilityGap: number;
  /** Human-readable confidence level */
  level: ConfidenceLevel;
  /** Display label */
  label: string;
  /** Colour config for UI */
  color: string;
  bgColor: string;
  /** One-sentence explanation for users */
  explanation: string;
}

export type KeywordAgreement = "agree" | "disagree" | "keyword_unavailable";

export interface KeywordAgreementSignal {
  agreement: KeywordAgreement;
  xlmSentiment: Sentiment;
  /** null when keyword analysis wasn't run */
  kwSentiment: Sentiment | null;
  label: string;
  explanation: string;
  /** Always present — users must understand what this signal means */
  disclaimer: string;
}

export interface IntegratedGradientsResult {
  /** Whether IG was available (Python server /explain endpoint running) */
  available: boolean;
  /** Per-word attribution scores, highest absolute value first */
  wordAttributions: WordAttribution[];
  /** Rendering-ready top-N tokens (absolute value ≥ threshold) */
  topInfluential: WordAttribution[];
  /** Metadata */
  method: "integrated_gradients";
  numSteps: number;
  baseline: "pad_token";
  /** Required disclaimer — subword aggregation is an approximation */
  disclaimer: string;
  /** Error message if IG call failed */
  error?: string;
}

export interface WordAttribution {
  word: string;
  /** Sum of subword-token IG scores for this word */
  score: number;
  /** Absolute score (for sorting/display) */
  absScore: number;
  /** Normalised 0–1 relative to max absolute score in this result */
  normalised: number;
  /** "positive" if score > 0, "negative" if score < 0, "neutral" near zero */
  direction: "positive" | "negative" | "neutral";
}

export interface ExplainabilityResult {
  /** The class probabilities used as input */
  inputProbabilities: {
    positive: number;  // 0–1
    negative: number;
    distress: number;
  };
  predictedSentiment: Sentiment;
  confidence: ConfidenceSignal;
  keywordAgreement: KeywordAgreementSignal;
  /** Populated only when /api/sentiment/explain was called */
  integratedGradients: IntegratedGradientsResult | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLDS = {
  high: 0.40,
  medium: 0.20,
  low: 0.10,
  // < 0.10 → ambiguous
} as const;

const CONFIDENCE_CONFIG: Record<ConfidenceLevel, {
  label: string; color: string; bgColor: string; explanation: string;
}> = {
  high: {
    label: "High Confidence",
    color: "#2D6A4F",
    bgColor: "#B7E4C7",
    explanation: "The AI model is strongly confident in this prediction. The predicted class received significantly more probability than any other class.",
  },
  medium: {
    label: "Moderate Confidence",
    color: "#7B5E2A",
    bgColor: "#FFE8A1",
    explanation: "The AI model leans toward this prediction but has notable probability mass on another class. The prediction is likely correct but less certain.",
  },
  low: {
    label: "Low Confidence",
    color: "#9B3A1E",
    bgColor: "#F4A6A6",
    explanation: "The AI model shows a weak preference for this class. There is meaningful probability on one or more other classes. Consider the independent comparison signal for additional context.",
  },
  ambiguous: {
    label: "Ambiguous",
    color: "#6B7280",
    bgColor: "#E5E7EB",
    explanation: "The class probabilities are nearly equal. The model could not clearly distinguish between sentiment classes. This may indicate a mixed-sentiment entry or a borderline case.",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Layer 1: Confidence Signal ────────────────────────────────────────────────

/**
 * Derive a confidence signal from raw class probabilities.
 *
 * Inputs are the softmax probabilities returned by the XLM-RoBERTa model
 * (or the keyword fallback). All three should sum to ~1.0.
 */
export function computeConfidenceSignal(
  posProb: number,
  negProb: number,
  dstProb: number,
  predicted: Sentiment,
): ConfidenceSignal {
  const probs: [number, Sentiment][] = [
    [posProb, "positive"],
    [negProb, "negative"],
    [dstProb, "distress"],
  ];
  probs.sort((a, b) => b[0] - a[0]);

  const topProb = round2(probs[0][0]);
  const secondProb = round2(probs[1][0]);
  const gap = round2(topProb - secondProb);

  let level: ConfidenceLevel;
  if (gap >= CONFIDENCE_THRESHOLDS.high) level = "high";
  else if (gap >= CONFIDENCE_THRESHOLDS.medium) level = "medium";
  else if (gap >= CONFIDENCE_THRESHOLDS.low) level = "low";
  else level = "ambiguous";

  const cfg = CONFIDENCE_CONFIG[level];

  return {
    topClassProbability: topProb,
    secondClassProbability: secondProb,
    probabilityGap: gap,
    level,
    label: cfg.label,
    color: cfg.color,
    bgColor: cfg.bgColor,
    explanation: cfg.explanation,
  };
}

// ── Layer 2: Independent Comparison Signal ───────────────────────────────────

const KEYWORD_DISCLAIMER =
  "This comparison signal comes from a separate, independent check and is not " +
  "an explanation of which words the XLM-RoBERTa model attended to. Agreement " +
  "can add confidence, while disagreement may indicate mixed or context-heavy " +
  "language. The underlying AI prediction remains the authoritative result.";

/**
 * Compare the XLM-RoBERTa predicted class against an independent comparison signal.
 * Pass `kwSentiment: null` when no comparison check was run.
 */
export function computeKeywordAgreement(
  xlmSentiment: Sentiment,
  kwSentiment: Sentiment | null,
): KeywordAgreementSignal {
  if (kwSentiment === null) {
    return {
      agreement: "keyword_unavailable",
      xlmSentiment,
      kwSentiment,
      label: "Comparison signal not available",
      explanation: "An independent comparison check was not available for this entry.",
      disclaimer: KEYWORD_DISCLAIMER,
    };
  }

  const agree = xlmSentiment === kwSentiment;

  return {
    agreement: agree ? "agree" : "disagree",
    xlmSentiment,
    kwSentiment,
    label: agree
      ? `Both checks agree: ${xlmSentiment}`
      : `Checks differ: AI → ${xlmSentiment}, comparison → ${kwSentiment}`,
    explanation: agree
      ? "The AI model and the independent comparison signal predict the same sentiment class. This adds confidence in the result."
      : "The AI model and the independent comparison signal predict different classes. This may indicate a complex or mixed-sentiment entry. The AI model's prediction remains the authoritative result.",
    disclaimer: KEYWORD_DISCLAIMER,
  };
}

// ── Layer 3: Process IG results from Python server ────────────────────────────

const IG_DISCLAIMER =
  "These word attributions were computed using Integrated Gradients (Sundararajan et al., 2017). " +
  "XLM-RoBERTa tokenizes text into subword units (WordPiece). " +
  "Scores for subword tokens belonging to the same word have been summed to produce word-level scores. " +
  "This aggregation is an approximation — the true attribution is at the token level. " +
  "A high positive score suggests the word pushed the model toward the predicted class. " +
  "A high negative score suggests it pushed against it. " +
  "These scores do NOT represent absolute importance — they are relative to this specific prediction.";

const IG_SCORE_THRESHOLD = 0.05; // minimum normalised score to be shown as influential

/**
 * Process raw IG output from the Python server into a display-ready structure.
 * Input: array of { word, score } from the Python /explain endpoint.
 */
export function processIntegratedGradients(
  rawAttributions: Array<{ word: string; score: number }> | null,
  numSteps: number = 50,
  error?: string,
): IntegratedGradientsResult {
  if (error || !rawAttributions) {
    return {
      available: false,
      wordAttributions: [],
      topInfluential: [],
      method: "integrated_gradients",
      numSteps,
      baseline: "pad_token",
      disclaimer: IG_DISCLAIMER,
      error: error ?? "Integrated Gradients not available",
    };
  }

  const maxAbs = Math.max(...rawAttributions.map(w => Math.abs(w.score)), 1e-8);

  const wordAttributions: WordAttribution[] = rawAttributions
    .filter(w => w.word.trim().length > 0)
    .map(w => {
      const abs = Math.abs(w.score);
      const norm = round2(abs / maxAbs);
      return {
        word: w.word,
        score: round2(w.score),
        absScore: round2(abs),
        normalised: norm,
        direction: (w.score > 0.01 ? "positive"
          : w.score < -0.01 ? "negative"
            : "neutral") as "positive" | "negative" | "neutral",
      };
    })
    .sort((a, b) => b.absScore - a.absScore);

  const topInfluential = wordAttributions
    .filter(w => w.normalised >= IG_SCORE_THRESHOLD)
    .slice(0, 12);  // cap display at 12 words

  return {
    available: true,
    wordAttributions,
    topInfluential,
    method: "integrated_gradients",
    numSteps,
    baseline: "pad_token",
    disclaimer: IG_DISCLAIMER,
  };
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Build the full explainability result from what's available.
 * IG is optional — pass null if not yet fetched.
 *
 * NOTE: percentages from journal_entries (0–100) must be converted to
 * probabilities (0–1) before calling this function.
 */
export function buildExplainabilityResult(
  posProb: number,
  negProb: number,
  dstProb: number,
  xlmSentiment: Sentiment,
  kwSentiment: Sentiment | null,
  ig: IntegratedGradientsResult | null = null,
): ExplainabilityResult {
  return {
    inputProbabilities: {
      positive: round2(posProb),
      negative: round2(negProb),
      distress: round2(dstProb),
    },
    predictedSentiment: xlmSentiment,
    confidence: computeConfidenceSignal(posProb, negProb, dstProb, xlmSentiment),
    keywordAgreement: computeKeywordAgreement(xlmSentiment, kwSentiment),
    integratedGradients: ig,
  };
}

// ── UI Config helpers ─────────────────────────────────────────────────────────

export { CONFIDENCE_CONFIG };

/** Display colour for an IG word attribution based on direction + normalised score */
export function igWordColor(attr: WordAttribution): { bg: string; text: string } {
  const alpha = Math.round(attr.normalised * 220 + 30);
  if (attr.direction === "positive") return {
    bg: `rgba(168, 218, 220, ${alpha / 255})`,
    text: "#1D6FA4",
  };
  if (attr.direction === "negative") return {
    bg: `rgba(244, 166, 166, ${alpha / 255})`,
    text: "#9B3A1E",
  };
  return { bg: "transparent", text: "#6B7280" };
}
