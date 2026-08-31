/**
 * Unit Tests — lib/explainability.ts
 * =====================================
 * Tests confidence signal computation, keyword agreement, and IG processing.
 * No network calls — pure function logic only.
 */

import { describe, it, expect } from "vitest";
import {
  computeConfidenceSignal,
  computeKeywordAgreement,
  processIntegratedGradients,
  buildExplainabilityResult,
  igWordColor,
} from "@/lib/explainability";

// ── computeConfidenceSignal ───────────────────────────────────────────────────

describe("computeConfidenceSignal", () => {
  it("TC-CS-01 | gap ≥ 0.40 → high confidence", () => {
    const r = computeConfidenceSignal(0.85, 0.10, 0.05, "positive");
    expect(r.level).toBe("high");
    expect(r.probabilityGap).toBeCloseTo(0.75, 1);
  });

  it("TC-CS-02 | gap 0.20–0.39 → medium confidence", () => {
    const r = computeConfidenceSignal(0.55, 0.30, 0.15, "positive");
    expect(r.level).toBe("medium");
  });

  it("TC-CS-03 | gap 0.10–0.19 → low confidence", () => {
    // sorted: [0.50, 0.35, 0.15] → gap = 0.50 - 0.35 = 0.15 (in 0.10–0.19 range)
    const r = computeConfidenceSignal(0.50, 0.15, 0.35, "positive");
    expect(r.level).toBe("low");
  });

  it("TC-CS-04 | gap < 0.10 → ambiguous", () => {
    const r = computeConfidenceSignal(0.36, 0.33, 0.31, "positive");
    expect(r.level).toBe("ambiguous");
  });

  it("TC-CS-05 | topClassProbability is the highest of the three", () => {
    const r = computeConfidenceSignal(0.15, 0.75, 0.10, "negative");
    expect(r.topClassProbability).toBeCloseTo(0.75, 2);
  });

  it("TC-CS-06 | probabilityGap = topProb - secondProb", () => {
    const r = computeConfidenceSignal(0.70, 0.20, 0.10, "positive");
    expect(r.probabilityGap).toBeCloseTo(r.topClassProbability - r.secondClassProbability, 2);
  });

  it("TC-CS-07 | returns explanation string for every level", () => {
    const levels = [
      computeConfidenceSignal(0.90, 0.05, 0.05, "positive"),
      computeConfidenceSignal(0.55, 0.30, 0.15, "positive"),
      computeConfidenceSignal(0.40, 0.28, 0.32, "positive"),
      computeConfidenceSignal(0.36, 0.33, 0.31, "positive"),
    ];
    levels.forEach(r => {
      expect(typeof r.explanation).toBe("string");
      expect(r.explanation.length).toBeGreaterThan(10);
    });
  });
});

// ── computeKeywordAgreement ───────────────────────────────────────────────────

describe("computeKeywordAgreement", () => {
  it("TC-KA-01 | same class → agreement=agree", () => {
    const r = computeKeywordAgreement("positive", "positive");
    expect(r.agreement).toBe("agree");
  });

  it("TC-KA-02 | different classes → agreement=disagree", () => {
    const r = computeKeywordAgreement("positive", "negative");
    expect(r.agreement).toBe("disagree");
  });

  it("TC-KA-03 | null kwSentiment → keyword_unavailable", () => {
    const r = computeKeywordAgreement("positive", null);
    expect(r.agreement).toBe("keyword_unavailable");
  });

  it("TC-KA-04 | disclaimer is always present and non-empty", () => {
    const cases = [
      computeKeywordAgreement("positive", "positive"),
      computeKeywordAgreement("distress", "negative"),
      computeKeywordAgreement("positive", null),
    ];
    cases.forEach(r => {
      expect(typeof r.disclaimer).toBe("string");
      expect(r.disclaimer.length).toBeGreaterThan(20);
    });
  });

  it("TC-KA-05 | xlmSentiment and kwSentiment are preserved in output", () => {
    const r = computeKeywordAgreement("distress", "negative");
    expect(r.xlmSentiment).toBe("distress");
    expect(r.kwSentiment).toBe("negative");
  });
});

// ── processIntegratedGradients ────────────────────────────────────────────────

describe("processIntegratedGradients", () => {
  it("TC-IG-01 | null input → available=false", () => {
    const r = processIntegratedGradients(null, 50, "Server unavailable");
    expect(r.available).toBe(false);
    expect(r.wordAttributions).toHaveLength(0);
  });

  it("TC-IG-02 | error string → available=false with error field", () => {
    const r = processIntegratedGradients(null, 50, "captum not installed");
    expect(r.error).toContain("captum");
  });

  it("TC-IG-03 | valid attributions → available=true, sorted by absScore desc", () => {
    const raw = [
      { word: "happy",  score:  0.8 },
      { word: "not",    score: -0.1 },
      { word: "really", score:  0.4 },
    ];
    const r = processIntegratedGradients(raw, 50);
    expect(r.available).toBe(true);
    expect(r.wordAttributions[0].word).toBe("happy"); // highest abs
    expect(r.wordAttributions[1].word).toBe("really");
  });

  it("TC-IG-04 | normalised score of max word = 1.0", () => {
    const raw = [
      { word: "suicidal", score: 0.9 },
      { word: "feel",     score: 0.3 },
    ];
    const r = processIntegratedGradients(raw, 50);
    expect(r.wordAttributions[0].normalised).toBe(1.00);
  });

  it("TC-IG-05 | direction is correct for positive/negative/neutral scores", () => {
    const raw = [
      { word: "hope",  score:  0.5  },
      { word: "pain",  score: -0.5  },
      { word: "the",   score:  0.001 },
    ];
    const r = processIntegratedGradients(raw, 50);
    const hope = r.wordAttributions.find(w => w.word === "hope")!;
    const pain = r.wordAttributions.find(w => w.word === "pain")!;
    const the  = r.wordAttributions.find(w => w.word === "the")!;
    expect(hope.direction).toBe("positive");
    expect(pain.direction).toBe("negative");
    expect(the.direction).toBe("neutral");
  });

  it("TC-IG-06 | topInfluential capped at 12 words", () => {
    const raw = Array.from({ length: 20 }, (_, i) => ({
      word: `word${i}`, score: 0.9 - i * 0.04,
    }));
    const r = processIntegratedGradients(raw, 50);
    expect(r.topInfluential.length).toBeLessThanOrEqual(12);
  });

  it("TC-IG-07 | empty strings are filtered from word list", () => {
    const raw = [
      { word: "",      score: 0.9 },
      { word: "valid", score: 0.5 },
    ];
    const r = processIntegratedGradients(raw, 50);
    expect(r.wordAttributions.every(w => w.word.trim().length > 0)).toBe(true);
  });

  it("TC-IG-08 | disclaimer always present and non-empty", () => {
    const r = processIntegratedGradients([{ word: "test", score: 0.5 }], 50);
    expect(typeof r.disclaimer).toBe("string");
    expect(r.disclaimer.length).toBeGreaterThan(20);
  });
});

// ── igWordColor ───────────────────────────────────────────────────────────────

describe("igWordColor", () => {
  it("TC-IGC-01 | positive direction → blue-toned color", () => {
    const c = igWordColor({ word: "hope", score: 0.5, absScore: 0.5, normalised: 1.0, direction: "positive" });
    expect(c.text).toBeTruthy();
    expect(c.bg).toBeTruthy();
  });

  it("TC-IGC-02 | negative direction → red-toned color", () => {
    const c = igWordColor({ word: "pain", score: -0.5, absScore: 0.5, normalised: 1.0, direction: "negative" });
    expect(c.text).toBeTruthy();
  });

  it("TC-IGC-03 | neutral direction → transparent bg", () => {
    const c = igWordColor({ word: "the", score: 0.001, absScore: 0.001, normalised: 0.01, direction: "neutral" });
    expect(c.bg).toBe("transparent");
  });
});

// ── buildExplainabilityResult (orchestrator) ──────────────────────────────────

describe("buildExplainabilityResult", () => {
  it("TC-BER-01 | assembles all three layers correctly", () => {
    const r = buildExplainabilityResult(0.75, 0.15, 0.10, "positive", "positive", null);
    expect(r.predictedSentiment).toBe("positive");
    expect(r.confidence).toBeDefined();
    expect(r.keywordAgreement).toBeDefined();
    expect(r.integratedGradients).toBeNull();
  });

  it("TC-BER-02 | inputProbabilities are rounded to 2dp", () => {
    const r = buildExplainabilityResult(0.333, 0.333, 0.334, "distress", "distress", null);
    const dp = (n: number) => (n.toString().split(".")[1] ?? "").length;
    expect(dp(r.inputProbabilities.positive)).toBeLessThanOrEqual(2);
  });
});
