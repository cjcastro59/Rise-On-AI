/**
 * Integration Tests — API input validation (pure logic layer)
 * =============================================================
 * Tests input-validation helpers used by API routes.
 * These do not make HTTP requests — they validate the validation logic itself.
 *
 * TC-APIV-01 to TC-APIV-20
 */

import { describe, it, expect } from "vitest";
import { isValidUUID } from "@/app/api/admin/distress-alerts/_utils";
import {
  computeConfidenceSignal,
  computeKeywordAgreement,
  processIntegratedGradients,
} from "@/lib/explainability";
import {
  computeWellnessScore,
} from "@/lib/wellness-assessment";
import {
  computeDistressRisk,
} from "@/lib/distress-risk";

// ── /api/sentiment/explain — input validation ──────────────────────────────

describe("/api/sentiment/explain — probability input validation", () => {
  it("TC-APIV-01 | probabilities summing to 1 are processed without clamping", () => {
    const r = computeConfidenceSignal(0.8, 0.15, 0.05, "positive");
    expect(r.topClassProbability).toBe(0.8);
    expect(r.level).toBe("high");
  });

  it("TC-APIV-02 | over-range probability is handled gracefully", () => {
    // Model can return slightly over 1 due to floating point — should not throw
    expect(() => computeConfidenceSignal(1.0001, 0.0, 0.0, "positive")).not.toThrow();
  });

  it("TC-APIV-03 | zero probabilities return ambiguous level", () => {
    const r = computeConfidenceSignal(0.34, 0.33, 0.33, "positive");
    expect(r.level).toBe("ambiguous");
  });

  it("TC-APIV-04 | keyword agreement with null returns keyword_unavailable", () => {
    const r = computeKeywordAgreement("positive", null);
    expect(r.agreement).toBe("keyword_unavailable");
    expect(typeof r.disclaimer).toBe("string");
  });

  it("TC-APIV-05 | IG error from server is surfaced as available=false", () => {
    const r = processIntegratedGradients(null, 50, "captum is not installed");
    expect(r.available).toBe(false);
    expect(r.error).toBeTruthy();
  });
});

// ── /api/behavioral — numeric input validation ────────────────────────────

describe("/api/behavioral/compute — indicator input validation", () => {
  it("TC-APIV-06 | wellness score with out-of-range BTS is clamped", () => {
    const r = computeWellnessScore({
      behavioralTrendScore: 999,   // over 100
      journalingFrequencyScore: 50,
      moodConsistencyScore: 50,
      consecutiveNegativeCount: 0,
    });
    expect(r.details.inputClamped).toBe(true);
    expect(r.score).toBeLessThanOrEqual(10);
  });

  it("TC-APIV-07 | negative JFS is clamped to 0", () => {
    const r = computeWellnessScore({
      behavioralTrendScore: 0,
      journalingFrequencyScore: -50,  // invalid
      moodConsistencyScore: 50,
      consecutiveNegativeCount: 0,
    });
    expect(r.details.inputClamped).toBe(true);
    expect(r.details.frequencySubScore).toBe(0);
  });

  it("TC-APIV-08 | Infinity in BTS is clamped to 100", () => {
    const r = computeWellnessScore({
      behavioralTrendScore: Infinity,
      journalingFrequencyScore: 50,
      moodConsistencyScore: 50,
      consecutiveNegativeCount: 0,
    });
    expect(isFinite(r.score)).toBe(true);
    expect(r.details.inputClamped).toBe(true);
  });
});

// ── /api/distress-risk — input validation ────────────────────────────────

describe("/api/distress-risk — input validation", () => {
  it("TC-APIV-09 | invalid sentiment string is treated as none (0 points from C1)", () => {
    const r = computeDistressRisk({
      latestSentiment: "unknown" as any,
      behavioralTrendScore: 0,
      consecutiveNegativeCount: 0,
      wellnessScore: 5.0,
      wellnessLevel: null,
      totalEntriesWindow: 10,
      distressEntriesWindow: 0,
    });
    const c1 = r.details.conditions.find(c => c.conditionId === "C1_SENTIMENT")!;
    expect(c1.points).toBe(0);
    expect(r.details.sanitisedInput.latestSentiment).toBe("none");
  });

  it("TC-APIV-10 | BTS over 100 is clamped", () => {
    const r = computeDistressRisk({
      latestSentiment: "positive",
      behavioralTrendScore: 500,   // invalid
      consecutiveNegativeCount: 0,
      wellnessScore: 5.0,
      wellnessLevel: null,
      totalEntriesWindow: 10,
      distressEntriesWindow: 0,
    });
    expect(r.details.inputClamped).toBe(true);
    expect(r.details.sanitisedInput.behavioralTrendScore).toBeLessThanOrEqual(100);
  });

  it("TC-APIV-11 | null wellness score defaults to 5.0 (does not throw)", () => {
    expect(() => computeDistressRisk({
      latestSentiment: "positive",
      behavioralTrendScore: 0,
      consecutiveNegativeCount: 0,
      wellnessScore: null as any,
      wellnessLevel: null,
      totalEntriesWindow: 10,
      distressEntriesWindow: 0,
    })).not.toThrow();
  });

  it("TC-APIV-12 | distress entries > total entries is normalised", () => {
    const r = computeDistressRisk({
      latestSentiment: null,
      behavioralTrendScore: 0,
      consecutiveNegativeCount: 0,
      wellnessScore: 5.0,
      wellnessLevel: null,
      totalEntriesWindow: 5,
      distressEntriesWindow: 10, // more than total — invalid
    });
    // Should cap distress at total (5/5 = 100% = +2 points for C5)
    const c5 = r.details.conditions.find(c => c.conditionId === "C5_DISTRESS_FREQ")!;
    expect(c5.points).toBe(2);
  });
});

// ── /api/admin routes — UUID param validation ─────────────────────────────

describe("/api/admin distress-alerts — params.id validation", () => {
  it("TC-APIV-13 | valid UUID passes guard", () => {
    expect(isValidUUID("550e8400-e29b-4ed4-a716-446655440000")).toBe(true);
  });

  it("TC-APIV-14 | XSS payload rejected", () => {
    expect(isValidUUID("<script>alert(1)</script>")).toBe(false);
  });

  it("TC-APIV-15 | SSRF-style URL rejected", () => {
    expect(isValidUUID("http://169.254.169.254/latest/meta-data/")).toBe(false);
  });

  it("TC-APIV-16 | excessively long string rejected", () => {
    expect(isValidUUID("a".repeat(1000))).toBe(false);
  });

  it("TC-APIV-17 | empty string rejected", () => {
    expect(isValidUUID("")).toBe(false);
  });

  it("TC-APIV-18 | null/undefined treated as false (type coercion guard)", () => {
    expect(isValidUUID(null as any)).toBe(false);
    expect(isValidUUID(undefined as any)).toBe(false);
  });

  it("TC-APIV-19 | UUID with wrong version digit (v1) rejected", () => {
    // v4 requires '4' in position 14, and [89ab] in position 19
    expect(isValidUUID("550e8400-e29b-11d4-a716-446655440000")).toBe(false); // version 1
  });

  it("TC-APIV-20 | UUID with wrong variant digit rejected", () => {
    expect(isValidUUID("550e8400-e29b-41d4-5716-446655440000")).toBe(false); // variant 5, not [89ab]
  });
});
