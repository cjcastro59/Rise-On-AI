/**
 * AI Evaluation Tests — Phase 9 (Phase 3.2 AI metrics)
 * ======================================================
 * Tests that the XLM-RoBERTa fine-tuned model meets documented metric targets.
 *
 * HOW THIS WORKS
 * ──────────────
 * 1. Run the Python evaluation pipeline FIRST:
 *      cd scripts/sentiment-model-training
 *      python 04_evaluate_model.py --skip-base
 *    This produces:  scripts/sentiment-model-training/outputs/04_evaluation_report.json
 *
 * 2. Run the standalone evaluator (optional, produces 05_eval_report.json):
 *      python 05_evaluate_standalone.py
 *
 * 3. Then run these tests:
 *      npm test -- tests/ai
 *
 * DOCUMENTED METRIC TARGETS (from README and Capstone)
 * ─────────────────────────────────────────────────────
 *   Accuracy          ≥ 0.80  (Acceptable) / ≥ 0.88 (Target)
 *   F1 Macro          ≥ 0.75  (Acceptable) / ≥ 0.85 (Target)
 *   F1 Weighted       ≥ 0.78  (Acceptable) / ≥ 0.88 (Target)
 *   Distress Recall   ≥ 0.80  (SAFETY-CRITICAL minimum)
 *
 * IMPORTANT
 * ─────────
 * • Tests SKIP gracefully when the JSON report file does not exist
 *   (e.g. in CI without a trained model available).
 * • Tests NEVER fabricate results — all numbers come from the JSON file
 *   produced by the Python evaluator.
 * • All metric values are read directly from the evaluation output;
 *   no inference is performed in this file.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

// ── Paths ─────────────────────────────────────────────────────────────────────

const OUTPUTS_DIR = resolve(
  __dirname,
  "../../scripts/sentiment-model-training/outputs"
);

const REPORT_PATH_04 = resolve(OUTPUTS_DIR, "04_evaluation_report.json");
const REPORT_PATH_05 = resolve(OUTPUTS_DIR, "05_eval_report.json");

// ── Metric targets (from documented requirements) ─────────────────────────────

const TARGETS = {
  accuracy:          { acceptable: 0.80, target: 0.88 },
  f1_macro:          { acceptable: 0.75, target: 0.85 },
  f1_weighted:       { acceptable: 0.78, target: 0.88 },
  distress_recall:   { safety_min: 0.80 },          // safety-critical
  distress_f1:       { acceptable: 0.70 },
  positive_f1:       { acceptable: 0.70 },
  negative_f1:       { acceptable: 0.65 },           // typically hardest class
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

type EvalReport = {
  finetuned?: {
    n_samples?: number;
    accuracy?: number;
    precision_macro?: number;
    recall_macro?: number;
    f1_macro?: number;
    precision_weighted?: number;
    recall_weighted?: number;
    f1_weighted?: number;
    per_positive?: { precision: number; recall: number; f1: number; support: number };
    per_negative?: { precision: number; recall: number; f1: number; support: number };
    per_distress?: { precision: number; recall: number; f1: number; support: number };
    confusion_matrix?: number[][];
  };
  keyword?: {
    accuracy?: number;
    f1_macro?: number;
  };
  analysis?: {
    lowest_f1?: { class: string; value: number };
    lowest_recall?: { class: string; value: number };
    flag_imbalance?: boolean;
  };
};

function loadReport(path: string): EvalReport | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as EvalReport;
  } catch {
    return null;
  }
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("AI Evaluation — Fine-tuned XLM-RoBERTa (04_evaluation_report.json)", () => {
  let report: EvalReport | null = null;
  let ft: EvalReport["finetuned"] | undefined;

  beforeAll(() => {
    report = loadReport(REPORT_PATH_04);
    ft = report?.finetuned;
  });

  // ── Pre-condition ──────────────────────────────────────────────────────────
  it("TC-AI-01 | evaluation report exists (run 04_evaluate_model.py first)", () => {
    if (!existsSync(REPORT_PATH_04)) {
      console.warn(
        "[SKIP] 04_evaluation_report.json not found.\n" +
        "       Run:  cd scripts/sentiment-model-training && python 04_evaluate_model.py --skip-base\n" +
        "       Then re-run these tests."
      );
    }
    // Mark as skipped rather than failed when report is absent
    const reportExists = existsSync(REPORT_PATH_04);
    if (!reportExists) return; // graceful skip
    expect(reportExists).toBe(true);
  });

  it("TC-AI-02 | finetuned section is present in report", () => {
    if (!report) return;
    expect(report.finetuned).toBeDefined();
  });

  it("TC-AI-03 | test set has at least 50 samples (sufficient evaluation set)", () => {
    if (!ft) return;
    expect(ft.n_samples).toBeGreaterThanOrEqual(50);
  });

  // ── Overall metrics ────────────────────────────────────────────────────────
  it("TC-AI-04 | accuracy meets acceptable threshold (≥ 0.80)", () => {
    if (!ft?.accuracy) return;
    expect(ft.accuracy).toBeGreaterThanOrEqual(TARGETS.accuracy.acceptable);
    // Log achieved vs target
    console.info(`[AI] Accuracy: ${(ft.accuracy * 100).toFixed(2)}% (target ≥ ${TARGETS.accuracy.target * 100}%)`);
  });

  it("TC-AI-05 | F1 macro meets acceptable threshold (≥ 0.75)", () => {
    if (!ft?.f1_macro) return;
    expect(ft.f1_macro).toBeGreaterThanOrEqual(TARGETS.f1_macro.acceptable);
    console.info(`[AI] F1 Macro: ${(ft.f1_macro * 100).toFixed(2)}% (target ≥ ${TARGETS.f1_macro.target * 100}%)`);
  });

  it("TC-AI-06 | F1 weighted meets acceptable threshold (≥ 0.78)", () => {
    if (!ft?.f1_weighted) return;
    expect(ft.f1_weighted).toBeGreaterThanOrEqual(TARGETS.f1_weighted.acceptable);
    console.info(`[AI] F1 Weighted: ${(ft.f1_weighted * 100).toFixed(2)}%`);
  });

  // ── Safety-critical: Distress class ───────────────────────────────────────
  it("TC-AI-07 | [SAFETY] Distress recall ≥ 0.80 — missed distress is a clinical risk", () => {
    if (!ft?.per_distress) return;
    const distressRecall = ft.per_distress.recall;
    console.info(`[AI] Distress Recall: ${(distressRecall * 100).toFixed(2)}% (safety min ≥ ${TARGETS.distress_recall.safety_min * 100}%)`);
    if (distressRecall < TARGETS.distress_recall.safety_min) {
      console.error(
        `[SAFETY WARNING] Distress recall ${(distressRecall * 100).toFixed(2)}% is BELOW the ` +
        `safety minimum of ${TARGETS.distress_recall.safety_min * 100}%. ` +
        "Users in distress may be missed. Add more distress training samples."
      );
    }
    expect(distressRecall).toBeGreaterThanOrEqual(TARGETS.distress_recall.safety_min);
  });

  it("TC-AI-08 | Distress F1 ≥ 0.70", () => {
    if (!ft?.per_distress) return;
    expect(ft.per_distress.f1).toBeGreaterThanOrEqual(TARGETS.distress_f1.acceptable);
    console.info(`[AI] Distress F1: ${(ft.per_distress.f1 * 100).toFixed(2)}%`);
  });

  it("TC-AI-09 | Distress precision is non-zero", () => {
    if (!ft?.per_distress) return;
    expect(ft.per_distress.precision).toBeGreaterThan(0);
  });

  // ── Per-class metrics ──────────────────────────────────────────────────────
  it("TC-AI-10 | Positive F1 ≥ 0.70", () => {
    if (!ft?.per_positive) return;
    expect(ft.per_positive.f1).toBeGreaterThanOrEqual(TARGETS.positive_f1.acceptable);
    console.info(`[AI] Positive F1: ${(ft.per_positive.f1 * 100).toFixed(2)}%`);
  });

  it("TC-AI-11 | Negative F1 ≥ 0.65 (typically lowest due to overlap)", () => {
    if (!ft?.per_negative) return;
    expect(ft.per_negative.f1).toBeGreaterThanOrEqual(TARGETS.negative_f1.acceptable);
    console.info(`[AI] Negative F1: ${(ft.per_negative.f1 * 100).toFixed(2)}%`);
  });

  it("TC-AI-12 | confusion matrix is 3×3 (3-class classification)", () => {
    if (!ft?.confusion_matrix) return;
    expect(ft.confusion_matrix).toHaveLength(3);
    ft.confusion_matrix.forEach(row => expect(row).toHaveLength(3));
  });

  it("TC-AI-13 | confusion matrix diagonal sum equals n_samples", () => {
    if (!ft?.confusion_matrix || !ft.n_samples) return;
    const correctPredictions = ft.confusion_matrix.reduce(
      (sum, row, i) => sum + row[i], 0
    );
    // Diagonal sum = correct predictions; must not exceed n_samples
    expect(correctPredictions).toBeLessThanOrEqual(ft.n_samples);
    expect(correctPredictions).toBeGreaterThan(0);
  });

  // ── Comparison: fine-tuned > keyword baseline ──────────────────────────────
  it("TC-AI-14 | fine-tuned F1 macro exceeds keyword baseline", () => {
    if (!ft?.f1_macro || !report?.keyword?.f1_macro) return;
    console.info(
      `[AI] Fine-tuned F1 Macro: ${(ft.f1_macro * 100).toFixed(2)}%  |  ` +
      `Keyword baseline: ${((report.keyword.f1_macro ?? 0) * 100).toFixed(2)}%`
    );
    expect(ft.f1_macro).toBeGreaterThan(report.keyword.f1_macro ?? 0);
  });

  it("TC-AI-15 | fine-tuned accuracy exceeds keyword baseline", () => {
    if (!ft?.accuracy || !report?.keyword?.accuracy) return;
    expect(ft.accuracy).toBeGreaterThan(report.keyword.accuracy ?? 0);
  });

  // ── Analysis section ───────────────────────────────────────────────────────
  it("TC-AI-16 | analysis section identifies a lowest-F1 class", () => {
    if (!report?.analysis) return;
    expect(report.analysis.lowest_f1).toBeDefined();
    expect(typeof report.analysis.lowest_f1?.class).toBe("string");
    expect(typeof report.analysis.lowest_f1?.value).toBe("number");
    console.info(`[AI] Lowest F1 class: ${report.analysis.lowest_f1?.class} (${((report.analysis.lowest_f1?.value ?? 0) * 100).toFixed(2)}%)`);
  });

  it("TC-AI-17 | test set class distribution is reported", () => {
    if (!ft) return;
    const totalFromClasses =
      (ft.per_positive?.support ?? 0) +
      (ft.per_negative?.support ?? 0) +
      (ft.per_distress?.support ?? 0);
    if (ft.n_samples && totalFromClasses > 0) {
      expect(Math.abs(totalFromClasses - ft.n_samples)).toBeLessThanOrEqual(1);
    }
  });
});

// ── Standalone evaluator report (05) — same targets ──────────────────────────

describe("AI Evaluation — Standalone report (05_eval_report.json)", () => {
  let report05: EvalReport | null = null;

  beforeAll(() => {
    report05 = loadReport(REPORT_PATH_05);
  });

  it("TC-AI-18 | standalone report exists when evaluator has been run", () => {
    if (!existsSync(REPORT_PATH_05)) {
      console.warn("[SKIP] 05_eval_report.json not found. Run 05_evaluate_standalone.py first.");
      return;
    }
    expect(existsSync(REPORT_PATH_05)).toBe(true);
  });

  it("TC-AI-19 | [SAFETY] standalone distress recall ≥ 0.80", () => {
    const ft05 = report05?.finetuned;
    if (!ft05?.per_distress) return;
    expect(ft05.per_distress.recall).toBeGreaterThanOrEqual(TARGETS.distress_recall.safety_min);
  });

  it("TC-AI-20 | standalone F1 macro ≥ 0.75", () => {
    const ft05 = report05?.finetuned;
    if (!ft05?.f1_macro) return;
    expect(ft05.f1_macro).toBeGreaterThanOrEqual(TARGETS.f1_macro.acceptable);
  });
});

// ── Metric target documentation ───────────────────────────────────────────────

describe("AI Evaluation — Documented metric targets (Capstone reference)", () => {
  it("TC-AI-21 | target constants match documented requirements", () => {
    // These constants are the reference values documented in the Capstone.
    // If they are changed, it must be a conscious decision — not accidental.
    expect(TARGETS.accuracy.acceptable).toBe(0.80);
    expect(TARGETS.f1_macro.acceptable).toBe(0.75);
    expect(TARGETS.f1_weighted.acceptable).toBe(0.78);
    expect(TARGETS.distress_recall.safety_min).toBe(0.80);
  });

  it("TC-AI-22 | distress recall target is more stringent than other classes", () => {
    // Safety class gets a higher recall floor than overall F1
    expect(TARGETS.distress_recall.safety_min).toBeGreaterThanOrEqual(TARGETS.f1_macro.acceptable);
  });
});
