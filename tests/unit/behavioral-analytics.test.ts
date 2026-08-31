/**
 * Unit Tests — lib/behavioral-analytics.ts
 * ==========================================
 * Tests 4 behavioral indicators:
 *   1. Behavioral Trend Score   (split-half weighted mean)
 *   2. Journaling Frequency     (unique days / expected days × 100)
 *   3. Mood Consistency         (1 - CV/refCV)
 *   4. Consecutive Negatives    (streak count)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  computeBehavioralTrendScore,
  computeJournalingFrequency,
  computeMoodConsistency,
  computeConsecutiveNegative,
  computeAllBehavioralIndicators,
  sentimentToSignedScore,
  type JournalEntryForAnalytics,
} from "@/lib/behavioral-analytics";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(
  id: string,
  daysAgo: number,
  sentiment: "positive" | "negative" | "distress" | null,
  score: number | null = null,
): JournalEntryForAnalytics {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    id,
    user_id: "test-user",
    created_at: d.toISOString(),
    sentiment,
    sentiment_score: score,
    positive_percentage: null,
    negative_percentage: null,
    distress_percentage: null,
    confidence: null,
  };
}

// ── sentimentToSignedScore ────────────────────────────────────────────────────

describe("sentimentToSignedScore", () => {
  it("TC-BA-01 | positive → +1", () => expect(sentimentToSignedScore("positive")).toBe(1));
  it("TC-BA-02 | negative → 0",  () => expect(sentimentToSignedScore("negative")).toBe(0));
  it("TC-BA-03 | distress → -1", () => expect(sentimentToSignedScore("distress")).toBe(-1));
  it("TC-BA-04 | null → 0",      () => expect(sentimentToSignedScore(null)).toBe(0));
});

// ── computeBehavioralTrendScore ────────────────────────────────────────────────

describe("computeBehavioralTrendScore", () => {
  it("TC-BTS-01 | 0 entries → score=0, entriesInWindow=0", () => {
    const r = computeBehavioralTrendScore([], 30);
    expect(r.score).toBe(0);
    expect(r.entriesInWindow).toBe(0);
  });

  it("TC-BTS-02 | 1 entry → score=0 (insufficient data)", () => {
    const r = computeBehavioralTrendScore([makeEntry("e1", 5, "positive", 80)], 30);
    expect(r.score).toBe(0);
    expect(r.entriesInWindow).toBe(1);
  });

  it("TC-BTS-03 | consistently high new scores → positive score", () => {
    const entries = [
      makeEntry("e1", 28, "negative",  30),
      makeEntry("e2", 25, "negative",  35),
      makeEntry("e3", 10, "positive",  75),
      makeEntry("e4",  5, "positive",  80),
    ];
    const r = computeBehavioralTrendScore(entries, 30);
    expect(r.score).toBeGreaterThan(0);
  });

  it("TC-BTS-04 | consistently declining scores → negative score", () => {
    const entries = [
      makeEntry("e1", 28, "positive",  80),
      makeEntry("e2", 25, "positive",  75),
      makeEntry("e3", 10, "negative",  30),
      makeEntry("e4",  5, "negative",  25),
    ];
    const r = computeBehavioralTrendScore(entries, 30);
    expect(r.score).toBeLessThan(0);
  });

  it("TC-BTS-05 | score is clamped to [-100, 100]", () => {
    const entries = Array.from({ length: 6 }, (_, i) =>
      makeEntry(`e${i}`, i < 3 ? 28 - i : 5 - (i - 3), i < 3 ? "distress" : "positive",
        i < 3 ? 0 : 100)
    );
    const r = computeBehavioralTrendScore(entries, 30);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(-100);
  });

  it("TC-BTS-06 | entries outside lookback window are excluded", () => {
    const entries = [
      makeEntry("old1", 40, "distress", 5),   // outside 30-day window
      makeEntry("old2", 35, "distress", 5),   // outside
      makeEntry("new1", 10, "positive", 80),  // inside
      makeEntry("new2",  5, "positive", 85),  // inside
    ];
    const withOld    = computeBehavioralTrendScore(entries, 30);
    const withoutOld = computeBehavioralTrendScore(entries.slice(2), 30);
    // Both should only use the 2 in-window entries → same result
    expect(withOld.entriesInWindow).toBe(2);
    expect(withOld.score).toBe(withoutOld.score);
  });
});

// ── computeJournalingFrequency ────────────────────────────────────────────────

describe("computeJournalingFrequency", () => {
  it("TC-JF-01 | no entries → score=0", () => {
    const r = computeJournalingFrequency([], 30);
    expect(r.score).toBe(0);
    expect(r.uniqueDaysJournaled).toBe(0);
  });

  it("TC-JF-02 | expectedUniqueDays = ceil(30/3) = 10", () => {
    const r = computeJournalingFrequency([], 30, 3);
    expect(r.expectedUniqueDays).toBe(10);
  });

  it("TC-JF-03 | journaling on all 10 expected days → score=100", () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry(`e${i}`, i * 3, "positive")
    );
    const r = computeJournalingFrequency(entries, 30, 3);
    expect(r.score).toBe(100);
  });

  it("TC-JF-04 | two entries on same day count as 1 unique day", () => {
    const now = new Date();
    const same: JournalEntryForAnalytics[] = [
      { id:"a", user_id:"u", created_at: now.toISOString(), sentiment:"positive", sentiment_score:80, positive_percentage:null, negative_percentage:null, distress_percentage:null, confidence:null },
      { id:"b", user_id:"u", created_at: now.toISOString(), sentiment:"positive", sentiment_score:80, positive_percentage:null, negative_percentage:null, distress_percentage:null, confidence:null },
    ];
    const r = computeJournalingFrequency(same, 30, 3);
    expect(r.uniqueDaysJournaled).toBe(1);
    expect(r.totalEntriesWindow).toBe(2);
  });

  it("TC-JF-05 | score is capped at 100 even when exceeding expected cadence", () => {
    const entries = Array.from({ length: 30 }, (_, i) =>
      makeEntry(`e${i}`, i, "positive")
    );
    const r = computeJournalingFrequency(entries, 30, 3);
    expect(r.score).toBe(100);
  });
});

// ── computeMoodConsistency ────────────────────────────────────────────────────

describe("computeMoodConsistency", () => {
  it("TC-MC-01 | fewer than 3 entries → score=0", () => {
    const entries = [makeEntry("e1", 5, "positive", 80)];
    const r = computeMoodConsistency(entries, 30);
    expect(r.score).toBe(0);
    expect(r.entriesScored).toBe(1);
  });

  it("TC-MC-02 | all identical scores → score=100 (zero variance)", () => {
    const entries = [
      makeEntry("e1", 10, "positive", 80),
      makeEntry("e2",  7, "positive", 80),
      makeEntry("e3",  4, "positive", 80),
    ];
    const r = computeMoodConsistency(entries, 30);
    expect(r.score).toBe(100);
    expect(r.variance).toBe(0);
  });

  it("TC-MC-03 | highly volatile scores → score near 0", () => {
    const entries = [
      makeEntry("e1", 10, "distress",  5),
      makeEntry("e2",  7, "positive", 95),
      makeEntry("e3",  4, "distress",  5),
      makeEntry("e4",  1, "positive", 95),
    ];
    const r = computeMoodConsistency(entries, 30);
    expect(r.score).toBeLessThan(20);
  });

  it("TC-MC-04 | score is in [0, 100]", () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry(`e${i}`, i * 5, i % 2 === 0 ? "positive" : "negative",
        i % 2 === 0 ? 80 : 20)
    );
    const r = computeMoodConsistency(entries, 30);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

// ── computeConsecutiveNegative ────────────────────────────────────────────────

describe("computeConsecutiveNegative", () => {
  it("TC-CN-01 | no entries → count=0", () => {
    const r = computeConsecutiveNegative([]);
    expect(r.count).toBe(0);
    expect(r.breakEntry).toBeNull();
  });

  it("TC-CN-02 | most recent is positive → count=0", () => {
    const entries = [
      makeEntry("e1", 1, "positive"),
      makeEntry("e2", 2, "negative"),
    ];
    const r = computeConsecutiveNegative(entries);
    expect(r.count).toBe(0);
  });

  it("TC-CN-03 | 3 consecutive negative/distress → count=3", () => {
    const entries = [
      makeEntry("e1", 1, "distress"),
      makeEntry("e2", 2, "negative"),
      makeEntry("e3", 3, "negative"),
      makeEntry("e4", 4, "positive"), // breaks streak
    ];
    const r = computeConsecutiveNegative(entries);
    expect(r.count).toBe(3);
    expect(r.streakEntryIds).toHaveLength(3);
  });

  it("TC-CN-04 | null sentiment breaks streak", () => {
    const entries = [
      makeEntry("e1", 1, "negative"),
      makeEntry("e2", 2, null),       // break
      makeEntry("e3", 3, "negative"),
    ];
    const r = computeConsecutiveNegative(entries);
    expect(r.count).toBe(1);
  });

  it("TC-CN-05 | all distress → count = total entries", () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry(`e${i}`, i, "distress")
    );
    const r = computeConsecutiveNegative(entries);
    expect(r.count).toBe(5);
    expect(r.breakEntry).toBeNull();
  });
});

// ── computeAllBehavioralIndicators (orchestrator) ─────────────────────────────

describe("computeAllBehavioralIndicators", () => {
  it("TC-ORC-01 | returns all 4 indicator scores", () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry(`e${i}`, i * 5, "positive", 75)
    );
    const r = computeAllBehavioralIndicators(entries, 30);
    expect(typeof r.behavioralTrendScore).toBe("number");
    expect(typeof r.journalingFrequencyScore).toBe("number");
    expect(typeof r.moodConsistencyScore).toBe("number");
    expect(typeof r.consecutiveNegativeCount).toBe("number");
  });

  it("TC-ORC-02 | windowEndDate is today YYYY-MM-DD", () => {
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    const r = computeAllBehavioralIndicators([], 30);
    expect(r.windowEndDate).toBe(expected);
  });

  it("TC-ORC-03 | entriesAnalyzed equals total entries passed", () => {
    const entries = Array.from({ length: 8 }, (_, i) =>
      makeEntry(`e${i}`, i * 3, "positive", 70)
    );
    const r = computeAllBehavioralIndicators(entries, 30);
    expect(r.entriesAnalyzed).toBe(8);
  });
});
