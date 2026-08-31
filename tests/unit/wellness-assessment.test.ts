/**
 * Unit Tests — lib/wellness-assessment.ts
 * =========================================
 * Tests the Wellness Score computation documented in README §8.
 * No network calls. All inputs are pure numbers.
 *
 * Formula under test:
 *   trendSub      = clamp01((bts + 100) / 200)
 *   freqSub       = clamp01(jfs / 100)
 *   consistSub    = clamp01(mcs / 100)
 *   weightedRaw   = trendSub*0.40 + freqSub*0.20 + consistSub*0.15 + 0.25
 *   penalty       = clamp01(streak / 7) * 0.25
 *   rawScore      = clamp01(weightedRaw - penalty)
 *   wellnessScore = round(rawScore * 10, 2)
 */

import { describe, it, expect } from "vitest";
import {
  computeWellnessScore,
  classifyWellnessLevel,
  computeWellnessScoreFromIndicatorsRow,
} from "@/lib/wellness-assessment";

// ── classifyWellnessLevel ─────────────────────────────────────────────────────

describe("classifyWellnessLevel", () => {
  it("TC-WL-01 | returns Healthy for score ≥ 8.00", () => {
    expect(classifyWellnessLevel(8.00)).toBe("Healthy");
    expect(classifyWellnessLevel(10.00)).toBe("Healthy");
    expect(classifyWellnessLevel(9.99)).toBe("Healthy");
  });

  it("TC-WL-02 | returns Stable for 6.00 ≤ score < 8.00", () => {
    expect(classifyWellnessLevel(6.00)).toBe("Stable");
    expect(classifyWellnessLevel(7.99)).toBe("Stable");
    expect(classifyWellnessLevel(7.00)).toBe("Stable");
  });

  it("TC-WL-03 | returns Moderate Concern for 4.00 ≤ score < 6.00", () => {
    expect(classifyWellnessLevel(4.00)).toBe("Moderate Concern");
    expect(classifyWellnessLevel(5.99)).toBe("Moderate Concern");
  });

  it("TC-WL-04 | returns At Risk for 2.00 ≤ score < 4.00", () => {
    expect(classifyWellnessLevel(2.00)).toBe("At Risk");
    expect(classifyWellnessLevel(3.99)).toBe("At Risk");
  });

  it("TC-WL-05 | returns High Risk for score < 2.00", () => {
    expect(classifyWellnessLevel(0.00)).toBe("High Risk");
    expect(classifyWellnessLevel(1.99)).toBe("High Risk");
  });

  it("TC-WL-06 | boundary: exactly 8.0 is Healthy not Stable", () => {
    expect(classifyWellnessLevel(8.0)).toBe("Healthy");
  });
});

// ── computeWellnessScore ──────────────────────────────────────────────────────

describe("computeWellnessScore", () => {
  it("TC-WS-01 | baseline floor: BTS=0 gives score 4.50 (trendSub=0.5 × 0.40 = 0.20 + floor 0.25 = 0.45 × 10)", () => {
    const result = computeWellnessScore({
      behavioralTrendScore:     0,
      journalingFrequencyScore: 0,
      moodConsistencyScore:     0,
      consecutiveNegativeCount: 0,
    });
    // trendSub = clamp01((0+100)/200) = 0.5
    // weightedRaw = 0.5*0.40 + 0*0.20 + 0*0.15 + 0.25 = 0.20 + 0.25 = 0.45 → score = 4.50
    expect(result.score).toBe(4.50);
    expect(result.level).toBe("Moderate Concern");
    expect(result.details.inputClamped).toBe(false);
  });

  it("TC-WS-02 | perfect inputs produce maximum score 10.00", () => {
    const result = computeWellnessScore({
      behavioralTrendScore:     100,   // trendSub=1.0
      journalingFrequencyScore: 100,   // freqSub=1.0
      moodConsistencyScore:     100,   // consistSub=1.0
      consecutiveNegativeCount: 0,     // no penalty
    });
    // weightedRaw=1.0*0.40+1.0*0.20+1.0*0.15+0.25=1.00, penalty=0 → score=10.00
    expect(result.score).toBe(10.00);
    expect(result.level).toBe("Healthy");
  });

  it("TC-WS-03 | maximum streak (7+) applies full 0.25 penalty", () => {
    const noStreak = computeWellnessScore({
      behavioralTrendScore: 100, journalingFrequencyScore: 100,
      moodConsistencyScore: 100, consecutiveNegativeCount: 0,
    });
    const fullStreak = computeWellnessScore({
      behavioralTrendScore: 100, journalingFrequencyScore: 100,
      moodConsistencyScore: 100, consecutiveNegativeCount: 7,
    });
    // Penalty should reduce score by exactly 0.25*10 = 2.50
    expect(noStreak.score - fullStreak.score).toBeCloseTo(2.50, 1);
    expect(fullStreak.details.streakPenalty).toBe(0.25);
  });

  it("TC-WS-04 | streak > 7 is capped at same penalty as streak=7", () => {
    const streak7 = computeWellnessScore({
      behavioralTrendScore: 50, journalingFrequencyScore: 50,
      moodConsistencyScore: 50, consecutiveNegativeCount: 7,
    });
    const streak20 = computeWellnessScore({
      behavioralTrendScore: 50, journalingFrequencyScore: 50,
      moodConsistencyScore: 50, consecutiveNegativeCount: 20,
    });
    expect(streak7.score).toBe(streak20.score);
  });

  it("TC-WS-05 | score never exceeds 10.00", () => {
    const result = computeWellnessScore({
      behavioralTrendScore:     200,   // over range
      journalingFrequencyScore: 200,   // over range
      moodConsistencyScore:     200,   // over range
      consecutiveNegativeCount: 0,
    });
    expect(result.score).toBeLessThanOrEqual(10.00);
    expect(result.details.inputClamped).toBe(true);
  });

  it("TC-WS-06 | score never goes below 0.00", () => {
    const result = computeWellnessScore({
      behavioralTrendScore:     -100,
      journalingFrequencyScore: 0,
      moodConsistencyScore:     0,
      consecutiveNegativeCount: 100,  // max penalty
    });
    expect(result.score).toBeGreaterThanOrEqual(0.00);
  });

  it("TC-WS-07 | trend sub-score: BTS=-100 → trendSub=0", () => {
    const result = computeWellnessScore({
      behavioralTrendScore:     -100,
      journalingFrequencyScore: 0,
      moodConsistencyScore:     0,
      consecutiveNegativeCount: 0,
    });
    expect(result.details.trendSubScore).toBe(0);
  });

  it("TC-WS-08 | NaN input is clamped to 0", () => {
    const result = computeWellnessScore({
      behavioralTrendScore:     NaN,
      journalingFrequencyScore: 50,
      moodConsistencyScore:     50,
      consecutiveNegativeCount: 0,
    });
    expect(isNaN(result.score)).toBe(false);
    expect(result.details.inputClamped).toBe(true);
  });

  it("TC-WS-09 | output score is rounded to 2 decimal places", () => {
    const result = computeWellnessScore({
      behavioralTrendScore:     33,
      journalingFrequencyScore: 67,
      moodConsistencyScore:     45,
      consecutiveNegativeCount: 2,
    });
    const dp = (result.score.toString().split(".")[1] ?? "").length;
    expect(dp).toBeLessThanOrEqual(2);
  });

  it("TC-WS-10 | details object satisfies transparency contract", () => {
    const result = computeWellnessScore({
      behavioralTrendScore: 50, journalingFrequencyScore: 50,
      moodConsistencyScore: 50, consecutiveNegativeCount: 3,
    });
    const d = result.details;
    expect(d.trendSubScore).toBeGreaterThanOrEqual(0);
    expect(d.trendSubScore).toBeLessThanOrEqual(1);
    expect(d.frequencySubScore).toBeGreaterThanOrEqual(0);
    expect(d.rawScore).toBeGreaterThanOrEqual(0);
    expect(d.rawScore).toBeLessThanOrEqual(1);
    expect(d.weightedRaw - d.streakPenalty).toBeCloseTo(d.rawScore, 1);
  });
});

// ── computeWellnessScoreFromIndicatorsRow ─────────────────────────────────────

describe("computeWellnessScoreFromIndicatorsRow", () => {
  it("TC-WR-01 | maps DB column names to correct inputs", () => {
    const row = {
      behavioral_trend_score:     50,
      journaling_frequency_score: 80,
      mood_consistency_score:     60,
      consecutive_negative_count: 1,
    };
    const direct = computeWellnessScore({
      behavioralTrendScore:     50,
      journalingFrequencyScore: 80,
      moodConsistencyScore:     60,
      consecutiveNegativeCount: 1,
    });
    const fromRow = computeWellnessScoreFromIndicatorsRow(row);
    expect(fromRow.score).toBe(direct.score);
    expect(fromRow.level).toBe(direct.level);
  });
});
