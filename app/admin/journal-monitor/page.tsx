"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { analyzeSentiment, getSentimentFromMood, getMoodCategory, MoodCategory, Sentiment } from "@/lib/sentiment";

interface JournalEntryRow {
  id: string;
  user_id: string;
  created_at: string;
  mood: string | null;
  content: string | null;
  emotions: string[] | null;
}

const positiveWords = ["happy", "calm", "hopeful", "grateful", "peaceful", "joy", "love", "content", "safe", "good", "better", "relieved", "excited", "optimistic"];
const negativeWords = ["sad", "anxious", "angry", "stress", "stressed", "worried", "overwhelmed", "lonely", "depressed", "frustrated", "hurt", "afraid", "panic", "tired"];
const distressWords = ["panic", "suicidal", "hurt", "unsafe", "hopeless", "worthless", "afraid", "overwhelmed"];

const moodEmojiMap: Record<string, string> = {
  "Happy": "😊",
  "Anxious": "😰",
  "Sad": "😢",
  "Frustrated": "😤",
  "Calm": "😌",
  "Excited": "🎉",
  "Confused": "😕",
  "Overwhelmed": "😵"
};

const moodCategoryEmojiMap: Record<MoodCategory, string> = {
  "happy": "😊",
  "calm": "😌",
  "excited": "🎉",
  "anxious": "😰",
  "sad": "😢",
  "frustrated": "😤",
  "overwhelmed": "😵"
};

function getWordCount(content: string | null) {
  if (!content) return 0;
  return content.trim().split(/\s+/).filter(Boolean).length;
}

function getLanguage(content: string | null) {
  const text = (content || "").toLowerCase();
  const hasTagalog = /ako|kaya|ngayon|kahit|naman|gusto|hindi|mabuti|pagod|masaya|nalulungkot/.test(text);
  const hasEnglish = /the|and|but|today|feel|feelings|because|really|very|happy|sad|stress|worried/.test(text);

  if (hasTagalog && hasEnglish) return "Taglish";
  if (hasTagalog) return "Tagalog";
  return "English";
}

function getMoodTag(content: string | null, mood: string | null, emotions: string[] | null) {
  // If user selected a mood, use that with emoji
  if (mood && moodEmojiMap[mood]) {
    return `${moodEmojiMap[mood]} ${mood}`;
  }
  
  // Otherwise, use our new sentiment analysis
  const sentiment = analyzeSentiment(content);
  
  if (sentiment === "distress") {
    return "🚨 Distress";
  }
  
  const moodCategory = getMoodCategory(content, mood);
  
  if (sentiment === "positive") {
    return `${moodCategoryEmojiMap[moodCategory]} Positive`;
  }
  
  if (sentiment === "negative") {
    return `${moodCategoryEmojiMap[moodCategory]} Negative`;
  }
  
  return `${moodCategoryEmojiMap[moodCategory]} Negative`;
}

function getSentimentPercent(content: string | null, mood: string | null, emotions: string[] | null) {
  let sentiment = analyzeSentiment(content);
  
  if (mood) {
    sentiment = getSentimentFromMood(mood);
  }
  
  if (sentiment === "distress") {
    return { label: "Distress", percent: 95, color: "bg-red-100 text-red-600" };
  }
  
  if (sentiment === "negative") {
    return { label: "Negative", percent: 70, color: "bg-[#F4A6A6]/20 text-[#F4A6A6]" };
  }
  
  if (sentiment === "positive") {
    return { label: "Positive", percent: 75, color: "bg-[#52B788]/20 text-[#52B788]" };
  }
  
  return { label: "Negative", percent: 70, color: "bg-[#F4A6A6]/20 text-[#F4A6A6]" };
}

function isSameDay(dateString: string, target: Date) {
  const date = new Date(dateString);
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth() && date.getDate() === target.getDate();
}

function getHoursDistribution(entries: JournalEntryRow[]) {
  const buckets = [0, 0, 0, 0];
  entries.forEach((entry) => {
    const hour = new Date(entry.created_at).getHours();
    if (hour >= 6 && hour < 12) buckets[0] += 1;
    else if (hour >= 12 && hour < 18) buckets[1] += 1;
    else if (hour >= 18 && hour < 22) buckets[2] += 1;
    else buckets[3] += 1;
  });

  const total = entries.length || 1;
  return buckets.map((value) => Math.round((value / total) * 100));
}

export default function AdminJournalMonitorPage() {
  const [entries, setEntries] = useState<JournalEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 10;
  const { user: currentUser } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!currentUser) return;

    const loadEntries = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error: fetchError } = await supabase
          .from("journal_entries")
          .select("id, user_id, created_at, mood, content, emotions")
          .order("created_at", { ascending: false });

        if (fetchError) {
          console.error("Error fetching entries:", fetchError);
          setError(fetchError.message);
          setEntries([]);
        } else {
          setEntries((data as JournalEntryRow[]) || []);
        }
      } catch (err) {
        console.error("Error loading journal monitoring data:", err);
        setError("An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };

    loadEntries();
  }, [supabase, currentUser]);

  const totalEntries = entries.length;
  const todaysEntries = entries.filter((entry) => isSameDay(entry.created_at, new Date())).length;
  const averageWords = totalEntries > 0 ? Math.round(entries.reduce((sum, entry) => sum + getWordCount(entry.content), 0) / totalEntries) : 0;
  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
  const volumeByDay = lastSevenDays.map((day) => entries.filter((entry) => isSameDay(entry.created_at, day)).length);
  const maxVolume = Math.max(...volumeByDay, 1);
  const hoursDistribution = getHoursDistribution(entries);
  const languageCounts = entries.reduce(
    (acc, entry) => {
      const language = getLanguage(entry.content);
      acc[language] = (acc[language] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const topLanguages = Object.entries(languageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  const distressSignals = entries.filter((entry) => {
    return analyzeSentiment(entry.content) === "distress";
  }).length;

  // Pagination calculations
  const totalPages = Math.ceil(entries.length / entriesPerPage);
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = entries.slice(indexOfFirstEntry, indexOfLastEntry);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-1">Journal Monitoring</h1>
          <p className="text-sm text-dark-text/70 font-poppins">Anonymized entry analytics; no content displayed</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-poppins text-dark-text hover:bg-gray-50">
            <span>📊</span> Export
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-xl">
          <p className="text-sm font-poppins text-red-700 flex items-center gap-2">
            <span>⚠️</span> {error}
          </p>
        </div>
      )}

      <div className="p-4 bg-gradient-to-r from-[#A8DADC]/20 to-[#CDB4DB]/20 rounded-xl border-l-4 border-l-[#A8DADC]">
        <p className="text-sm font-poppins text-dark-text/70 flex items-center gap-2">
          <span>🔒</span> Privacy Protected: journal content remains hidden. Only metadata and aggregated signals are visible.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-[#eef3f8]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center text-2xl">📝</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/70 font-poppins">TOTAL ENTRIES</p>
              <p className="text-2xl font-dm-serif text-dark-text">{loading ? "—" : totalEntries}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-400 to-cyan-300 rounded-full"></div>
        </Card>
        <Card className="p-5 bg-[#eef3f8]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center text-2xl">📊</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/70 font-poppins">ENTRIES TODAY</p>
              <p className="text-2xl font-dm-serif text-dark-text">{loading ? "—" : todaysEntries}</p>
              <p className="text-xs text-dark-text/70 font-poppins">Recent activity shown live</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-300 rounded-full"></div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#52B788]/20 rounded-lg flex items-center justify-center text-2xl">📄</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/70 font-poppins">AVG WORDS/ENTRY</p>
              <p className="text-2xl font-dm-serif text-dark-text">{loading ? "—" : averageWords}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-300 rounded-full"></div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#FFE8A1]/30 rounded-lg flex items-center justify-center text-2xl">⚠️</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/70 font-poppins">DISTRESS SIGNALS</p>
              <p className="text-2xl font-dm-serif text-[#F4A6A6]">{loading ? "—" : distressSignals}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-yellow-400 to-orange-300 rounded-full"></div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-[#eef3f8]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center">📈</div>
            <p className="text-xs font-poppins text-dark-text/70">ENTRY VOLUME - LAST 7 DAYS</p>
          </div>
          <div className="h-40 flex items-end justify-between gap-2 px-4">
            {volumeByDay.map((value, index) => (
              <div key={`${value}-${index}`} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-2xl shadow-sm" style={{ height: `${(value / maxVolume) * 100}%`, background: "linear-gradient(to top, #52B788, #A8DADC)" }}></div>
                <span className="text-xs text-dark-text/70 font-poppins">{lastSevenDays[index].toLocaleDateString("en", { weekday: "short" })}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 bg-[#eef3f8]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center">🕒</div>
            <p className="text-xs font-poppins text-dark-text/70">PEAK WRITING HOURS</p>
          </div>
          <div className="space-y-3">
            {[
              { label: "Morning (6-12 AM)", value: hoursDistribution[0] },
              { label: "Afternoon (12-6 PM)", value: hoursDistribution[1] },
              { label: "Evening (6-10 PM)", value: hoursDistribution[2] },
              { label: "Night (10 PM-6 AM)", value: hoursDistribution[3] },
            ].map((segment) => (
              <div key={segment.label} className="flex items-center justify-between">
                <p className="text-sm font-poppins text-dark-text">{segment.label}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-inter text-dark-text/70">{segment.value}%</p>
                  <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB]" style={{ width: `${segment.value}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs font-poppins text-dark-text/70 mb-3">LANGUAGE USED</p>
            <div className="flex flex-wrap items-center gap-3">
              {topLanguages.length > 0 ? topLanguages.map(([language, count]) => (
                <span key={language} className="px-3 py-1 bg-[#A8DADC]/20 rounded-full text-xs font-poppins text-dark-text">{language} {Math.round((count / Math.max(totalEntries, 1)) * 100)}%</span>
              )) : <span className="text-sm text-dark-text/70">No entries yet</span>}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs font-poppins text-dark-text/70">RECENT ENTRY METADATA (ANONYMIZED)</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-[#A8DADC]/10 rounded-full border border-[#A8DADC]/30">
              <span className="text-xs">🤐</span>
              <span className="text-xs font-poppins text-dark-text">Content Hidden</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/70 font-poppins uppercase tracking-wider">ENTRY ID</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/70 font-poppins uppercase tracking-wider">TIMESTAMP</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/70 font-poppins uppercase tracking-wider">WORD COUNT</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/70 font-poppins uppercase tracking-wider">LANGUAGE</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/70 font-poppins uppercase tracking-wider">MOOD TAG</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/70 font-poppins uppercase tracking-wider">SENTIMENT SCORE</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/70 font-poppins uppercase tracking-wider">AI PROCESSED</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-dark-text/70 font-inter">Loading entry analytics…</td>
                </tr>
              ) : currentEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-dark-text/70 font-inter">No journal entries found yet.</td>
                </tr>
              ) : (
                <>
                  {currentEntries.map((entry) => {
                    const sentiment = getSentimentPercent(entry.content, entry.mood, entry.emotions);
                    return (
                      <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-3">
                          <p className="font-poppins text-sm text-[#A8DADC] font-semibold">ENTRY-{String(entry.id).slice(0, 4).toUpperCase()}</p>
                        </td>
                        <td className="py-4 px-3">
                          <p className="text-sm font-inter text-dark-text/70">{new Date(entry.created_at).toLocaleString()}</p>
                        </td>
                        <td className="py-4 px-3">
                          <p className="text-sm font-poppins text-dark-text">{getWordCount(entry.content)}</p>
                        </td>
                        <td className="py-4 px-3">
                          <span className="px-2 py-1 bg-[#A8DADC]/20 rounded-full text-xs font-semibold font-poppins text-dark-text">{getLanguage(entry.content)}</span>
                        </td>
                        <td className="py-4 px-3">
                          <p className="text-sm font-poppins text-dark-text">{getMoodTag(entry.content, entry.mood, entry.emotions)}</p>
                        </td>
                        <td className="py-4 px-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${sentiment.color}`}>
                            {sentiment.percent}% {sentiment.label}
                          </span>
                        </td>
                        <td className="py-4 px-3">
                          <span className="px-2 py-1 bg-[#A8DADC]/20 rounded-full text-xs font-semibold font-poppins text-dark-text">Done</span>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Add empty rows to maintain consistent table height */}
                  {Array.from({ length: entriesPerPage - currentEntries.length }).map((_, index) => (
                    <tr key={`empty-${index}`} className="border-b border-gray-100">
                      <td className="py-4 px-3"></td>
                      <td className="py-4 px-3"></td>
                      <td className="py-4 px-3"></td>
                      <td className="py-4 px-3"></td>
                      <td className="py-4 px-3"></td>
                      <td className="py-4 px-3"></td>
                      <td className="py-4 px-3"></td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {!loading && entries.length > 0 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-dark-text/70 font-poppins">
              Showing {indexOfFirstEntry + 1}–{Math.min(indexOfLastEntry, entries.length)} of {entries.length} entries
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-dark-text"
              >
                ←
              </button>
              
              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-poppins transition-colors ${
                      currentPage === page
                        ? "bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] text-white"
                        : "text-dark-text hover:bg-gray-100"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-dark-text"
              >
                →
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
