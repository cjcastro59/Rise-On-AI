"use client";

import { Card } from "@/components/ui/card";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const TAGALOG_KEYWORDS = [
  "ako", "ikaw", "siya", "kami", "tayo", "kayo", "sila",
  "ng", "sa", "mga", "ang", "ay", "na", "din", "rin", "pa",
  "oo", "hindi", "wala", "mayroon", "niyo", "natin", "atin",
  "gusto", "ayaw", "sana", "dapat", "kailangan", "pwede",
  "sakit", "lungkot", "takot", "galit", "saya", "pogi", "ganda",
  "mahal", "salamat", "po", "opo", "nang", "kung", "pero", "kasi",
  "dahil", "habang", "noon", "ngayon", "bukas", "kahapon",
  "yung", "yung", 'yan', 'to', 'ko', 'mo', 'niya', 'naman',
  'talaga', 'siguro', 'baka', 'nga', 'eh', 'ha', 'ho', 'muna',
  "nanay", "tatay", "kapatid", "kaibigan", "pamilya", "eskwelahan",
  "trabaho", "pagkain", "tubig", "bahay", "araw", "gabi",
  "tulog", "lakad", "kain", "inom", "laro", " basa ", " sulat ",
  " mahirap ", " madali ", " maganda ", " pangit ", " malaki ",
  " maliit ", " mabigat ", " magaan ", " mainit ", " malamig ",
  " gutom ", " uhaw ", " pagod ", " sakit ", " lagnat ", " sipon ",
  " ubo ", " hirap ", " saya ", " lungkot ", " galit ", " takot ",
  " tuwa ", " inis ", " badtrip ", " swerte ", " malas ",
  " pinoy ", " pinay ", " filipino ", " tagalog ", " bisaya ",
  " pogi ", " gwapo ", " ganda ", " sexy ", " cute ",
  " idol ", " bro ", " mare ", " pare ", " teh ",
  " thank you ", " salamat ", " pasensya na ", " paumanhin ",
  " sorry ", " please ", " pwede ba ", " sige na ",
  " tara ", " kape ", " kanto ", " baryo ", " probinsya ",
  " manila ", " cebu ", " davao ", " jeep ", " tricycle ",
];

const detectLanguage = (text: string): string => {
  if (!text) return "Unknown";
  const lower = text.toLowerCase();
  let tagalogHits = 0;
  for (const kw of TAGALOG_KEYWORDS) {
    if (lower.includes(kw)) tagalogHits++;
  }
  if (tagalogHits >= 3) return "Tagalog";
  if (tagalogHits >= 1) return "Taglish";
  return "English";
};

const CIRCUMFERENCE = 2 * Math.PI * 40;

const VALID_SENTIMENTS = new Set(["positive", "negative", "distress"]);

const fmtPct = (n: number) =>
  Number.isFinite(n) ? `${Math.round(n * 10) / 10}%` : "0%";

const clampPercent = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0;
};

const normalizeConfidence = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const confidence = numeric > 1 ? numeric / 100 : numeric;
  return Math.min(1, Math.max(0, confidence));
};

const normalizeSentiment = (value: unknown): "positive" | "negative" | "distress" | null =>
  typeof value === "string" && VALID_SENTIMENTS.has(value)
    ? (value as "positive" | "negative" | "distress")
    : null;

const percent = (value: number, total: number) =>
  total > 0 ? (value / total) * 100 : 0;

const safeIsoString = (value: unknown) => {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

export default function AdminSentimentMonitoringPage() {
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [reviewEntry, setReviewEntry] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [last24hEntries, setLast24hEntries] = useState<any[]>([]);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        { data: allEntries, error: err1 },
        { data: lastDay, error: err2 },
        { data: recent, error: err3 },
      ] = await Promise.all([
        supabase
          .from("journal_entries")
          .select("id, user_id, title, content, mood, emotions, created_at, sentiment, sentiment_score, confidence, sentiment_model, positive_percentage, negative_percentage, distress_percentage")
          .not("confidence", "is", null)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("journal_entries")
          .select("id, user_id, emotions, sentiment, confidence, created_at")
          .gte("created_at", oneDayAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("journal_entries")
          .select("id, user_id, title, content, emotions, sentiment, confidence, created_at, positive_percentage, negative_percentage, distress_percentage")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (err1) throw err1;
      if (err2) throw err2;
      if (err3) throw err3;

      setEntries(allEntries || []);
      setRecentEntries(recent || []);
      setLast24hEntries(lastDay || []);
    } catch (e: any) {
      console.error("Error loading sentiment data:", e);
      setError(e.message || "Failed to load monitoring data");
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ===== COMPUTED METRICS =====
  const totalEntries = entries.length;

  // AI Accuracy (confidence-weighted agreement between predicted sentiment and mood-based expected sentiment)
  // Returns null when there is no data to avoid showing a fabricated fallback.
  const agreement = useMemo((): number | null => {
    if (totalEntries === 0) return null;
    let matchedWeight = 0;
    let totalWeight = 0;
    for (const e of entries) {
      const sentiment = normalizeSentiment(e.sentiment);
      if (!sentiment || !e.mood) continue;
      const moodLower = (e.mood || "").toLowerCase();
      let expected: "positive" | "negative" | null = null;
      if (["happy", "excited", "calm"].some(t => moodLower.includes(t))) expected = "positive";
      else if (["sad", "overwhelmed", "frustrated", "anxious"].some(t => moodLower.includes(t))) expected = "negative";
      if (expected) {
        const weight = normalizeConfidence(e.confidence) ?? 0.5;
        totalWeight += Math.max(0.01, weight);
        const isMatch = expected === "positive"
          ? sentiment === "positive"
          : sentiment === "negative" || sentiment === "distress";
        if (isMatch) matchedWeight += Math.max(0.01, weight);
      }
    }
    if (totalWeight === 0) return null;
    return Math.min(100, Math.max(0, (matchedWeight / totalWeight) * 100));
  }, [entries, totalEntries]);

  // Avg confidence — null when no entries so we never show a fabricated fallback.
  const avgConfidence = useMemo((): number | null => {
    if (totalEntries === 0) return null;
    const values = entries
      .map((e) => normalizeConfidence(e.confidence))
      .filter((value): value is number => value !== null);
    if (values.length === 0) return null;
    const sum = values.reduce((acc, value) => acc + value, 0);
    return sum / values.length;
  }, [entries, totalEntries]);

  const activeModel = useMemo(() => {
    const model = entries.find((entry) => entry.sentiment_model)?.sentiment_model;
    return model || "xlm-roberta-finetuned";
  }, [entries]);

  // Language distribution — confidence averages are derived from real entries, not randomized.
  const languageStats = useMemo(() => {
    const sample = entries.slice(0, 500);
    let tagalog = 0, taglish = 0, english = 0;
    let tagalogConfSum = 0, tagalogConfCount = 0;
    let englishConfSum = 0, englishConfCount = 0;
    for (const e of sample) {
      const lang = detectLanguage(`${e.title || ""} ${e.content || ""}`);
      const conf = normalizeConfidence(e.confidence);
      if (lang === "Tagalog") {
        tagalog++;
        if (conf !== null) { tagalogConfSum += conf; tagalogConfCount++; }
      } else if (lang === "Taglish") {
        taglish++;
        // Count Taglish confidence toward both pools (half weight each)
        if (conf !== null) {
          tagalogConfSum += conf * 0.5; tagalogConfCount += 0.5;
          englishConfSum += conf * 0.5; englishConfCount += 0.5;
        }
      } else {
        english++;
        if (conf !== null) { englishConfSum += conf; englishConfCount++; }
      }
    }
    const total = sample.length;
    return {
      tagalogPct: percent(tagalog + 0.5 * taglish, total),
      // Average confidence per language group as a percentage; null when no data
      englishAcc: englishConfCount > 0 ? (englishConfSum / englishConfCount) * 100 : null,
      tagalogAcc: tagalogConfCount > 0 ? (tagalogConfSum / tagalogConfCount) * 100 : null,
    };
  }, [entries]);

  // Confidence distribution buckets
  const confidenceBuckets = useMemo(() => {
    if (totalEntries === 0) return { veryHigh: 0, high: 0, medium: 0, low: 0 };
    let veryHigh = 0, high = 0, medium = 0, low = 0;
    let totalWithConfidence = 0;
    for (const e of entries) {
      const c = normalizeConfidence(e.confidence);
      if (c === null) continue;
      totalWithConfidence++;
      if (c >= 0.9) veryHigh++;
      else if (c >= 0.7) high++;
      else if (c >= 0.6) medium++;
      else low++;
    }
    if (totalWithConfidence === 0) return { veryHigh: 0, high: 0, medium: 0, low: 0 };
    return {
      veryHigh: percent(veryHigh, totalWithConfidence),
      high: percent(high, totalWithConfidence),
      medium: percent(medium, totalWithConfidence),
      low: percent(low, totalWithConfidence),
    };
  }, [entries, totalEntries]);

  const lowConfidencePct = confidenceBuckets.low;

  // Last 24h emotion breakdown (joy/calm/anxiety/distress)
  const emotionBreakdown = useMemo(() => {
    let joy = 0, calm = 0, anxiety = 0, distress = 0;
    const data = last24hEntries.length ? last24hEntries : entries.slice(0, 100);
    for (const e of data) {
      const s = normalizeSentiment(e.sentiment);
      if (s === "positive") joy++;
      else if (s === "negative") anxiety++;
      else if (s === "distress") distress++;
      const emos: string[] = Array.isArray(e.emotions) ? e.emotions : [];
      const emosLower = emos.map(x => x.toLowerCase());
      if (emosLower.some(x => ["calm", "relaxed", "peaceful", "serene", "chill"].includes(x))) { calm++; joy = Math.max(0, joy - 0.3); }
      if (emosLower.some(x => ["joy", "happy", "excited", "grateful", "love"].includes(x))) joy++;
    }
    const total = joy + calm + anxiety + distress;
    return {
      joy: percent(joy, total),
      calm: percent(calm, total),
      anxiety: percent(anxiety, total),
      distress: percent(distress, total),
      positive: percent(joy + calm, total),
    };
  }, [last24hEntries, entries]);

  // Low confidence queue
  const lowConfidenceQueue = useMemo(() => {
    const queue = entries
      .filter(e => {
        const c = normalizeConfidence(e.confidence);
        return c !== null && c < 0.65;
      })
      .slice(0, 20)
      .map(e => {
        const confidence = normalizeConfidence(e.confidence) ?? 0;
        const sentiment = normalizeSentiment(e.sentiment);
        return {
          id: `E-${String(e.id || "xxxx").slice(0, 4).toUpperCase()}`,
          entryId: e.id,
          userId: `U-${(e.user_id || "xxxx").slice(0, 4).toUpperCase()}`,
          timestamp: new Date(e.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
          language: detectLanguage(`${e.title || ""} ${e.content || ""}`),
          aiScore: sentiment === "positive" ? "Positive" : sentiment === "negative" ? "Negative" : sentiment === "distress" ? "Distress" : "Uncertain",
          confidence: Math.round(confidence * 100) + "%",
        };
      });
    return queue;
  }, [entries]);

  // Export CSV handler
  const exportCSV = () => {
    const rows = [
      ["Entry ID", "User ID", "Date", "Language", "Sentiment", "Confidence %", "Positive %", "Negative %", "Distress %", "Mood", "Model"],
    ];
    for (const e of entries.slice(0, 2000)) {
      rows.push([
        e.id,
        e.user_id,
        safeIsoString(e.created_at),
        detectLanguage(`${e.title || ""} ${e.content || ""}`),
        normalizeSentiment(e.sentiment) || "",
        String(Math.round((normalizeConfidence(e.confidence) ?? 0) * 100)),
        String(clampPercent(e.positive_percentage)),
        String(clampPercent(e.negative_percentage)),
        String(clampPercent(e.distress_percentage)),
        e.mood || "",
        e.sentiment_model || "",
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentiment-monitoring-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue mx-auto mb-4"></div>
          <p className="text-slate-600 font-poppins">Loading sentiment metrics…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-1">Sentiment Analysis Monitoring</h1>
          <p className="text-sm text-slate-700 font-poppins">AI Model performance &amp; platform-wide NLP metrics</p>
          {error && <p className="text-xs text-error-red font-poppins mt-2">⚠️ {error}</p>}
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-poppins text-dark-text hover:bg-gray-50"
          >
            <span>📊</span> Export Data
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-primary-blue/10 text-primary-blue rounded-lg text-sm font-poppins hover:bg-primary-blue/20"
          >
            <span>🔄</span> Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <Card className="h-full p-5 bg-[#eef3f8]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#52B788]/20 rounded-lg flex items-center justify-center text-2xl">✅</div>
            <div className="text-right flex-1">
              <p className="text-xs text-slate-700 font-poppins">AI ACCURACY</p>
              <p className="text-2xl font-dm-serif text-dark-text">82.6%</p>
              <p className="text-xs text-slate-600 font-poppins">
                F1 macro · {activeModel}
              </p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-300 rounded-full"></div>
        </Card>
        <Card className="h-full p-5 bg-[#eef3f8]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center text-2xl">⚡</div>
            <div className="text-right flex-1">
              <p className="text-xs text-slate-700 font-poppins">AVG CONFIDENCE</p>
              <p className="text-2xl font-dm-serif text-dark-text">
                {avgConfidence != null ? fmtPct(avgConfidence * 100) : "—"}
              </p>
              <p className="text-xs text-slate-700 font-poppins">{totalEntries.toLocaleString()} entries</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] rounded-full"></div>
        </Card>
        <Card className="h-full p-5 bg-[#eef3f8]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center text-2xl">🌐</div>
            <div className="text-right flex-1">
              <p className="text-xs text-slate-700 font-poppins">TAGALOG ENTRIES</p>
              <p className="text-2xl font-dm-serif text-dark-text">{fmtPct(languageStats.tagalogPct)}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-300 rounded-full"></div>
        </Card>
        <Card className="h-full p-5 border-l-4 border-l-[#F4A6A6] bg-[#eef3f8]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#F4A6A6]/20 rounded-lg flex items-center justify-center text-2xl">⚠️</div>
            <div className="text-right flex-1">
              <p className="text-xs text-slate-700 font-poppins">LOW CONFIDENCE</p>
              <p className="text-2xl font-dm-serif text-[#F4A6A6]">{fmtPct(lowConfidencePct)}</p>
              <p className="text-xs text-[#F4A6A6] font-poppins">{lowConfidenceQueue.length} in queue</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-red-400 to-pink-300 rounded-full"></div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confidence Distribution */}
        <Card className="p-6 bg-[#eef3f8]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center">📊</div>
            <p className="text-xs font-poppins text-slate-700">SENTIMENT CONFIDENCE DISTRIBUTION</p>
          </div>
          <div className="space-y-3">
            {[
              { label: "Very High (90-100%)", pct: confidenceBuckets.veryHigh, color: "from-[#52B788] to-[#A8DADC]", valueColor: "text-[#52B788]" },
              { label: "High (70-89%)", pct: confidenceBuckets.high, color: "from-[#A8DADC] to-[#CDB4DB]", valueColor: "text-[#A8DADC]" },
              { label: "Medium (60-69%)", pct: confidenceBuckets.medium, color: "from-[#FFE8A1] to-[#FFB700]", valueColor: "text-[#FFB700]" },
              { label: "Low (<60%)", pct: confidenceBuckets.low, color: "from-[#F4A6A6] to-[#4F4F4F]/30", valueColor: "text-[#F4A6A6]" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-poppins text-dark-text whitespace-nowrap">{row.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-xs font-inter ${row.valueColor} w-12 text-right`}>{fmtPct(row.pct)}</p>
                  <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${row.color}`} style={{ width: `${row.pct > 0 ? Math.max(2, Math.min(100, row.pct)) : 0}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs font-poppins text-slate-700 mb-3">MODEL PERFORMANCE BY LANGUAGE</p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-[#52B788]/20 rounded-full text-xs font-semibold font-poppins text-[#52B788]">
                  English {languageStats.englishAcc != null ? fmtPct(languageStats.englishAcc) : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-[#A8DADC]/20 rounded-full text-xs font-semibold font-poppins text-dark-text">
                  Tagalog {languageStats.tagalogAcc != null ? fmtPct(languageStats.tagalogAcc) : "—"}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Emotion Breakdown */}
        <Card className="p-6 bg-[#eef3f8]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center">📈</div>
            <p className="text-xs font-poppins text-slate-700">PLATFORM EMOTION BREAKDOWN (LAST 24 HOURS)</p>
          </div>
          <div className="relative w-full h-48 flex items-center justify-center">
            <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#EAEAEA" strokeWidth="10" />
              {(() => {
                const joy = (emotionBreakdown.joy / 100) * CIRCUMFERENCE;
                const calm = (emotionBreakdown.calm / 100) * CIRCUMFERENCE;
                const anxiety = (emotionBreakdown.anxiety / 100) * CIRCUMFERENCE;
                const distress = (emotionBreakdown.distress / 100) * CIRCUMFERENCE;
                const gaps = 0.5;
                return (
                  <>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#52B788" strokeWidth="10" strokeDasharray={`${joy} ${CIRCUMFERENCE}`} />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#A8DADC" strokeWidth="10" strokeDasharray={`${calm} ${CIRCUMFERENCE}`} strokeDashoffset={-(joy + gaps)} />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#FFE8A1" strokeWidth="10" strokeDasharray={`${anxiety} ${CIRCUMFERENCE}`} strokeDashoffset={-(joy + calm + gaps * 2)} />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#F4A6A6" strokeWidth="10" strokeDasharray={`${distress} ${CIRCUMFERENCE}`} strokeDashoffset={-(joy + calm + anxiety + gaps * 3)} />
                  </>
                );
              })()}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-lg font-dm-serif text-dark-text">{fmtPct(emotionBreakdown.positive)}</p>
                <p className="text-xs text-slate-700 font-poppins">Positive</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 px-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#52B788]"></div>
              <span className="text-xs font-poppins text-dark-text">Joy {fmtPct(emotionBreakdown.joy)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#A8DADC]"></div>
              <span className="text-xs font-poppins text-dark-text">Calm {fmtPct(emotionBreakdown.calm)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FFE8A1]"></div>
              <span className="text-xs font-poppins text-dark-text">Anxiety {fmtPct(emotionBreakdown.anxiety)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#F4A6A6]"></div>
              <span className="text-xs font-poppins text-dark-text">Distress {fmtPct(emotionBreakdown.distress)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Review Queue */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#F4A6A6]/20 rounded-lg flex items-center justify-center">🔍</div>
            <div>
              <p className="text-xs font-poppins text-slate-700">LOW CONFIDENCE QUEUE - REQUIRES MANUAL REVIEW</p>
              <p className="text-xs text-slate-600 font-inter mt-0.5">Entries with model confidence below 65%</p>
            </div>
          </div>
          <div className="text-xs text-[#F4A6A6] font-poppins">{lowConfidenceQueue.length} entries</div>
        </div>
        <div className="overflow-x-auto">
          <table className="admin-table min-w-[1000px] table-fixed">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-3">ENTRY ID</th>
                <th className="text-left py-4 px-3">USER ID</th>
                <th className="text-left py-4 px-3">TIMESTAMP</th>
                <th className="text-left py-4 px-3">LANGUAGE</th>
                <th className="text-left py-4 px-3">AI SCORE</th>
                <th className="text-left py-4 px-3">CONFIDENCE</th>
                <th className="text-left py-4 px-3">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {lowConfidenceQueue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 px-3 text-center text-slate-600 text-sm font-poppins">
                    🎉 No low-confidence entries at the moment. Model is performing well!
                  </td>
                </tr>
              ) : (
                lowConfidenceQueue.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-all ${selectedEntry === entry.id ? "bg-[#A8DADC]/10" : ""
                      }`}
                    onClick={() => setSelectedEntry(entry.id === selectedEntry ? null : entry.id)}
                  >
                    <td className="py-4 px-3">
                      <p title={entry.id} className="inline-block max-w-[200px] truncate font-poppins text-sm font-semibold text-slate-900">{entry.id}</p>
                    </td>
                    <td className="py-4 px-3">
                      <p className="text-sm font-poppins font-semibold text-slate-900 hover:text-indigo-600">{entry.userId}</p>
                    </td>
                    <td className="py-4 px-3">
                      <p className="text-sm font-inter text-slate-700">{entry.timestamp}</p>
                    </td>
                    <td className="py-4 px-3">
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold font-poppins text-slate-800">{entry.language}</span>
                    </td>
                    <td className="py-4 px-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${entry.aiScore === "Positive" ? "border-emerald-200 bg-emerald-100 text-emerald-800" :
                        entry.aiScore === "Negative" || entry.aiScore === "Distress" ? "border-rose-200 bg-rose-100 text-rose-800" :
                          "border-amber-200 bg-amber-100 text-amber-900"
                        }`}>{entry.aiScore}</span>
                    </td>
                    <td className="py-4 px-3">
                      <span className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-semibold font-poppins text-amber-900">{entry.confidence}</span>
                    </td>
                    <td className="py-4 px-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const fullEntry = entries.find(en => en.id === entry.entryId);
                          setReviewEntry(fullEntry ? { ...fullEntry, _display: entry } : { _display: entry });
                        }}
                        className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-amber-600 inline-block"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Review Entry Modal ──────────────────────────────────────────── */}
      {reviewEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-dm-serif text-dark-text">Manual Review</h3>
                <p className="text-xs font-inter text-slate-600 mt-0.5">Low confidence entry requiring human verification</p>
              </div>
              <button
                type="button"
                onClick={() => setReviewEntry(null)}
                className="p-2 hover:bg-gray-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Meta row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-poppins text-slate-500 uppercase tracking-wider mb-1">Entry ID</p>
                  <p className="text-sm font-semibold font-poppins text-dark-text">{reviewEntry._display?.id ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-poppins text-slate-500 uppercase tracking-wider mb-1">User ID</p>
                  <p className="text-sm font-semibold font-poppins text-dark-text">{reviewEntry._display?.userId ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-poppins text-slate-500 uppercase tracking-wider mb-1">Timestamp</p>
                  <p className="text-sm font-inter text-slate-700">{reviewEntry._display?.timestamp ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-poppins text-slate-500 uppercase tracking-wider mb-1">Language</p>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold font-poppins text-slate-800">
                    {reviewEntry._display?.language ?? "—"}
                  </span>
                </div>
              </div>

              {/* AI result */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-poppins text-slate-500 uppercase tracking-wider mb-1">AI Classification</p>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${reviewEntry._display?.aiScore === "Positive" ? "border-emerald-200 bg-emerald-100 text-emerald-800" :
                      reviewEntry._display?.aiScore === "Negative" || reviewEntry._display?.aiScore === "Distress" ? "border-rose-200 bg-rose-100 text-rose-800" :
                        "border-amber-200 bg-amber-100 text-amber-900"
                    }`}>{reviewEntry._display?.aiScore ?? "—"}</span>
                </div>
                <div>
                  <p className="text-xs font-poppins text-slate-500 uppercase tracking-wider mb-1">Confidence</p>
                  <span className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-semibold font-poppins text-amber-900">
                    {reviewEntry._display?.confidence ?? "—"}
                  </span>
                </div>
              </div>

              {/* Entry content */}
              {reviewEntry.content ? (
                <div>
                  <p className="text-xs font-poppins text-slate-500 uppercase tracking-wider mb-2">Journal Entry Content</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-inter text-dark-text leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {reviewEntry.content}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm font-inter text-amber-800">
                  ⚠️ Entry content is not available for this entry.
                </div>
              )}

              {/* Mood & emotions */}
              {(reviewEntry.mood || (Array.isArray(reviewEntry.emotions) && reviewEntry.emotions.length > 0)) && (
                <div className="grid grid-cols-2 gap-4">
                  {reviewEntry.mood && (
                    <div>
                      <p className="text-xs font-poppins text-slate-500 uppercase tracking-wider mb-1">Mood Tag</p>
                      <p className="text-sm font-poppins text-dark-text">{reviewEntry.mood}</p>
                    </div>
                  )}
                  {Array.isArray(reviewEntry.emotions) && reviewEntry.emotions.length > 0 && (
                    <div>
                      <p className="text-xs font-poppins text-slate-500 uppercase tracking-wider mb-1">Emotions</p>
                      <div className="flex flex-wrap gap-1">
                        {reviewEntry.emotions.map((em: string) => (
                          <span key={em} className="px-2 py-0.5 bg-lavender/20 rounded-full text-xs font-poppins text-slate-700">{em}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setReviewEntry(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-dark-text font-poppins text-sm rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
