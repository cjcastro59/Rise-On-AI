/**
 * Unit Tests — lib/sentiment.ts
 * ==============================
 * Tests keyword-based sentiment analysis (used as fallback and for insights).
 * The 3 classes are: positive | negative | distress — no Neutral.
 */

import { describe, it, expect } from "vitest";
import { analyzeEntry, analyzeSentiment, getSentimentFromMood } from "@/lib/sentiment";

// ── analyzeSentiment ──────────────────────────────────────────────────────────

describe("analyzeSentiment", () => {
  it("TC-SENT-01 | clearly positive text → positive", () => {
    expect(analyzeSentiment("I feel so happy and grateful today!")).toBe("positive");
  });

  it("TC-SENT-02 | clearly negative text → negative", () => {
    expect(analyzeSentiment("I am so sad and exhausted, everything feels wrong.")).toBe("negative");
  });

  it("TC-SENT-03 | distress keywords → distress", () => {
    expect(analyzeSentiment("I want to kill myself, I can't take it anymore.")).toBe("distress");
  });

  it("TC-SENT-04 | Tagalog distress phrase → distress", () => {
    expect(analyzeSentiment("Gusto ko na mamatay, wala nang point.")).toBe("distress");
  });

  it("TC-SENT-05 | null input does not throw", () => {
    expect(() => analyzeSentiment(null)).not.toThrow();
  });

  it("TC-SENT-06 | output is always one of the 3 valid classes", () => {
    const texts = [
      "great day",
      "feeling terrible",
      "I want to end it all",
      "",
      null,
      "masaya ako ngayon",
    ];
    texts.forEach(t => {
      const s = analyzeSentiment(t as string | null);
      expect(["positive","negative","distress"]).toContain(s);
    });
  });
});

// ── analyzeEntry ──────────────────────────────────────────────────────────────

describe("analyzeEntry", () => {
  it("TC-AE-01 | returns all required fields", () => {
    const r = analyzeEntry("I feel okay today", null);
    expect(typeof r.sentiment).toBe("string");
    expect(typeof r.sentimentScore).toBe("number");
    expect(typeof r.positivePercentage).toBe("number");
    expect(typeof r.negativePercentage).toBe("number");
    expect(typeof r.distressPercentage).toBe("number");
    expect(Array.isArray(r.emotions)).toBe(true);
    expect(Array.isArray(r.suggestions)).toBe(true);
    expect(typeof r.feedback).toBe("string");
    expect(typeof r.reflection).toBe("string");
  });

  it("TC-AE-02 | percentages sum to ~100", () => {
    const r = analyzeEntry("I am happy today!", null);
    const sum = r.positivePercentage + r.negativePercentage + r.distressPercentage;
    expect(sum).toBeGreaterThanOrEqual(99);
    expect(sum).toBeLessThanOrEqual(101);
  });

  it("TC-AE-03 | sentimentScore is in [0, 100]", () => {
    const cases = [
      "Amazing wonderful day!",
      "Everything is terrible",
      "I want to die",
    ];
    cases.forEach(text => {
      const r = analyzeEntry(text, null);
      expect(r.sentimentScore).toBeGreaterThanOrEqual(0);
      expect(r.sentimentScore).toBeLessThanOrEqual(100);
    });
  });

  it("TC-AE-04 | mood parameter shifts scores", () => {
    const noMood   = analyzeEntry("I feel okay", null);
    const happyMood = analyzeEntry("I feel okay", "Happy");
    const sadMood   = analyzeEntry("I feel okay", "Sad");
    expect(happyMood.sentimentScore).toBeGreaterThanOrEqual(noMood.sentimentScore);
    expect(sadMood.sentimentScore).toBeLessThanOrEqual(noMood.sentimentScore);
  });

  it("TC-AE-05 | empty text returns default positive entry", () => {
    const r = analyzeEntry("", null);
    expect(r.sentiment).toBe("positive");
    expect(r.feedback.length).toBeGreaterThan(0);
  });

  it("TC-AE-06 | distress entry always has distress sentiment", () => {
    const r = analyzeEntry("I want to kill myself and end my suffering", null);
    expect(r.sentiment).toBe("distress");
  });

  it("TC-AE-07 | Taglish positive → positive classification", () => {
    const r = analyzeEntry("Masaya ako ngayon, salamat sa lahat!", null);
    expect(r.sentiment).toBe("positive");
  });

  it("TC-AE-08 | suggestions array has at most 3 items", () => {
    const r = analyzeEntry("Feeling okay today", null);
    expect(r.suggestions.length).toBeLessThanOrEqual(3);
  });
});

// ── getSentimentFromMood ──────────────────────────────────────────────────────

describe("getSentimentFromMood", () => {
  it("TC-MOOD-01 | Happy → positive", () => {
    expect(getSentimentFromMood("Happy")).toBe("positive");
  });
  it("TC-MOOD-02 | Sad → negative", () => {
    expect(getSentimentFromMood("Sad")).toBe("negative");
  });
  it("TC-MOOD-03 | Anxious → negative", () => {
    expect(getSentimentFromMood("Anxious")).toBe("negative");
  });
  it("TC-MOOD-04 | null → positive (default)", () => {
    expect(getSentimentFromMood(null)).toBe("positive");
  });
  it("TC-MOOD-05 | unknown mood → positive (default)", () => {
    expect(getSentimentFromMood("Confused")).toBe("positive");
  });
});
