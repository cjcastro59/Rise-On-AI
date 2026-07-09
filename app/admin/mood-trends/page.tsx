"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { analyzeSentiment } from "@/lib/sentiment";

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

    loadEntries();
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
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-dm-serif text-[#4F4F4F] mb-1">Mood Trend Reports</h1>
          <p className="text-sm text-[#4F4F4F]/60 font-poppins">Platform-wide emotional analytics; aggregated and anonymized</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-poppins text-[#4F4F4F] hover:bg-gray-50">
            <span>📄</span> Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#52B788]/20 rounded-lg flex items-center justify-center text-2xl">😊</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">POSITIVE ENTRIES</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">{loading ? "—" : `${positivePercent}%`}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-300 rounded-full"></div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center text-2xl">�</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">NEGATIVE ENTRIES</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">{loading ? "—" : `${negativePercent}%`}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] rounded-full"></div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center text-2xl">😕</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">MIXED / UNCERTAIN</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">{loading ? "—" : `${mixedPercent}%`}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-300 rounded-full"></div>
        </Card>
        <Card className="p-5 border-l-4 border-l-[#F4A6A6]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#F4A6A6]/20 rounded-lg flex items-center justify-center text-2xl">😢</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">DISTRESS SIGNALS</p>
              <p className="text-2xl font-dm-serif text-[#F4A6A6]">{loading ? "—" : `${distressPercent}%`}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-red-400 to-pink-300 rounded-full"></div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center">📈</div>
            <p className="text-xs font-poppins text-[#4F4F4F]/60">PLATFORM MOOD SCORE TREND - LAST 7 DAYS</p>
          </div>
          <div className="h-56 flex items-end justify-between gap-2 px-2">
            {dailyScores.map((score, index) => (
              <div key={`${score}-${index}`} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full rounded-t-lg bg-[#52B788]" style={{ height: `${Math.max(score, 8)}%` }}></div>
                <span className="text-xs text-[#4F4F4F]/60 font-poppins">{lastSevenDays[index].toLocaleDateString("en", { weekday: "short" })}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6 mt-4 px-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#52B788]"></div>
              <span className="text-xs font-poppins text-[#4F4F4F]">Positive rate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#F4A6A6]"></div>
              <span className="text-xs font-poppins text-[#4F4F4F]">Distress rate</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center">🎭</div>
            <p className="text-xs font-poppins text-[#4F4F4F]/60">TOP EMOTIONS PLATFORM-WIDE</p>
          </div>
          <div className="space-y-3">
            {topEmotions.length > 0 ? topEmotions.map(([emotion, count]) => (
              <div key={emotion} className="flex items-center justify-between">
                <p className="text-sm font-poppins text-[#4F4F4F]">{emotion}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-inter text-[#4F4F4F]/60">{Math.round((count / totalEntries) * 100)}%</p>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#52B788] to-[#A8DADC]" style={{ width: `${Math.round((count / totalEntries) * 100)}%` }}></div>
                  </div>
                </div>
              </div>
            )) : <p className="text-sm text-[#4F4F4F]/60">No emotion tags yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
