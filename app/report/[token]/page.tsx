"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WELLNESS_LEVEL_CONFIG, type WellnessLevel } from "@/lib/wellness-assessment";
import { DISTRESS_RISK_CONFIG, type DistressRiskLevel } from "@/lib/distress-risk";

type ReportData = {
  studentName: string;
  studentEmail: string;
  reportDate: string;
  counselorName: string;
  wellnessScore: string | null;
  wellnessLevel: string | null;
  distressRiskLevel: string | null;
  totalPoints: number;
  positivePercent: number;
  negativePercent: number;
  distressPercent: number;
  totalEntries: number;
  bts: number | null;
  jfs: number | null;
  mcs: number | null;
  cnc: number;
};

type ReportRecord = {
  id: string;
  token: string;
  student_user_id: string;
  report_data: ReportData;
  counselor_notes: string | null;
  expires_at: string;
  accessed_at: string | null;
};

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;
  const supabase = createClient();

  const [step, setStep] = useState<"loading" | "password" | "unlocked" | "expired" | "notfound" | "error">("loading");
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      if (!token) { setStep("notfound"); return; }

      const { data, error } = await supabase
        .from("student_reports")
        .select("*")
        .eq("token", token)
        .single();

      if (error || !data) { setStep("notfound"); return; }

      const now = new Date();
      const expiry = new Date(data.expires_at);
      if (now > expiry) { setStep("expired"); return; }

      setReport(data as ReportRecord);
      setStep("password");
    };

    fetchReport();
  }, [token, supabase]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report || !password.trim()) return;

    setVerifying(true);
    setAuthError(null);

    try {
      // Verify by signing in — if it succeeds and the user matches the student_user_id, unlock
      const { data: { user }, error: signInError } = await supabase.auth.getUser();

      if (signInError || !user) {
        // Not logged in — try signing in with the student's email + entered password
        const reportData = report.report_data;
        const { data: signInData, error: loginError } = await supabase.auth.signInWithPassword({
          email: reportData.studentEmail,
          password: password.trim(),
        });

        if (loginError || !signInData.user) {
          setAuthError("Incorrect password. Please enter your Rise On AI login password.");
          setVerifying(false);
          return;
        }

        // Verify the logged-in user matches the report's student
        if (signInData.user.id !== report.student_user_id) {
          await supabase.auth.signOut();
          setAuthError("This report does not belong to your account.");
          setVerifying(false);
          return;
        }
      } else {
        // Already logged in — verify it's the right student
        if (user.id !== report.student_user_id) {
          setAuthError("This report belongs to a different account. Please log in as the correct student.");
          setVerifying(false);
          return;
        }

        // Verify password by trying to re-authenticate
        const reportData = report.report_data;
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: reportData.studentEmail,
          password: password.trim(),
        });

        if (verifyError) {
          setAuthError("Incorrect password.");
          setVerifying(false);
          return;
        }
      }

      // Mark as accessed
      await supabase
        .from("student_reports")
        .update({ accessed_at: new Date().toISOString() })
        .eq("token", token);

      setStep("unlocked");
    } catch {
      setAuthError("An error occurred. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#A8DADC]/20 to-[#CDB4DB]/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue mx-auto mb-4" />
          <p className="text-slate-600 font-poppins">Loading report...</p>
        </div>
      </div>
    );
  }

  if (step === "notfound") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4">🔍</p>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-2">Report Not Found</h1>
          <p className="text-slate-600 font-inter text-sm">This report link is invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  if (step === "expired") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4">⏰</p>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-2">Report Link Expired</h1>
          <p className="text-slate-600 font-inter text-sm">This report link has expired. Please ask your counselor to send a new report.</p>
        </div>
      </div>
    );
  }

  if (step === "password") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#A8DADC]/20 to-[#CDB4DB]/20 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🔒</div>
            <h1 className="text-2xl font-dm-serif text-dark-text mb-2">Confidential Report</h1>
            <p className="text-sm text-slate-600 font-inter">
              Enter your <strong>Rise On AI password</strong> to access your wellness progress report prepared by your counselor.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="text-xs font-poppins text-slate-600 mb-1 block">Your Rise On AI Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoFocus
              />
            </div>

            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs text-red-700 font-inter">{authError}</p>
              </div>
            )}

            <Button type="submit" disabled={verifying} className="w-full">
              {verifying ? "Verifying..." : "Unlock Report →"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-slate-500 font-inter">
              This report expires on {report?.expires_at
                ? new Date(report.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                : "—"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Unlocked — show the full report
  const rd = report?.report_data;
  if (!rd) return null;

  const wellnessCfg = rd.wellnessLevel
    ? WELLNESS_LEVEL_CONFIG[rd.wellnessLevel as WellnessLevel]
    : null;
  const riskCfg = rd.distressRiskLevel
    ? DISTRESS_RISK_CONFIG[rd.distressRiskLevel as DistressRiskLevel]
    : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Print button */}
        <div className="flex justify-end mb-4 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-poppins text-dark-text hover:bg-gray-50"
          >
            🖨️ Print Report
          </button>
        </div>

        {/* Report */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] p-8 text-center">
            <h1 className="text-2xl font-dm-serif text-dark-text mb-1">Rise On AI</h1>
            <p className="text-sm text-slate-700 font-poppins">Student Wellness Progress Report</p>
          </div>

          <div className="p-8 space-y-6">
            {/* Student Info */}
            <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
              {[
                ["Student Name", rd.studentName],
                ["Email", rd.studentEmail],
                ["Report Generated", rd.reportDate],
                ["Prepared by", rd.counselorName],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-500 font-poppins uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-poppins text-dark-text mt-1">{value}</p>
                </div>
              ))}
            </div>

            {/* Wellness + Risk */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border-2 p-4 text-center" style={{ borderColor: wellnessCfg?.color || "#6b7280" }}>
                <p className="text-xs text-slate-500 font-poppins uppercase tracking-wider mb-1">Wellness Score</p>
                <p className="text-4xl font-dm-serif" style={{ color: wellnessCfg?.color || "#6b7280" }}>
                  {rd.wellnessScore ?? "—"}
                </p>
                <p className="text-sm font-semibold font-poppins mt-1" style={{ color: wellnessCfg?.color || "#6b7280" }}>
                  {wellnessCfg?.emoji} {rd.wellnessLevel || "—"}
                </p>
              </div>
              <div className="rounded-xl border-2 p-4 text-center" style={{ borderColor: riskCfg?.color || "#6b7280" }}>
                <p className="text-xs text-slate-500 font-poppins uppercase tracking-wider mb-1">Distress Risk</p>
                <p className="text-xl font-dm-serif font-bold mt-2" style={{ color: riskCfg?.color || "#6b7280" }}>
                  {rd.distressRiskLevel || "—"}
                </p>
                <p className="text-xs text-slate-500 font-inter mt-1">{rd.totalPoints} point{rd.totalPoints !== 1 ? "s" : ""} total</p>
              </div>
            </div>

            {/* Sentiment Breakdown */}
            <div>
              <h3 className="text-sm font-poppins font-semibold text-dark-text uppercase tracking-wider mb-3">
                Sentiment Breakdown <span className="text-slate-500 font-normal normal-case">({rd.totalEntries} entries)</span>
              </h3>
              {[
                { label: "😊 Positive", pct: rd.positivePercent, color: "#22c55e" },
                { label: "😔 Negative", pct: rd.negativePercent, color: "#f59e0b" },
                { label: "😰 Distress", pct: rd.distressPercent, color: "#ef4444" },
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
            <div>
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
                    { label: "Behavioral Trend Score (BTS)", value: rd.bts ?? "—", range: "−100 to +100" },
                    { label: "Journaling Frequency Score (JFS)", value: rd.jfs !== null ? Math.round(rd.jfs) : "—", range: "0 to 100" },
                    { label: "Mood Consistency Score (MCS)", value: rd.mcs !== null ? Math.round(rd.mcs) : "—", range: "0 to 100" },
                    { label: "Consecutive Negative Count (CNC)", value: rd.cnc, range: "Non-negative integer" },
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
            {report?.counselor_notes && (
              <div>
                <h3 className="text-sm font-poppins font-semibold text-dark-text uppercase tracking-wider mb-2">Counselor Remarks</h3>
                <div className="bg-blue-50 border-l-4 border-primary-blue rounded-r-xl p-4">
                  <p className="text-sm font-inter text-dark-text leading-relaxed">{report.counselor_notes}</p>
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-inter text-amber-800 leading-relaxed">
                ⚠️ <strong>Important Notice:</strong> This report is generated by the Rise On AI system as a decision-support tool.
                It is not a clinical diagnosis or medical assessment. The Wellness Score and Distress Risk Level are
                algorithm-derived indicators intended to supplement — not replace — professional counseling evaluation.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6 font-inter">
          Rise On AI — Pamantasan ng Lungsod ng Pasig · College of Arts and Sciences
        </p>
      </div>
    </div>
  );
}
