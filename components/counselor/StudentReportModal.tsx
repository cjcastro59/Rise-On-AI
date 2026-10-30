"use client";

import { useState } from "react";
import { Portal } from "@/components/ui/Portal";
import { Button } from "@/components/ui/button";
import { WELLNESS_LEVEL_CONFIG, type WellnessLevel } from "@/lib/wellness-assessment";
import { DISTRESS_RISK_CONFIG, type DistressRiskLevel } from "@/lib/distress-risk";

export interface StudentReportData {
  studentId: string;
  studentName: string;
  studentEmail: string | null;
  totalEntries: number;
  positivePercent: number;
  negativePercent: number;
  distressPercent: number;
  wellnessScore: number | null;
  wellnessLevel: string | null;
  distressRiskLevel: string | null;
  totalPoints: number;
  bts: number | null;
  jfs: number | null;
  mcs: number | null;
  cnc: number;
  counselorName: string;
}

interface StudentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: StudentReportData;
}

export default function StudentReportModal({ isOpen, onClose, data }: StudentReportModalProps) {
  const [counselorNotes, setCounselorNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportPassword, setReportPassword] = useState<string | null>(null);

  if (!isOpen) return null;

  const reportDate = new Date().toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const wellnessCfg = data.wellnessLevel
    ? WELLNESS_LEVEL_CONFIG[data.wellnessLevel as WellnessLevel]
    : null;
  const riskCfg = data.distressRiskLevel
    ? DISTRESS_RISK_CONFIG[data.distressRiskLevel as DistressRiskLevel]
    : null;

  const handlePrint = () => window.print();

  const handleSendEmail = async () => {
    if (!data.studentEmail) {
      setError("This student has no email address on record.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/counselor/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentUserId: data.studentId,
          studentEmail: data.studentEmail,
          studentName: data.studentName,
          reportDate,
          wellnessScore: data.wellnessScore?.toFixed(2),
          wellnessLevel: data.wellnessLevel,
          distressRiskLevel: data.distressRiskLevel,
          totalPoints: data.totalPoints,
          positivePercent: data.positivePercent,
          negativePercent: data.negativePercent,
          distressPercent: data.distressPercent,
          totalEntries: data.totalEntries,
          bts: data.bts,
          jfs: data.jfs !== null ? Math.round(data.jfs) : null,
          mcs: data.mcs !== null ? Math.round(data.mcs) : null,
          cnc: data.cnc,
          counselorNotes: counselorNotes.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to send report.");
      setSent(true);
      if (result.reportPassword) setReportPassword(result.reportPassword);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .print-area, .print-area * { visibility: visible; }
              .print-area { position: fixed; inset: 0; padding: 24px; }
              .no-print { display: none !important; }
            }
          `}</style>

          {/* Header */}
          <div className="no-print flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
            <div>
              <h2 className="text-lg font-dm-serif text-dark-text">Student Progress Report</h2>
              <p className="text-xs text-slate-600 font-inter mt-0.5">Preview before printing or sending</p>
            </div>
            <button onClick={onClose} className="text-slate-600 hover:text-dark-text text-2xl leading-none">×</button>
          </div>

          {/* Report Content */}
          <div className="print-area p-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] rounded-2xl p-6 mb-6 text-center">
              <h1 className="text-2xl font-dm-serif text-dark-text mb-1">Rise On AI</h1>
              <p className="text-sm text-slate-700 font-poppins">Student Wellness Progress Report</p>
            </div>

            {/* Student Info */}
            <div className="grid grid-cols-2 gap-3 mb-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div>
                <p className="text-xs text-slate-500 font-poppins uppercase tracking-wider">Student Name</p>
                <p className="text-sm font-semibold font-poppins text-dark-text mt-1">{data.studentName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-poppins uppercase tracking-wider">Email</p>
                <p className="text-sm font-inter text-dark-text mt-1">{data.studentEmail || "Not on record"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-poppins uppercase tracking-wider">Report Generated</p>
                <p className="text-sm font-inter text-dark-text mt-1">{reportDate}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-poppins uppercase tracking-wider">Prepared by</p>
                <p className="text-sm font-semibold font-poppins text-dark-text mt-1">{data.counselorName}</p>
              </div>
            </div>

            {/* Wellness + Risk */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border-2 p-4 text-center" style={{ borderColor: wellnessCfg?.color || "#6b7280" }}>
                <p className="text-xs text-slate-500 font-poppins uppercase tracking-wider mb-1">Wellness Score</p>
                <p className="text-4xl font-dm-serif" style={{ color: wellnessCfg?.color || "#6b7280" }}>
                  {data.wellnessScore !== null ? data.wellnessScore.toFixed(1) : "—"}
                </p>
                <p className="text-sm font-semibold font-poppins mt-1" style={{ color: wellnessCfg?.color || "#6b7280" }}>
                  {wellnessCfg?.emoji} {data.wellnessLevel || "—"}
                </p>
              </div>
              <div className="rounded-xl border-2 p-4 text-center" style={{ borderColor: riskCfg?.color || "#6b7280" }}>
                <p className="text-xs text-slate-500 font-poppins uppercase tracking-wider mb-1">Distress Risk</p>
                <p className="text-xl font-dm-serif font-bold mt-2" style={{ color: riskCfg?.color || "#6b7280" }}>
                  {data.distressRiskLevel || "—"}
                </p>
                <p className="text-xs text-slate-500 font-inter mt-1">{data.totalPoints} point{data.totalPoints !== 1 ? "s" : ""} total</p>
              </div>
            </div>

            {/* Sentiment Breakdown */}
            <div className="mb-6">
              <h3 className="text-sm font-poppins font-semibold text-dark-text uppercase tracking-wider mb-3">
                Sentiment Breakdown <span className="text-slate-500 font-normal normal-case">({data.totalEntries} entries)</span>
              </h3>
              {[
                { label: "😊 Positive", pct: data.positivePercent, color: "#22c55e" },
                { label: "😔 Negative", pct: data.negativePercent, color: "#f59e0b" },
                { label: "😰 Distress", pct: data.distressPercent, color: "#ef4444" },
              ].map(({ label, pct, color }) => (
                <div key={label} className="mb-3">
                  <div className="flex justify-between text-sm font-inter text-dark-text mb-1">
                    <span>{label}</span>
                    <span className="font-semibold" style={{ color }}>{pct}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Behavioral Indicators */}
            <div className="mb-6">
              <h3 className="text-sm font-poppins font-semibold text-dark-text uppercase tracking-wider mb-3">
                Behavioral Analytics Indicators
              </h3>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-2 px-3 font-poppins text-xs text-slate-600 border border-gray-200">Indicator</th>
                    <th className="py-2 px-3 font-poppins text-xs text-slate-600 border border-gray-200 text-center">Value</th>
                    <th className="text-left py-2 px-3 font-poppins text-xs text-slate-600 border border-gray-200">Range</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Behavioral Trend Score (BTS)", value: data.bts ?? "—", range: "−100 to +100" },
                    { label: "Journaling Frequency Score (JFS)", value: data.jfs !== null ? Math.round(data.jfs) : "—", range: "0 to 100" },
                    { label: "Mood Consistency Score (MCS)", value: data.mcs !== null ? Math.round(data.mcs) : "—", range: "0 to 100" },
                    { label: "Consecutive Negative Count (CNC)", value: data.cnc, range: "Non-negative integer" },
                  ].map(({ label, value, range }, i) => (
                    <tr key={label} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="py-2.5 px-3 font-inter text-dark-text border border-gray-200">{label}</td>
                      <td className="py-2.5 px-3 font-semibold text-primary-blue border border-gray-200 text-center">{String(value)}</td>
                      <td className="py-2.5 px-3 font-inter text-slate-500 text-xs border border-gray-200">{range}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Counselor Notes */}
            <div className="mb-6">
              <h3 className="text-sm font-poppins font-semibold text-dark-text uppercase tracking-wider mb-2">
                Counselor Remarks
              </h3>
              <textarea
                value={counselorNotes}
                onChange={(e) => setCounselorNotes(e.target.value)}
                placeholder="Add optional remarks or recommendations for this student..."
                rows={3}
                className="no-print w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-inter focus:outline-none focus:ring-2 focus:ring-primary-blue/30 resize-none"
              />
              {counselorNotes && (
                <div className="hidden print:block mt-2 bg-blue-50 border-l-4 border-primary-blue rounded-r-xl p-3">
                  <p className="text-sm font-inter text-dark-text">{counselorNotes}</p>
                </div>
              )}
            </div>

            {/* Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-inter text-amber-800 leading-relaxed">
                ⚠️ <strong>Important Notice:</strong> This report is generated by the Rise On AI system as a decision-support tool.
                It is not a clinical diagnosis or medical assessment. The Wellness Score and Distress Risk Level are
                algorithm-derived indicators intended to supplement — not replace — professional counseling evaluation.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="no-print sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex flex-wrap gap-3 justify-between items-center">
            <div className="flex-1">
              {error && <p className="text-xs text-red-600 font-inter">{error}</p>}
              {sent && !reportPassword && <p className="text-xs text-green-600 font-inter">✅ Report sent to {data.studentEmail}</p>}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={handlePrint} className="flex items-center gap-2">
                🖨️ Print
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={sending || sent || !data.studentEmail}
                className="flex items-center gap-2"
              >
                {sending ? "Sending..." : sent ? "✅ Sent" : "📧 Send to Email"}
              </Button>
            </div>
          </div>

          {/* Report Password Display — shown after sending */}
          {sent && reportPassword && (
            <div className="no-print bg-indigo-50 border-t-2 border-indigo-200 px-6 py-5">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔑</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold font-poppins text-indigo-900 mb-1">
                    Report Password — Give this to the student separately
                  </p>
                  <p className="text-xs text-indigo-700 font-inter mb-3">
                    The email was sent to <strong>{data.studentEmail}</strong> with the report link. 
                    The student needs this password to open the report. 
                    <strong> Do not include this in any email.</strong>
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="bg-white border-2 border-indigo-300 rounded-xl px-6 py-3 flex-1 text-center">
                      <p className="text-2xl font-mono font-bold tracking-[0.3em] text-indigo-900">
                        {reportPassword}
                      </p>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(reportPassword)}
                      className="px-3 py-3 bg-indigo-100 hover:bg-indigo-200 rounded-xl text-indigo-700 text-sm font-poppins transition-colors"
                      title="Copy password"
                    >
                      📋
                    </button>
                  </div>
                  <p className="text-xs text-indigo-600 font-inter mt-2">
                    This password is only shown once. Note it down or print this screen.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
