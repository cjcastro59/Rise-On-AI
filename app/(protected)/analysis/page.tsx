"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/layout/PageHeader";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { analyzeEntry, type AnalysisResult } from "@/lib/sentiment";
import { useAdaptiveResponse } from "@/hooks/useAdaptiveResponse";
import { ACI_CATEGORY_CONFIG } from "@/lib/adaptive-response";
import {
  CONFIDENCE_CONFIG,
  igWordColor,
  type ExplainabilityResult,
  type WordAttribution,
} from "@/lib/explainability";
import Link from "next/link";

type JournalEntry = {
  id: string;
  user_id: string;
  title: string | null;
  content: string | null;
  mood: string | null;
  emotions: string[] | null;
  created_at: string;
  updated_at: string;
};

// ── Suggestion icons cycle ────────────────────────────────────────────────────
const SUGGESTION_ICONS = ["🧘", "👥", "📖", "🌿", "💬", "🌟"];

// ── Agreement badge colours ───────────────────────────────────────────────────
const AGREEMENT_CONFIG = {
  agree:                { bg: "#B7E4C7", color: "#2D6A4F", emoji: "✅", label: "Models agree" },
  disagree:             { bg: "#FFE8A1", color: "#7B5E2A", emoji: "⚠️", label: "Models differ" },
  keyword_unavailable:  { bg: "#E5E7EB", color: "#6B7280", emoji: "–",  label: "Cross-check unavailable" },
} as const;

// ── IG word token chip ────────────────────────────────────────────────────────
function IGWordChip({ attr }: { attr: WordAttribution }) {
  const { bg, text } = igWordColor(attr);
  const opacity = Math.max(0.25, attr.normalised);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-inter font-medium border border-white/20"
      style={{
        backgroundColor: bg,
        color: text,
        opacity,
      }}
      title={`Score: ${attr.score > 0 ? "+" : ""}${attr.score.toFixed(4)} · ${attr.direction}`}
    >
      {attr.word}
      {attr.normalised >= 0.5 && (
        <span className="text-[9px] opacity-70 ml-0.5">
          {attr.direction === "positive" ? "↑" : attr.direction === "negative" ? "↓" : ""}
        </span>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AIAnalysisPage() {
  const [entry,    setEntry]    = useState<JournalEntry | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading,  setLoading]  = useState(true);

  // ── Phase 6: Explainability state ──────────────────────────────────────────
  const [explainResult,   setExplainResult]   = useState<ExplainabilityResult | null>(null);
  const [explainLoading,  setExplainLoading]  = useState(false);
  const [explainError,    setExplainError]    = useState<string | null>(null);
  const [explainRequested, setExplainRequested] = useState(false);

  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entryId = searchParams?.get("entryId");
  const supabase = useMemo(() => createClient(), []);

  // ACI hook — fetches stored response for this entry
  const {
    response: aciResponse,
    loading: aciLoading,
    isRegenerating: aciRegenerating,
    hasResponse: aciHasResponse,
    regenerate: aciRegenerate,
  } = useAdaptiveResponse(entryId);

  const fetchEntry = useCallback(async () => {
    if (!user || !entryId) { setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("id", entryId)
        .single();

      if (error) {
        console.error("Error fetching entry:", error);
        router.push("/journal/history");
        return;
      }
      if (data) {
        setEntry(data);
        setAnalysis(analyzeEntry(data.content, data.mood));
      }
    } catch (error) {
      console.error("Error fetching entry:", error);
    } finally {
      setLoading(false);
    }
  }, [user, entryId, router, supabase]);

  useEffect(() => {
    if (user) fetchEntry();
  }, [fetchEntry, user]);

  // ── Phase 6: Request explanation ───────────────────────────────────────────
  // Never called automatically. Only triggered by the user clicking the button.
  const requestExplanation = useCallback(async () => {
    if (!entryId || !user) return;
    setExplainLoading(true);
    setExplainError(null);
    setExplainRequested(true);

    try {
      const res = await fetch("/api/sentiment/explain", {
        method:      "POST",
        credentials: "same-origin",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ entryId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const data = await res.json() as {
        ok: boolean;
        explainability: ExplainabilityResult;
        igAvailable: boolean;
      };

      if (data.ok && data.explainability) {
        setExplainResult(data.explainability);
      } else {
        throw new Error("Unexpected response from explain endpoint");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setExplainError(msg);
      console.error("[analysis/explain]", msg);
    } finally {
      setExplainLoading(false);
    }
  }, [entryId, user]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

  const getSentimentLabel = (s: string) =>
    s === "positive" ? "Mostly Positive" : s === "negative" ? "Mostly Negative" : "Distress Detected";

  const getSentimentEmoji = (s: string) =>
    s === "positive" ? "😊" : s === "negative" ? "😔" : "⚠️";

  const getSentimentColor = (s: string) =>
    s === "positive" ? "from-success-green to-primary-blue"
    : s === "negative" ? "from-warning-yellow to-error-red"
    : "from-orange-400 to-red-400";

  const getEmotionColor = (e: string) =>
    e === "Joy" || e === "Hope" ? "bg-success-green/40 border-success-green/30"
    : e === "Calm" ? "bg-[#A8DADC]/40 border-[#A8DADC]/30"
    : e === "Anxiety" || e === "Sadness" || e === "Stress" ? "bg-error-red/35 border-error-red/30"
    : "bg-lavender/40 border-lavender/30";

  const getEmotionEmoji = (e: string) =>
    e === "Joy" ? "😊" : e === "Hope" ? "✨" : e === "Calm" ? "😌"
    : e === "Anxiety" ? "😰" : e === "Sadness" ? "😢" : e === "Stress" ? "😵" : "😐";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-dark-text/70">Loading analysis...</p>
      </div>
    );
  }

  if (!entry || !analysis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-dark-text/70">No entry found. Please select an entry from your journal history.</p>
        <Link href="/journal/history">
          <Button>Go to Journal History</Button>
        </Link>
      </div>
    );
  }

  const sentimentLabel  = getSentimentLabel(analysis.sentiment);
  const sentimentEmoji  = getSentimentEmoji(analysis.sentiment);
  const sentimentColor  = getSentimentColor(analysis.sentiment);
  const wellnessScore   = Math.round(analysis.sentimentScore / 10);

  // ACI card config
  const aciCfg = aciResponse
    ? ACI_CATEGORY_CONFIG[aciResponse.response_category]
    : ACI_CATEGORY_CONFIG["positive"];

  // Explainability derived values
  const confCfg  = explainResult
    ? CONFIDENCE_CONFIG[explainResult.confidence.level]
    : null;
  const agrCfg   = explainResult
    ? AGREEMENT_CONFIG[explainResult.keywordAgreement.agreement]
    : null;
  const igReady  = explainResult?.integratedGradients?.available === true;
  const igTopWords = explainResult?.integratedGradients?.topInfluential ?? [];

  return (
    <>
      {/* Page Header */}
      <PageHeader
        title="Emotional Analysis Complete"
        subtitle={`Analysis for • ${formatDate(entry.created_at)}`}
        actions={
          <div className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${sentimentColor} rounded-full shadow-sm`}>
            <span className="text-sm font-poppins text-dark-text">
              {sentimentEmoji} {sentimentLabel} — {analysis.sentimentScore}%
            </span>
          </div>
        }
      />

      {/* Progress Steps */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex items-center gap-2 px-3 py-1 bg-[#A8DADC]/40 rounded-full">
          <span className="text-sm">📝</span>
          <span className="text-sm font-poppins text-dark-text">Wrote Entry</span>
        </div>
        <div className="text-sm text-dark-text/40">→</div>
        <div className="flex items-center gap-2 px-3 py-1 bg-[#A8DADC]/40 rounded-full">
          <span className="text-sm">🧠</span>
          <span className="text-sm font-poppins text-dark-text">AI Analyzed</span>
        </div>
        <div className="text-sm text-dark-text/50">→</div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-primary-blue to-lavender rounded-full shadow-sm">
          <span className="text-sm">✨</span>
          <span className="text-sm font-poppins text-white">Insights Ready</span>
        </div>
        <div className="text-sm text-dark-text/50">→</div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#E5E7EB] rounded-full">
          <span className="text-sm">📊</span>
          <span className="text-sm font-poppins text-dark-text">Track Over Time</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Sentiment Breakdown */}
          <Card className="p-6 bg-white shadow-sm">
            <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-4 flex items-center gap-2">
              <span>📊</span>
              Sentiment Breakdown
            </h3>
            <div className="space-y-5">
              {[
                { label: "Positive", pct: analysis.positivePercentage, color: "bg-gradient-to-r from-primary-blue to-success-green" },
                { label: "Negative", pct: analysis.negativePercentage, color: "bg-error-red" },
                { label: "Distress", pct: analysis.distressPercentage, color: "bg-gradient-to-r from-orange-400 to-red-400" },
              ].map(({ label, pct, color }) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-sm font-inter text-dark-text">
                    <span>{label}</span>
                    <span className="font-semibold">{pct}%</span>
                  </div>
                  <div className="h-3 bg-light-gray rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Detected Emotions */}
          <Card className="p-6 bg-white shadow-sm">
            <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-4 flex items-center gap-2">
              <span>🌈</span>
              Detected Emotions
            </h3>
            <div className="flex flex-wrap gap-3">
              {analysis.emotions.map((emotion, i) => (
                <div key={i} className={`px-3 py-2 ${getEmotionColor(emotion)} rounded-full text-sm font-poppins text-dark-text flex items-center gap-2 border`}>
                  <span className="text-base">{getEmotionEmoji(emotion)}</span>
                  <span>{emotion} — {Math.round(analysis.sentimentScore / 2)}%</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Key Phrases */}
          {analysis.keyPhrases.length > 0 && (
            <Card className="p-6 bg-white shadow-sm">
              <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-4 flex items-center gap-2">
                <span>🔑</span>
                Key Phrases Detected
              </h3>
              <div className="flex flex-wrap gap-3">
                {analysis.keyPhrases.map((phrase, i) => (
                  <span key={i} className="px-4 py-2 bg-[#EAF7F8] rounded-full text-sm font-inter text-dark-text border border-primary-blue/20">
                    {phrase}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* ── ACI CARD ──────────────────────────────────────────────── */}
          <div
            className="border-l-4 rounded-2xl"
            style={{ borderLeftColor: aciCfg.borderColor }}
          >
          <Card className="p-6 bg-white shadow-sm rounded-l-none border-l-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 flex items-center gap-2">
                <span>{aciCfg.emoji}</span>
                {aciCfg.label}
              </h3>
              {!aciLoading && (
                <button
                  onClick={() => aciRegenerate()}
                  disabled={aciRegenerating}
                  className="text-[10px] font-poppins text-[#4EAAB3] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aciRegenerating ? "Generating…" : "↻ Refresh"}
                </button>
              )}
            </div>
            <p className="text-[11px] text-dark-text/50 font-inter mb-4">
              Context-aware supportive response · based on your sentiment, wellness, and behavioral patterns
            </p>

            {aciLoading ? (
              <p className="text-xs text-dark-text/50 py-4 text-center">Generating your personalised response…</p>
            ) : !aciHasResponse || !aciResponse ? (
              <div className="space-y-3">
                <p className="text-xs text-dark-text/50 py-2">
                  Your adaptive response is being prepared. It will appear here shortly after analysis completes.
                </p>
                <button
                  onClick={() => aciRegenerate()}
                  disabled={aciRegenerating}
                  className="text-xs px-3 py-1.5 rounded-full border border-[#A8DADC] text-[#4EAAB3] font-poppins hover:bg-[#A8DADC]/10 disabled:opacity-50"
                >
                  {aciRegenerating ? "Generating…" : "Generate Now"}
                </button>
                <div className="mt-3 pt-3 border-t border-[#F5F5F5]">
                  <p className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/40 mb-2">
                    Entry-level feedback (keyword analysis)
                  </p>
                  <p className="text-sm font-inter text-dark-text/70 leading-relaxed">{analysis.feedback}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {aciResponse.crisis_note && (
                  <div className="p-3 rounded-xl text-xs font-inter leading-relaxed border"
                    style={{ backgroundColor: aciCfg.bgColor + "50", borderColor: aciCfg.borderColor, color: aciCfg.color }}>
                    {aciResponse.crisis_note}
                  </div>
                )}
                <p className="text-sm font-poppins font-semibold" style={{ color: aciCfg.color }}>
                  {aciResponse.greeting}
                </p>
                <p className="text-sm font-inter text-dark-text leading-relaxed">
                  {aciResponse.message}
                </p>
                <div className="p-3 rounded-xl border-l-2"
                  style={{ backgroundColor: aciCfg.bgColor + "40", borderLeftColor: aciCfg.borderColor }}>
                  <p className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/50 mb-1">Reflection Prompt</p>
                  <p className="text-sm font-inter text-dark-text/80 leading-relaxed italic">{aciResponse.reflection}</p>
                </div>
                {aciResponse.suggestions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/50 mb-2">Suggestions</p>
                    <div className="space-y-2">
                      {aciResponse.suggestions.map((s, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-light-gray rounded-xl">
                          <span className="text-base shrink-0">{SUGGESTION_ICONS[i % SUGGESTION_ICONS.length]}</span>
                          <span className="text-sm font-inter text-dark-text">{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[9px] text-dark-text/30 font-inter leading-relaxed pt-2 border-t border-[#F5F5F5]">
                  {aciResponse.disclaimer}
                </p>
              </div>
            )}
          </Card>
          </div>

          {/* ── EXPLAINABILITY PANEL ─────────────────────────────────── */}
          <Card className="p-6 bg-white shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 flex items-center gap-2">
                <span>🔍</span>
                AI Prediction Explainability
              </h3>
              {explainResult && (
                <button
                  onClick={requestExplanation}
                  disabled={explainLoading}
                  className="text-[10px] font-poppins text-[#4EAAB3] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {explainLoading ? "Analysing…" : "↻ Refresh"}
                </button>
              )}
            </div>
            <p className="text-[11px] text-dark-text/40 font-inter mb-5">
              Understanding the AI prediction · not a clinical interpretation
            </p>

            {/* ── Section 1: Confidence + probability bars ──────────── */}
            <div className="mb-5">
              <p className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/50 mb-2">
                Prediction Confidence
              </p>

              {explainResult && confCfg ? (
                <div className="space-y-3">
                  {/* Confidence badge */}
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-poppins font-semibold"
                    style={{ backgroundColor: confCfg.bgColor, color: confCfg.color }}
                  >
                    <span>{explainResult.confidence.level === "high" ? "●" : explainResult.confidence.level === "medium" ? "◐" : explainResult.confidence.level === "low" ? "○" : "?"}</span>
                    {confCfg.label}
                    <span className="font-normal opacity-70">
                      — gap {(explainResult.confidence.probabilityGap * 100).toFixed(0)}pp
                    </span>
                  </div>

                  {/* Explanation text */}
                  <p className="text-[11px] text-dark-text/60 font-inter leading-relaxed">
                    {confCfg.explanation}
                  </p>

                  {/* Probability breakdown bars */}
                  <div className="space-y-1.5 pt-1">
                    {[
                      { label: "Positive", prob: explainResult.inputProbabilities.positive, color: "#A8DADC" },
                      { label: "Negative", prob: explainResult.inputProbabilities.negative, color: "#FFE8A1" },
                      { label: "Distress", prob: explainResult.inputProbabilities.distress, color: "#F4A6A6" },
                    ].map(({ label, prob, color }) => (
                      <div key={label}>
                        <div className="flex justify-between text-[10px] font-inter text-dark-text/60 mb-0.5">
                          <span className={explainResult.predictedSentiment === label.toLowerCase() ? "font-semibold text-dark-text" : ""}>{label}</span>
                          <span>{(prob * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${prob * 100}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Not yet fetched — show static bars from keyword analysis */
                <div className="space-y-1.5">
                  {[
                    { label: "Positive", pct: analysis.positivePercentage, color: "#A8DADC" },
                    { label: "Negative", pct: analysis.negativePercentage, color: "#FFE8A1" },
                    { label: "Distress", pct: analysis.distressPercentage, color: "#F4A6A6" },
                  ].map(({ label, pct, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-[10px] font-inter text-dark-text/60 mb-0.5">
                        <span>{label}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  ))}
                  <p className="text-[9px] text-dark-text/35 font-inter mt-1">
                    Showing keyword-analysis probabilities · click &ldquo;Get AI Explanation&rdquo; for AI model probabilities
                  </p>
                </div>
              )}
            </div>

            {/* ── Section 2: Keyword agreement signal ──────────────── */}
            {explainResult && agrCfg && (
              <div className="mb-5 pt-4 border-t border-[#F5F5F5]">
                <p className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/50 mb-2">
                  Cross-Model Validation
                </p>
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-poppins font-medium mb-2"
                  style={{ backgroundColor: agrCfg.bg, color: agrCfg.color }}
                >
                  <span>{agrCfg.emoji}</span>
                  {agrCfg.label}
                </div>
                <p className="text-[11px] text-dark-text/60 font-inter leading-relaxed mb-2">
                  {explainResult.keywordAgreement.explanation}
                </p>
                <p className="text-[9px] text-dark-text/30 font-inter leading-relaxed">
                  {explainResult.keywordAgreement.disclaimer}
                </p>
              </div>
            )}

            {/* ── Section 3: Integrated Gradients ──────────────────── */}
            <div className="pt-4 border-t border-[#F5F5F5]">
              <p className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/50 mb-2">
                Word-Level Attribution
                <span className="ml-1.5 normal-case tracking-normal text-dark-text/30 font-inter font-normal">
                  (Integrated Gradients · on-demand only)
                </span>
              </p>

              {!explainRequested ? (
                /* Not yet requested */
                <div className="space-y-3">
                  <p className="text-[11px] text-dark-text/50 font-inter leading-relaxed">
                    Word-level attribution uses Integrated Gradients to estimate which
                    words most influenced the AI prediction. This requires additional
                    computation and is not run automatically.
                  </p>
                  <p className="text-[10px] text-dark-text/35 font-inter">
                    Note: Word scores are approximations — XLM-RoBERTa splits words into
                    subword tokens. Scores are summed to word level. Results reflect this
                    specific prediction only, not general word sentiment.
                  </p>
                  <button
                    onClick={requestExplanation}
                    disabled={explainLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-[#A8DADC]/15 hover:bg-[#A8DADC]/30 border border-[#A8DADC]/40 text-[#4EAAB3] text-xs font-poppins font-medium rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {explainLoading ? (
                      <>
                        <span className="animate-spin text-base">⟳</span>
                        Analysing… (may take 10–30s on CPU)
                      </>
                    ) : (
                      <>
                        <span>🔍</span>
                        Get AI Explanation
                      </>
                    )}
                  </button>
                </div>

              ) : explainLoading ? (
                <div className="py-3 text-center">
                  <p className="text-xs text-dark-text/50 font-poppins animate-pulse">
                    Running Integrated Gradients analysis… this may take 10–30 seconds on CPU.
                  </p>
                </div>

              ) : explainError ? (
                <div className="space-y-2">
                  <p className="text-xs text-dark-text/50 font-inter leading-relaxed">
                    Explanation could not be generated:
                  </p>
                  <p className="text-[11px] text-[#9B3A1E] font-inter bg-[#F4A6A6]/20 px-3 py-2 rounded-lg">
                    {explainError}
                  </p>
                  <p className="text-[9px] text-dark-text/35 font-inter">
                    The confidence and keyword agreement above are still valid and do not
                    depend on the Integrated Gradients server.
                  </p>
                  <button
                    onClick={requestExplanation}
                    className="text-[10px] font-poppins text-[#4EAAB3] hover:underline"
                  >
                    Try again →
                  </button>
                </div>

              ) : igReady && igTopWords.length > 0 ? (
                /* IG results available */
                <div className="space-y-3">
                  <p className="text-[11px] text-dark-text/60 font-inter">
                    Words shown below most influenced the model&apos;s{" "}
                    <strong>{explainResult?.predictedSentiment}</strong> prediction.
                    Highlighted in{" "}
                    <span style={{ color: "#1D6FA4" }}>blue</span> (pushed toward predicted class) or{" "}
                    <span style={{ color: "#9B3A1E" }}>red</span> (pushed against).
                    Opacity reflects relative strength.
                  </p>

                  <div className="flex flex-wrap gap-1.5 p-3 bg-[#F9FAFB] rounded-xl">
                    {igTopWords.map((attr, i) => (
                      <IGWordChip key={`${attr.word}-${i}`} attr={attr} />
                    ))}
                  </div>

                  <p className="text-[9px] text-dark-text/30 font-inter leading-relaxed">
                    {explainResult?.integratedGradients?.disclaimer}
                  </p>
                </div>

              ) : explainResult && !igReady ? (
                /* Confidence + agreement loaded but IG server is disabled */
                <div className="space-y-2">
                  <p className="text-[11px] text-dark-text/50 font-inter leading-relaxed">
                    Confidence and keyword agreement signals are loaded above.
                  </p>
                  <p className="text-[11px] text-[#7B5E2A] font-inter bg-[#FFE8A1]/30 px-3 py-2 rounded-lg">
                    {explainResult.integratedGradients?.error}
                  </p>
                  <p className="text-[9px] text-dark-text/35 font-inter">
                    To enable Integrated Gradients, start the sentiment server with{" "}
                    <code className="bg-light-gray px-1 py-0.5 rounded text-[9px]">USE_EXPLAIN=1</code>{" "}
                    and install <code className="bg-light-gray px-1 py-0.5 rounded text-[9px]">captum≥0.7.0</code>.
                  </p>
                </div>
              ) : null}
            </div>
          </Card>
          {/* ── END EXPLAINABILITY PANEL ──────────────────────────────── */}

          {/* Emotional Wellness Score */}
          <Card className="p-8 text-center bg-white shadow-sm">
            <h3 className="text-base font-poppins uppercase tracking-wider text-dark-text/70 mb-8 flex items-center gap-2 justify-center">
              <span>🧠</span>
              Emotional Wellness Score
            </h3>
            <div className="relative w-52 h-52 mx-auto mb-8">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#E5E7EB" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="45"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="12"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (analysis.sentimentScore / 100) * 283}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#A8DADC" />
                    <stop offset="100%" stopColor="#CDB4DB" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-5xl font-dm-serif text-[#4F4F4F]">{wellnessScore}.0</span>
                <span className="text-base font-inter text-[#A8DADC]">out of 10</span>
              </div>
            </div>
            <p className="text-base font-inter text-[#4F4F4F]/70">Emotional Wellness Score</p>
          </Card>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="mt-8 flex flex-col items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-3xl">
          <Button
            className="flex-1 max-w-xs py-4 rounded-full bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] text-[#4F4F4F] font-poppins font-medium text-base transition-opacity hover:opacity-90"
            onClick={() => router.push("/insights")}
          >
            View Mood Trends →
          </Button>
          <Button
            variant="secondary"
            className="flex-1 max-w-xs py-4 rounded-full border border-[#A8DADC] text-[#4F4F4F] font-poppins font-medium text-base bg-white transition-colors hover:bg-[#F5F5F5]"
            onClick={() => router.push("/journal/history")}
          >
            Save & Return
          </Button>
        </div>
        <button
          className="text-[#F4A6A6] font-inter text-sm mt-2 flex items-center gap-2 hover:underline"
          onClick={() => router.push("/support")}
        >
          Feeling distressed?{" "}
          <span className="font-semibold">Get immediate support</span>
        </button>
      </div>
    </>
  );
}
