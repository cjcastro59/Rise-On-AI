/**
 * Unit Tests — lib/distress-risk.ts
 * ===================================
 * Tests the Distress Risk Indicator (DRI) computation documented in README §9.
 *
 * Point system under test:
 *   C1 sentiment:  distress=+3, negative=+1, positive=+0
 *   C2 streak:     ≥7=+3, ≥5=+2, ≥3=+1
 *   C3 wellness:   <2=+3, <4=+2, <6=+1
 *   C4 BTS:        ≤-50=+2, ≤-20=+1
 *   C5 distress%:  ≥50%=+2, ≥25%=+1
 *   Risk levels:   0-1=Low, 2-3=Moderate, 4-6=High, 7+=Critical
 *
 * DISCLAIMER: DRI is decision-support only — not a clinical diagnosis.
 */

import { describe, it, expect } from "vitest";
import {
  computeDistressRisk,
  classifyDistressRiskLevel,
  DISTRESS_RISK_CONFIG,
  DISTRESS_RISK_POINT_RANGES,
} from "@/lib/distress-risk";

// ── classifyDistressRiskLevel ─────────────────────────────────────────────────

describe("classifyDistressRiskLevel", () => {
  it("TC-DRL-01 | 0 points → Low Risk", () => {
    expect(classifyDistressRiskLevel(0)).toBe("Low Risk");
  });
  it("TC-DRL-02 | 1 point → Low Risk", () => {
    expect(classifyDistressRiskLevel(1)).toBe("Low Risk");
  });
  it("TC-DRL-03 | 2 points → Moderate Risk", () => {
    expect(classifyDistressRiskLevel(2)).toBe("Moderate Risk");
  });
  it("TC-DRL-04 | 3 points → Moderate Risk", () => {
    expect(classifyDistressRiskLevel(3)).toBe("Moderate Risk");
  });
  it("TC-DRL-05 | 4 points → High Risk", () => {
    expect(classifyDistressRiskLevel(4)).toBe("High Risk");
  });
  it("TC-DRL-06 | 6 points → High Risk", () => {
    expect(classifyDistressRiskLevel(6)).toBe("High Risk");
  });
  it("TC-DRL-07 | 7 points → Critical Risk", () => {
    expect(classifyDistressRiskLevel(7)).toBe("Critical Risk");
  });
  it("TC-DRL-08 | 13 points (max) → Critical Risk", () => {
    expect(classifyDistressRiskLevel(13)).toBe("Critical Risk");
  });
});

// ── computeDistressRisk — Condition scoring ────────────────────────────────────

describe("computeDistressRisk — condition scoring", () => {
  const base = {
    latestSentiment:         null as null,
    behavioralTrendScore:    0,
    consecutiveNegativeCount: 0,
    wellnessScore:           5.0,
    wellnessLevel:           null as null,
    totalEntriesWindow:      10,
    distressEntriesWindow:   0,
  };

  it("TC-DRI-01 | C1: distress sentiment → +3 points; base input wellness=5→+1 → total=4 (High Risk)", () => {
    const r = computeDistressRisk({ ...base, latestSentiment: "distress" });
    const c1 = r.details.conditions.find(c => c.conditionId === "C1_SENTIMENT")!;
    expect(c1.points).toBe(3);
    // wellness=5.0 gives C3 +1 point → total = 3+1 = 4 → High Risk
    expect(r.riskLevel).toBe("High Risk");
  });

  it("TC-DRI-02 | C1: negative sentiment → +1 point; base input wellness=5→+1 → total=2 (Moderate Risk)", () => {
    const r = computeDistressRisk({ ...base, latestSentiment: "negative" });
    const c1 = r.details.conditions.find(c => c.conditionId === "C1_SENTIMENT")!;
    expect(c1.points).toBe(1);
    // wellness=5.0 gives C3 +1 point → total = 1+1 = 2 → Moderate Risk
    expect(r.riskLevel).toBe("Moderate Risk");
  });

  it("TC-DRI-03 | C1: positive sentiment → +0 points from C1; wellness=5→+1 → total=1 (Low Risk)", () => {
    const r = computeDistressRisk({ ...base, latestSentiment: "positive" });
    const c1 = r.details.conditions.find(c => c.conditionId === "C1_SENTIMENT")!;
    expect(c1.points).toBe(0);
    expect(r.riskLevel).toBe("Low Risk");
  });

  it("TC-DRI-04 | C2: streak 3 → +1 point", () => {
    const r = computeDistressRisk({ ...base, consecutiveNegativeCount: 3 });
    const c2 = r.details.conditions.find(c => c.conditionId === "C2_STREAK")!;
    expect(c2.points).toBe(1);
  });

  it("TC-DRI-05 | C2: streak 5 → +2 points", () => {
    const r = computeDistressRisk({ ...base, consecutiveNegativeCount: 5 });
    const c2 = r.details.conditions.find(c => c.conditionId === "C2_STREAK")!;
    expect(c2.points).toBe(2);
  });

  it("TC-DRI-06 | C2: streak 7 → +3 points", () => {
    const r = computeDistressRisk({ ...base, consecutiveNegativeCount: 7 });
    const c2 = r.details.conditions.find(c => c.conditionId === "C2_STREAK")!;
    expect(c2.points).toBe(3);
  });

  it("TC-DRI-07 | C3: wellness < 2.0 → +3 points", () => {
    const r = computeDistressRisk({ ...base, wellnessScore: 1.5 });
    const c3 = r.details.conditions.find(c => c.conditionId === "C3_WELLNESS")!;
    expect(c3.points).toBe(3);
  });

  it("TC-DRI-08 | C3: wellness 4.0–5.99 → +1 point", () => {
    const r = computeDistressRisk({ ...base, wellnessScore: 5.0 });
    const c3 = r.details.conditions.find(c => c.conditionId === "C3_WELLNESS")!;
    expect(c3.points).toBe(1);
  });

  it("TC-DRI-09 | C4: BTS ≤ -50 → +2 points", () => {
    const r = computeDistressRisk({ ...base, behavioralTrendScore: -50 });
    const c4 = r.details.conditions.find(c => c.conditionId === "C4_TREND")!;
    expect(c4.points).toBe(2);
  });

  it("TC-DRI-10 | C4: BTS -21 → +1 point", () => {
    const r = computeDistressRisk({ ...base, behavioralTrendScore: -21 });
    const c4 = r.details.conditions.find(c => c.conditionId === "C4_TREND")!;
    expect(c4.points).toBe(1);
  });

  it("TC-DRI-11 | C5: 50% distress entries → +2 points", () => {
    const r = computeDistressRisk({ ...base, totalEntriesWindow: 10, distressEntriesWindow: 5 });
    const c5 = r.details.conditions.find(c => c.conditionId === "C5_DISTRESS_FREQ")!;
    expect(c5.points).toBe(2);
  });

  it("TC-DRI-12 | C5: 25% distress entries → +1 point", () => {
    const r = computeDistressRisk({ ...base, totalEntriesWindow: 8, distressEntriesWindow: 2 });
    const c5 = r.details.conditions.find(c => c.conditionId === "C5_DISTRESS_FREQ")!;
    expect(c5.points).toBe(1);
  });
});

// ── Safety hierarchy ──────────────────────────────────────────────────────────

describe("computeDistressRisk — safety constraints", () => {
  it("TC-DRI-13 | distress sentiment alone cannot reach Critical (max 3 pts = Moderate)", () => {
    const r = computeDistressRisk({
      latestSentiment: "distress",
      behavioralTrendScore: 0, consecutiveNegativeCount: 0,
      wellnessScore: 6.0, wellnessLevel: "Stable",
      totalEntriesWindow: 10, distressEntriesWindow: 0,
    });
    expect(r.riskLevel).toBe("Moderate Risk");
    expect(r.totalPoints).toBe(3);
  });

  it("TC-DRI-14 | all conditions max → Critical Risk with 13 points", () => {
    const r = computeDistressRisk({
      latestSentiment: "distress",      // +3
      consecutiveNegativeCount: 7,      // +3
      wellnessScore: 1.0,               // +3
      wellnessLevel: "High Risk",
      behavioralTrendScore: -100,       // +2
      totalEntriesWindow: 10,
      distressEntriesWindow: 5,         // +2
    });
    expect(r.totalPoints).toBe(13);
    expect(r.riskLevel).toBe("Critical Risk");
  });

  it("TC-DRI-15 | five conditions each return a result object", () => {
    const r = computeDistressRisk({
      latestSentiment: "negative",
      behavioralTrendScore: -30, consecutiveNegativeCount: 4,
      wellnessScore: 3.5, wellnessLevel: "At Risk",
      totalEntriesWindow: 10, distressEntriesWindow: 3,
    });
    expect(r.details.conditions).toHaveLength(5);
    expect(r.details.conditions.every(c => typeof c.points === "number")).toBe(true);
  });
});

// ── UI config ─────────────────────────────────────────────────────────────────

describe("DISTRESS_RISK_CONFIG", () => {
  it("TC-DRC-01 | config exists for all 4 risk levels", () => {
    const levels = ["Low Risk", "Moderate Risk", "High Risk", "Critical Risk"] as const;
    levels.forEach(lvl => {
      expect(DISTRESS_RISK_CONFIG[lvl]).toBeDefined();
      expect(DISTRESS_RISK_CONFIG[lvl].emoji).toBeTruthy();
    });
  });

  it("TC-DRC-02 | DISTRESS_RISK_POINT_RANGES covers all 4 levels", () => {
    expect(Object.keys(DISTRESS_RISK_POINT_RANGES)).toHaveLength(4);
  });
});
