"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { analyzeSentiment } from "@/lib/sentiment";
import {
  WELLNESS_LEVEL_CONFIG,
  classifyWellnessLevel,
  type WellnessLevel,
} from "@/lib/wellness-assessment";

interface JournalEntryRow {
  id: string;
  created_at: string;
  mood: string | null;
  content: string | null;
  emotions: string[] | null;
}

const positiveWords = ["happy", "calm", "hopeful", "grateful", "peaceful", "joy", "love", "content", "safe", "good", "better", "relieved", "excited", "optimistic"];
const negativeWords = ["sad", "anxious", "angry", "stress", "stressed", "worried", "overwhelmed", "lonely", "depressed", "frustrated", "hurt", "afraid", "panic", "tired"];
const distressWords = ["panic", "suicidal", "hurt", "unsafe", "hopeless", "worthless", "afraid", "overwhelmed"];

function classifyEntry(entry: JournalEntryRow) {
  // Use our analyzeSentiment function
  const sentiment = analyzeSentiment(entry.content);
  if (sentiment === "distress") return "Distress";
  if (sentiment === "positive") return "Positive";
  return "Negative";
}

function isSameDay(dateString: string, target: Date) {
  const date = new Date(dateString);
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth() && date.getDate() === target.getDate();
}

export default function AdminMoodTrendsPage() {
  const [entries, setEntries] = useState<JournalEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Platform-wide wellness distribution fetched directly from behavioral_indicators
  const [wellnessStats, setWellnessStats] = useState<{
    level: WellnessLevel;
    count: number;
    avgScore: number;
  }[]>([]);
  const [wellnessLoading, setWellnessLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const loadEntries = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.from("journal_entries").select("id, created_at, mood, content, emotions").order("created_at", { ascending: false });
        if (!error) {
          setEntries((data as JournalEntryRow[]) || []);
        }
      } catch (error) {
        console.error("Error loading mood trends data:", error);
      } finally {
        setLoading(false);
      }
    };

    // Load platform-wide wellness distribution (latest row per user)
    const loadWellness = async () => {
      try {
        setWellnessLoading(true);
        // Fetch the most recent behavioral_indicators row per user (30-day window)
        const { data } = await supabase
          .from("behavioral_indicators")
          .select("user_id, wellness_score, wellness_level, window_end_date")
          .eq("lookback_days", 30)
          .not("wellness_score", "is", null)
          .order("window_end_date", { ascending: false });

        if (!data) return;

        // Deduplicate: keep only the most-recent row per user
        const seen = new Set<string>();
        const latest: { wellness_score: number; wellness_level: string | null }[] = [];
        for (const row of data) {
          if (!seen.has(row.user_id)) {
            seen.add(row.user_id);
            latest.push(row);
          }
        }

        // Group by level
        const buckets: Record<string, { count: number; totalScore: number }> = {};
        for (const row of latest) {
          const lvl = (row.wellness_level as WellnessLevel) ||
            classifyWellnessLevel(row.wellness_score);
          if (!buckets[lvl]) buckets[lvl] = { count: 0, totalScore: 0 };
          buckets[lvl].count++;
          buckets[lvl].totalScore += row.wellness_score;
        }

        const ORDER: WellnessLevel[] = [
          "Healthy", "Stable", "Moderate Concern", "At Risk", "High Risk",
        ];
        setWellnessStats(
          ORDER.filter(l => buckets[l])
            .map(l => ({
              level: l,
              count: buckets[l].count,
              avgScore: Math.round((buckets[l].totalScore / buckets[l].count) * 10) / 10,
            }))
        );
      } catch (err) {
        console.error("Error loading wellness distribution:", err);
      } finally {
        setWellnessLoading(false);
      }
    };

    loadEntries();
    loadWellness();
  }, [supabase]);

  const categories = entries.reduce(
    (acc, entry) => {
      const category = classifyEntry(entry);
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalEntries = entries.length || 1;
  const positivePercent = Math.round(((categories.Positive || 0) / totalEntries) * 100);
  const negativePercent = Math.round(((categories.Negative || 0) / totalEntries) * 100);
  const mixedPercent = Math.round(((categories.Mixed || 0) / totalEntries) * 100);
  const distressPercent = Math.round(((categories.Distress || 0) / totalEntries) * 100);

  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
  const dailyScores = lastSevenDays.map((day) => {
    const dayEntries = entries.filter((entry) => isSameDay(entry.created_at, day));
    if (dayEntries.length === 0) return 0;
    const positives = dayEntries.filter((entry) => classifyEntry(entry) === "Positive").length;
    return Math.round((positives / dayEntries.length) * 100);
  });

  const emotionCounts = entries.reduce((acc, entry) => {
    (entry.emotions || []).forEach((emotion) => {
      const normalized = emotion.toLowerCase();
      acc[normalized] = (acc[normalized] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  const topEmotions = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-1">Mood Trend Reports</h1>
          <p className="text-sm text-dark-text/70 font-poppins">Platform-wide emotional analytics; aggregated and anonymized</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              const header = ["Date", "Entry ID", "Mood", "Sentiment Class", "Emotions"];
              const rows = [header];
              for (const entry of entries.slice(0, 5000)) {
                const cat = classifyEntry(entry);
                rows.push([
                  new Date(entry.created_at).toISOString(),
                  entry.id,
                  entry.mood || "",
                  cat,
                  (entry.emotions || []).join("|"),
                ]);
              }
              // Write summary at end for PDF/print context
              rows.push([]);
              rows.push(["SUMMARY"]);
              rows.push(["Positive %", positivePercent]);
              rows.push(["Negative %", negativePercent]);
              rows.push(["Mixed %", mixedPercent]);
              rows.push(["Distress %", distressPercent]);
              rows.push(["Top Emotions", topEmotions.map(([k, v]) => `${k}:${v}`).join("; ")]);
              const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
              const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `mood-trends-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              try {
                setTimeout(() => window.print(), 300);
              } catch {
                /* ignore print */
              }
            }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-poppins text-dark-text hover:bg-gray-50"
          >
            <span>📄</span> Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-[#eef3f8]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#52B788]/20 rounded-lg flex items-center justify-center text-2xl">😊</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/70 font-poppins">POSITIVE ENTRIES</p>
              <p className="text-2xl font-dm-serif text-dark-text">{loading ? "—" : `${positivePercent}%`}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-300 rounded-full"></div>
        </Card>
        <Card className="p-5 bg-[#eef3f8]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center text-2xl">😢</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/70 font-poppins">NEGATIVE ENTRIES</p>
              <p className="text-2xl font-dm-serif text-dark-text">{loading ? "—" : `${negativePercent}%`}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] rounded-full"></div>
        </Card>
        <Card className="p-5 bg-[#eef3f8]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center text-2xl">😕</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/70 font-poppins">MIXED / UNCERTAIN</p>
              <p className="text-2xl font-dm-serif text-dark-text">{loading ? "—" : `${mixedPercent}%`}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-300 rounded-full"></div>
        </Card>
        <Card className="p-5 border-l-4 border-l-[#F4A6A6] bg-[#eef3f8]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#F4A6A6]/20 rounded-lg flex items-center justify-center text-2xl">😫</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/70 font-poppins">DISTRESS SIGNALS</p>
              <p className="text-2xl font-dm-serif text-[#F4A6A6]">{loading ? "—" : `${distressPercent}%`}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-red-400 to-pink-300 rounded-full"></div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-[#eef3f8]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center">📈</div>
            <p className="text-xs font-poppins text-dark-text/70">PLATFORM MOOD SCORE TREND - LAST 7 DAYS</p>
          </div>
          <div className="h-56 flex items-end justify-between gap-2 px-2">
            {dailyScores.map((score, index) => (
              <div key={`${score}-${index}`} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full rounded-t-lg bg-[#52B788]" style={{ height: `${Math.max(score, 8)}%` }}></div>
                <span className="text-xs text-dark-text/70 font-poppins">{lastSevenDays[index].toLocaleDateString("en", { weekday: "short" })}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6 mt-4 px-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#52B788]"></div>
              <span className="text-xs font-poppins text-dark-text">Positive rate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#F4A6A6]"></div>
              <span className="text-xs font-poppins text-dark-text">Distress rate</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-[#eef3f8]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center">🎭</div>
            <p className="text-xs font-poppins text-dark-text/70">TOP EMOTIONS PLATFORM-WIDE</p>
          </div>
          <div className="space-y-3">
            {topEmotions.length > 0 ? topEmotions.map(([emotion, count]) => (
              <div key={emotion} className="flex items-center justify-between">
                <p className="text-sm font-poppins text-dark-text">{emotion}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-inter text-dark-text/70">{Math.round((count / totalEntries) * 100)}%</p>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#52B788] to-[#A8DADC]" style={{ width: `${Math.round((count / totalEntries) * 100)}%` }}></div>
                  </div>
                </div>
              </div>
            )) : <p className="text-sm text-dark-text/70">No emotion tags yet.</p>}
          </div>
        </Card>
      </div>

      {/* ── WELLNESS DISTRIBUTION ─────────────────────────────────────────── */}
      <Card className="p-6 bg-[#eef3f8]">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-[#B7E4C7]/30 rounded-lg flex items-center justify-center">💚</div>
          <p className="text-xs font-poppins text-dark-text/70 uppercase tracking-wider">
            PLATFORM WELLNESS DISTRIBUTION
          </p>
          <span className="ml-auto text-[10px] text-dark-text/40 font-inter normal-case tracking-normal">
            Most recent 30-day score per user
          </span>
        </div>
        <p className="text-[11px] text-dark-text/40 font-inter mb-5 ml-11">
          Aggregated &amp; anonymised · scores sourced from behavioral_indicators table
        </p>

        {wellnessLoading ? (
          <p className="text-xs text-dark-text/50 py-4 text-center">Loading wellness distribution…</p>
        ) : wellnessStats.length === 0 ? (
          <p className="text-xs text-dark-text/50 py-4 text-center">
            No wellness scores computed yet. Users need at least one journal entry.
          </p>
        ) : (
          <>
            {/* Summary counts row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              {(["Healthy","Stable","Moderate Concern","At Risk","High Risk"] as WellnessLevel[]).map((lvl) => {
                const stat  = wellnessStats.find(s => s.level === lvl);
                const cfg   = WELLNESS_LEVEL_CONFIG[lvl];
                const total = wellnessStats.reduce((s, r) => s + r.count, 0) || 1;
                return (
                  <div key={lvl}
                    className="rounded-xl p-3 flex flex-col gap-1 border"
                    style={{ backgroundColor: cfg.bgColor + "40", borderColor: cfg.borderColor + "60" }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{cfg.emoji}</span>
                      <span className="text-[10px] font-poppins font-semibold" style={{ color: cfg.color }}>
                        {lvl}
                      </span>
                    </div>
                    <p className="text-xl font-dm-serif" style={{ color: cfg.color }}>
                      {stat ? stat.count : 0}
                    </p>
                    <p className="text-[10px] text-dark-text/50 font-inter">
                      {stat ? Math.round((stat.count / total) * 100) : 0}% of users
                      {stat ? ` · avg ${stat.avgScore.toFixed(1)}` : ""}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Stacked proportion bar */}
            {(() => {
              const total = wellnessStats.reduce((s, r) => s + r.count, 0) || 1;
              return (
                <div>
                  <div className="h-4 flex rounded-full overflow-hidden gap-px">
                    {(["Healthy","Stable","Moderate Concern","At Risk","High Risk"] as WellnessLevel[]).map(lvl => {
                      const stat = wellnessStats.find(s => s.level === lvl);
                      if (!stat || stat.count === 0) return null;
                      const pct = (stat.count / total) * 100;
                      return (
                        <div
                          key={lvl}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: WELLNESS_LEVEL_CONFIG[lvl].bgColor,
                          }}
                          title={`${lvl}: ${stat.count} users (${pct.toFixed(1)}%)`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {(["Healthy","Stable","Moderate Concern","At Risk","High Risk"] as WellnessLevel[]).map(lvl => {
                      const cfg  = WELLNESS_LEVEL_CONFIG[lvl];
                      const stat = wellnessStats.find(s => s.level === lvl);
                      if (!stat) return null;
                      return (
                        <div key={lvl} className="flex items-center gap-1">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.bgColor }} />
                          <span className="text-[10px] font-inter text-dark-text/60">{lvl}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </Card>
    </div>
  );
}
