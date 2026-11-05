"use client";

// ============================================================
// components/counselor/StudentReportModal.tsx
//
// Password-protected printable student progress report.
// Flow:
//   1. Counselor clicks "Report" on a student row.
//   2. Modal opens showing full report preview.
//   3. A random 8-char password is auto-generated (can be changed).
//   4. Counselor clicks "Print / Save PDF".
//   5. A password confirmation prompt appears inline.
//   6. If password matches → window.print() opens the print dialog.
//
// No email, no API, no database writes. Entirely client-side.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Portal } from "@/components/ui/Portal";
import {
  WELLNESS_LEVEL_CONFIG,
  classifyWellnessLevel,
  type WellnessLevel,
} from "@/lib/wellness-assessment";
import {
  DISTRESS_RISK_CONFIG,
  type DistressRiskLevel,
} from "@/lib/distress-risk";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WellnessRow {
  wellness_score: number | null;
  wellness_level: string | null;
  consecutive_negative_count: number;
  behavioral_trend_score: number;
  journaling_frequency_score: number;
  mood_consistency_score: number;
  total_entries_window: number;
  window_end_date: string;
}

interface RiskRow {
  risk_level: string;
  total_points: number;
  assessed_date: string;
}

export interface StudentReportData {
  displayId: string;
  age: string;
  sex: string;
  entries: number;
  lastActive: string;
  sentiment: string;
  activityStatus: string;
  wellness: WellnessRow | null;
  risk: RiskRow | null;
  counselorName?: string;
  reportDate?: string;
}

interface StudentReportModalProps {
  student: StudentReportData;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 to avoid confusion
  let pw = "";
  for (let i = 0; i < 8; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}

// ── Print styles injected into <head> during print ───────────────────────────

const PRINT_STYLES = `
@media print {
  body > *:not(#student-report-print-root) { display: none !important; }
  #student-report-print-root { display: block !important; }
  #student-report-print-root .no-print { display: none !important; }
  @page { margin: 18mm; size: A4; }
}
`;

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-poppins font-semibold uppercase tracking-widest text-slate-500 mt-5 mb-2 border-b border-gray-200 pb-1">
      {children}
    </h3>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 py-1">
      <span className="text-xs font-poppins text-slate-500 w-40 shrink-0">{label}</span>
      <span className="text-sm font-inter text-slate-800">{value}</span>
    </div>
  );
}

function ScoreBadge({ score, level }: { score: number | null; level: string | null }) {
  if (score == null) return <span className="text-sm text-slate-400">—</span>;
  const lvl = (level as WellnessLevel) ?? classifyWellnessLevel(score);
  const cfg = WELLNESS_LEVEL_CONFIG[lvl] ?? WELLNESS_LEVEL_CONFIG["Stable"];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-poppins font-semibold"
      style={{ backgroundColor: cfg.bgColor, color: cfg.color }}
    >
      {cfg.emoji} {score.toFixed(1)} — {lvl}
    </span>
  );
}

function RiskBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-sm text-slate-400">—</span>;
  const cfg = DISTRESS_RISK_CONFIG[level as DistressRiskLevel] ?? DISTRESS_RISK_CONFIG["Low Risk"];
  const isBad = level === "Critical Risk" || level === "High Risk";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-poppins font-semibold border ${
        isBad
          ? "border-rose-200 bg-rose-100 text-rose-800"
          : level === "Moderate Risk"
          ? "border-amber-200 bg-amber-100 text-amber-900"
          : "border-emerald-200 bg-emerald-100 text-emerald-800"
      }`}
    >
      {cfg.emoji} {level}
    </span>
  );
}

// ── Report content (reused for both preview and print) ────────────────────────

function ReportContent({ student }: { student: StudentReportData }) {
  const w = student.wellness;
  const r = student.risk;
  const today = student.reportDate ?? new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const btsDir = w
    ? w.behavioral_trend_score >= 10
      ? "↑ Improving"
      : w.behavioral_trend_score <= -10
      ? "↓ Declining"
      : "→ Stable"
    : null;

  return (
    <div className="font-inter text-slate-800">
      {/* Report Header */}
      <div className="text-center mb-6 pb-4 border-b-2 border-gray-200">
        <p className="text-xs font-poppins text-slate-500 uppercase tracking-widest mb-1">
          Pamantasan ng Lungsod ng Pasig
        </p>
        <h1 className="text-xl font-dm-serif text-slate-900 mb-0.5">
          Rise On AI — Student Progress Report
        </h1>
        <p className="text-xs text-slate-500 font-inter">
          Generated by Rise On AI Counseling Platform · {today}
        </p>
        {student.counselorName && (
          <p className="text-xs text-slate-500 font-inter mt-0.5">
            Prepared by: {student.counselorName}
          </p>
        )}
        <p className="mt-2 text-[10px] text-slate-400 font-inter italic">
          This report is a decision-support document generated by an AI-assisted system.
          It is not a clinical diagnosis and should not replace professional mental health assessment.
        </p>
      </div>

      {/* Student Profile */}
      <SectionTitle>Student Profile</SectionTitle>
      <div className="grid grid-cols-2 gap-x-8">
        <InfoRow label="Student ID" value={student.displayId} />
        <InfoRow label="Age" value={student.age} />
        <InfoRow label="Sex" value={student.sex} />
        <InfoRow label="Account Status" value={student.activityStatus} />
        <InfoRow label="Total Journal Entries" value={student.entries} />
        <InfoRow label="Last Active" value={student.lastActive} />
        <InfoRow label="Overall Sentiment" value={student.sentiment} />
      </div>

      {/* Wellness Assessment */}
      <SectionTitle>Wellness Assessment</SectionTitle>
      {w ? (
        <>
          <div className="grid grid-cols-2 gap-x-8">
            <InfoRow
              label="Wellness Score"
              value={<ScoreBadge score={w.wellness_score} level={w.wellness_level} />}
            />
            <InfoRow
              label="Assessment Period"
              value={`30-day lookback · ${w.window_end_date}`}
            />
            <InfoRow
              label="Total Entries (Window)"
              value={w.total_entries_window}
            />
            <InfoRow
              label="Consecutive Negative Streak"
              value={`${w.consecutive_negative_count} ${w.consecutive_negative_count >= 3 ? "⚠️" : ""}`}
            />
          </div>
          <SectionTitle>Behavioral Indicators</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8">
            <InfoRow
              label="Behavioral Trend Score"
              value={`${w.behavioral_trend_score > 0 ? "+" : ""}${w.behavioral_trend_score} ${btsDir ?? ""}`}
            />
            <InfoRow
              label="Journaling Frequency Score"
              value={`${w.journaling_frequency_score.toFixed(1)} / 100`}
            />
            <InfoRow
              label="Mood Consistency Score"
              value={`${w.mood_consistency_score.toFixed(1)} / 100`}
            />
          </div>
          <p className="text-[10px] text-slate-400 font-inter italic mt-1">
            Wellness Score is an algorithm-derived indicator (0–10). It has not been clinically validated
            and should not be interpreted as a standardized clinical assessment.
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-500 font-inter">No wellness data available yet. Student may not have submitted journal entries.</p>
      )}

      {/* Distress Risk */}
      <SectionTitle>Distress Risk Indicator</SectionTitle>
      {r ? (
        <>
          <div className="grid grid-cols-2 gap-x-8">
            <InfoRow
              label="Risk Level"
              value={<RiskBadge level={r.risk_level} />}
            />
            <InfoRow label="Total Risk Points" value={`${r.total_points} / 13`} />
            <InfoRow label="Assessment Date" value={r.assessed_date} />
          </div>
          <p className="text-[10px] text-slate-400 font-inter italic mt-1">
            Distress Risk Indicator is a decision-support mechanism and is not a clinical diagnosis.
            Critical Risk requires multiple behavioral conditions to be simultaneously active.
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-500 font-inter">No distress risk assessment available.</p>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-[10px] text-slate-400 font-inter text-center">
        Rise On AI · AI-Assisted Mental Wellness Monitoring System · PLP College of Computer Studies ·
        This document is confidential and intended for authorized personnel only.
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function StudentReportModal({ student, onClose }: StudentReportModalProps) {
  const [password, setPassword] = useState<string>(generatePassword);
  const [showPasswordEdit, setShowPasswordEdit] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [confirmStep, setConfirmStep] = useState(false); // true = show password entry before print
  const [copied, setCopied] = useState(false);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const printRootRef = useRef<HTMLDivElement | null>(null);

  // Inject print styles on mount, remove on unmount
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = PRINT_STYLES;
    document.head.appendChild(style);
    styleRef.current = style;
    return () => {
      if (styleRef.current) document.head.removeChild(styleRef.current);
    };
  }, []);

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback — select the input
    }
  };

  const handlePrintClick = () => {
    // Show the inline password confirmation step
    setPwInput("");
    setPwError("");
    setConfirmStep(true);
  };

  const handleConfirmPrint = () => {
    if (pwInput.toUpperCase() !== password.toUpperCase()) {
      setPwError("Incorrect password. Please check and try again.");
      return;
    }
    setPwError("");
    setConfirmStep(false);
    // Give the browser a tick to close the confirm UI, then print
    setTimeout(() => window.print(), 100);
  };

  return (
    <Portal>
      {/* Hidden print-only root — lives outside modal for clean print */}
      <div
        id="student-report-print-root"
        ref={printRootRef}
        className="hidden print:block p-8"
      >
        <ReportContent student={student} />
      </div>

      {/* Modal overlay */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl z-10 m-4 w-full max-w-3xl max-h-[92vh] flex flex-col">

          {/* Modal header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 no-print shrink-0">
            <div>
              <h2 className="text-lg font-dm-serif text-slate-900">Student Progress Report</h2>
              <p className="text-xs text-slate-500 font-inter mt-0.5">
                {student.displayId} · Preview before printing
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-slate-500"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Report preview — scrollable */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <ReportContent student={student} />
          </div>

          {/* Password + print controls */}
          <div className="border-t border-gray-100 px-6 py-4 no-print shrink-0 bg-gray-50 rounded-b-2xl space-y-3">

            {/* Password row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <span className="text-xs font-poppins text-slate-600 shrink-0">🔑 Report Password:</span>
                {showPasswordEdit ? (
                  <input
                    type="text"
                    value={password}
                    maxLength={12}
                    onChange={(e) => setPassword(e.target.value.toUpperCase())}
                    onBlur={() => setShowPasswordEdit(false)}
                    autoFocus
                    className="border border-gray-300 rounded-lg px-3 py-1 text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#A8DADC] w-36"
                  />
                ) : (
                  <span
                    className="font-mono font-bold text-slate-900 bg-white border border-gray-200 rounded-lg px-3 py-1 text-sm cursor-pointer hover:bg-gray-50 select-all"
                    onClick={() => setShowPasswordEdit(true)}
                    title="Click to edit"
                  >
                    {password}
                  </span>
                )}
                <button
                  onClick={handleCopyPassword}
                  className="text-xs text-[#4EAAB3] hover:underline font-poppins"
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
                <button
                  onClick={() => setPassword(generatePassword())}
                  className="text-xs text-slate-500 hover:text-slate-700 font-poppins"
                >
                  ↺ New
                </button>
              </div>
              <p className="text-[11px] text-slate-400 font-inter">
                Note this password — it will be required to unlock the print dialog.
              </p>
            </div>

            {/* Password confirmation step */}
            {confirmStep && (
              <div className="bg-white border border-[#A8DADC] rounded-xl px-4 py-3 space-y-2">
                <p className="text-sm font-poppins text-slate-700">
                  Enter the report password to proceed with printing:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pwInput}
                    onChange={(e) => { setPwInput(e.target.value.toUpperCase()); setPwError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleConfirmPrint()}
                    placeholder="Enter password"
                    autoFocus
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#A8DADC] w-40 uppercase"
                  />
                  <button
                    onClick={handleConfirmPrint}
                    className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-sm font-poppins hover:bg-slate-700 transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmStep(false)}
                    className="text-xs text-slate-500 hover:text-slate-700 font-poppins"
                  >
                    Cancel
                  </button>
                </div>
                {pwError && <p className="text-xs text-rose-600 font-inter">{pwError}</p>}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-poppins text-slate-700 hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
              {!confirmStep && (
                <button
                  onClick={handlePrintClick}
                  className="px-5 py-2 bg-slate-900 text-white rounded-lg text-sm font-poppins hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  🖨️ Print / Save PDF
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </Portal>
  );
}
