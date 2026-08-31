/**
 * Unit Tests — lib/adaptive-response.ts
 * =======================================
 * Tests the ACI strategy selection and response generation.
 * Verifies:
 *   • 3-class sentiment → 3 response categories (no Neutral)
 *   • Safety hierarchy: Critical Risk always → critical_safety
 *   • distress sentiment always → distress category
 *   • Disclaimer always present
 *   • Response fields are non-empty strings
 *   • Deterministic: same inputs → same output
 */

import { describe, it, expect } from "vitest";
import { generateAdaptiveResponse, ACI_CATEGORY_CONFIG } from "@/lib/adaptive-response";

const baseInput = {
  sentiment:               "positive" as const,
  behavioralTrendScore:    0,
  consecutiveNegativeCount: 0,
  journalingFrequencyScore: 50,
  wellnessScore:           6.0,
  wellnessLevel:           "Stable" as const,
  distressRiskLevel:       "Low Risk" as const,
  entryMood:               null,
  recentEmotions:          [],
};

// ── Response category mapping ─────────────────────────────────────────────────

describe("generateAdaptiveResponse — response category", () => {
  it("TC-ACI-01 | positive sentiment → positive category", () => {
    const r = generateAdaptiveResponse({ ...baseInput, sentiment: "positive" });
    expect(r.responseCategory).toBe("positive");
  });

  it("TC-ACI-02 | negative sentiment → negative category", () => {
    const r = generateAdaptiveResponse({
      ...baseInput, sentiment: "negative",
      wellnessScore: 6.0, distressRiskLevel: "Low Risk",
    });
    expect(r.responseCategory).toBe("negative");
  });

  it("TC-ACI-03 | distress sentiment → distress category (overrides everything)", () => {
    const r = generateAdaptiveResponse({
      ...baseInput, sentiment: "distress",
      distressRiskLevel: "Low Risk", wellnessScore: 8.0,
    });
    expect(r.responseCategory).toBe("distress");
  });

  it("TC-ACI-04 | no Neutral category ever produced", () => {
    const sentiments = ["positive", "negative", "distress"] as const;
    sentiments.forEach(s => {
      const r = generateAdaptiveResponse({ ...baseInput, sentiment: s });
      expect(r.responseCategory).not.toBe("neutral");
      expect(["positive","negative","distress"]).toContain(r.responseCategory);
    });
  });
});

// ── Safety hierarchy ──────────────────────────────────────────────────────────

describe("generateAdaptiveResponse — safety hierarchy", () => {
  it("TC-ACI-05 | Critical Risk always → critical_safety tone regardless of sentiment", () => {
    const r = generateAdaptiveResponse({
      ...baseInput, sentiment: "positive", distressRiskLevel: "Critical Risk",
    });
    expect(r.tone).toBe("critical_safety");
    expect(r.responseCategory).toBe("distress");
  });

  it("TC-ACI-06 | High Risk → high_risk_urgent tone", () => {
    const r = generateAdaptiveResponse({
      ...baseInput, sentiment: "positive", distressRiskLevel: "High Risk",
    });
    expect(r.tone).toBe("high_risk_urgent");
    expect(r.responseCategory).toBe("distress");
  });

  it("TC-ACI-07 | distress + Low Risk → distress_support tone", () => {
    const r = generateAdaptiveResponse({
      ...baseInput, sentiment: "distress", distressRiskLevel: "Low Risk",
    });
    expect(r.tone).toBe("distress_support");
    expect(r.responseCategory).toBe("distress");
  });

  it("TC-ACI-08 | crisis note is non-null for distress/high-risk responses", () => {
    const critical = generateAdaptiveResponse({ ...baseInput, distressRiskLevel: "Critical Risk" });
    const high     = generateAdaptiveResponse({ ...baseInput, distressRiskLevel: "High Risk" });
    const distress = generateAdaptiveResponse({ ...baseInput, sentiment: "distress" });
    expect(critical.crisisNote).not.toBeNull();
    expect(high.crisisNote).not.toBeNull();
    expect(distress.crisisNote).not.toBeNull();
  });

  it("TC-ACI-09 | crisis note is null for positive / low-risk responses", () => {
    const r = generateAdaptiveResponse({ ...baseInput, sentiment: "positive", distressRiskLevel: "Low Risk" });
    expect(r.crisisNote).toBeNull();
  });
});

// ── Sub-tone selection ────────────────────────────────────────────────────────

describe("generateAdaptiveResponse — sub-tone logic", () => {
  it("TC-ACI-10 | sustained_growth: positive + BTS≥20 + wellness≥6", () => {
    const r = generateAdaptiveResponse({
      ...baseInput, sentiment: "positive",
      behavioralTrendScore: 25, wellnessScore: 7.0,
      distressRiskLevel: "Low Risk",
    });
    expect(r.tone).toBe("sustained_growth");
  });

  it("TC-ACI-11 | positive_vigilant: positive + wellness < 6", () => {
    const r = generateAdaptiveResponse({
      ...baseInput, sentiment: "positive",
      wellnessScore: 4.0, behavioralTrendScore: 0,
      distressRiskLevel: "Low Risk",
    });
    expect(r.tone).toBe("positive_vigilant");
  });

  it("TC-ACI-12 | extended_streak: negative + streak ≥ 5", () => {
    const r = generateAdaptiveResponse({
      ...baseInput, sentiment: "negative",
      consecutiveNegativeCount: 5, distressRiskLevel: "Low Risk",
      wellnessScore: 6.0,
    });
    expect(r.tone).toBe("extended_streak");
  });

  it("TC-ACI-13 | declining_trend: negative + BTS≤-20 + wellness<6", () => {
    const r = generateAdaptiveResponse({
      ...baseInput, sentiment: "negative",
      behavioralTrendScore: -25, wellnessScore: 5.0,
      consecutiveNegativeCount: 0, distressRiskLevel: "Moderate Risk",
    });
    expect(r.tone).toBe("declining_trend");
  });
});

// ── Output contract ───────────────────────────────────────────────────────────

describe("generateAdaptiveResponse — output fields", () => {
  it("TC-ACI-14 | disclaimer is always present and non-empty", () => {
    const inputs = [
      { ...baseInput, sentiment: "positive" as const },
      { ...baseInput, sentiment: "negative" as const },
      { ...baseInput, sentiment: "distress" as const },
      { ...baseInput, distressRiskLevel: "Critical Risk" as const },
    ];
    inputs.forEach(inp => {
      const r = generateAdaptiveResponse(inp);
      expect(typeof r.disclaimer).toBe("string");
      expect(r.disclaimer.length).toBeGreaterThan(20);
    });
  });

  it("TC-ACI-15 | greeting, message, reflection are non-empty strings", () => {
    const r = generateAdaptiveResponse(baseInput);
    expect(r.greeting.length).toBeGreaterThan(0);
    expect(r.message.length).toBeGreaterThan(0);
    expect(r.reflection.length).toBeGreaterThan(0);
  });

  it("TC-ACI-16 | suggestions is a non-empty array of strings", () => {
    const r = generateAdaptiveResponse(baseInput);
    expect(Array.isArray(r.suggestions)).toBe(true);
    expect(r.suggestions.length).toBeGreaterThan(0);
    r.suggestions.forEach(s => expect(typeof s).toBe("string"));
  });

  it("TC-ACI-17 | deterministic: same inputs produce identical output", () => {
    const r1 = generateAdaptiveResponse(baseInput);
    const r2 = generateAdaptiveResponse(baseInput);
    expect(r1.tone).toBe(r2.tone);
    expect(r1.greeting).toBe(r2.greeting);
    expect(r1.message).toBe(r2.message);
  });

  it("TC-ACI-18 | contextUsed reflects the inputs provided", () => {
    const r = generateAdaptiveResponse({
      ...baseInput, sentiment: "distress", wellnessScore: 3.0,
    });
    expect(r.contextUsed.sentiment).toBe("distress");
    expect(r.contextUsed.wellnessScore).toBe(3.0);
  });
});

// ── ACI_CATEGORY_CONFIG ───────────────────────────────────────────────────────

describe("ACI_CATEGORY_CONFIG", () => {
  it("TC-ACI-19 | config exists for all 3 categories", () => {
    expect(ACI_CATEGORY_CONFIG.positive).toBeDefined();
    expect(ACI_CATEGORY_CONFIG.negative).toBeDefined();
    expect(ACI_CATEGORY_CONFIG.distress).toBeDefined();
  });

  it("TC-ACI-20 | each config has required UI fields", () => {
    Object.values(ACI_CATEGORY_CONFIG).forEach(cfg => {
      expect(cfg.color).toBeTruthy();
      expect(cfg.borderColor).toBeTruthy();
      expect(cfg.emoji).toBeTruthy();
    });
  });
});
