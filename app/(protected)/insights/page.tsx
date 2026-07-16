"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/layout/PageHeader";
import WeeklyMoodChart from "@/components/dashboard/WeeklyMoodChart";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMoodTrend, type MoodTrendRange } from "@/hooks/useMoodTrend";
import { analyzeEntry } from "@/lib/sentiment";

type JournalEntry = {
  id: string;
  content: string | null;
  mood: string | null;
  emotions: string[] | null;
  created_at: string;
};

const TIME_RANGES: MoodTrendRange[] = ["Week", "Month", "3 Months", "All Time"];

export default function MoodInsightsPage() {
  const [timeRange, setTimeRange] = useState<MoodTrendRange>("Week");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const {
    data: moodTrendData,
    loading: moodTrendLoading,
    hasData: moodTrendHasData,
    avgScore: moodTrendAvg,
    ticks: moodTrendTicks,
  } = useMoodTrend(timeRange);

  // Mood options for scoring
  const moodOptions = [
    { label: "Happy", icon: "😊", score: 10 },
    { label: "Calm", icon: "😌", score: 8 },
    { label: "Excited", icon: "🎉", score: 9 },
    { label: "Confused", icon: "😕", score: 5 },
    { label: "Anxious", icon: "😰", score: 3 },
    { label: "Sad", icon: "😢", score: 2 },
    { label: "Frustrated", icon: "😤", score: 4 },
    { label: "Overwhelmed", icon: "😵", score: 1 },
  ];

  const moodColors = {
    "Joy & Hope": "#A8DADC",
    "Uncertainty": "#CDB4DB",
    "Anxiety / Stress": "#F4A6A6"
  };

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching entries:", error);
        return;
      }

      setEntries(data || []);
    } catch (error) {
      console.error("Error fetching entries:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  // Fetch entries on mount
  useEffect(() => {
    if (user) {
      fetchEntries();
    }
  }, [fetchEntries, user]);

  // Calculate streak
  const calculateStreak = (): number => {
    if (entries.length === 0) return 0;
    
    const sortedDates = entries.map(entry => 
      new Date(entry.created_at).toDateString()
    ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    const uniqueDates = [...new Set(sortedDates)];
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const dateStr of uniqueDates) {
      const entryDate = new Date(dateStr);
      entryDate.setHours(0, 0, 0, 0);
      
      const dayDiff = Math.floor((currentDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === streak) {
        streak++;
      } else if (dayDiff > streak) {
        break;
      }
    }
    return streak;
  };

  // Filter entries by time range
  const getFilteredEntries = (): JournalEntry[] => {
    const now = new Date();
    let cutoff = new Date();
    
    switch (timeRange) {
      case "Week":
        cutoff.setDate(now.getDate() - 7);
        break;
      case "Month":
        cutoff.setMonth(now.getMonth() - 1);
        break;
      case "3 Months":
        cutoff.setMonth(now.getMonth() - 3);
        break;
      default:
        return entries; // All Time
    }
    
    return entries.filter(entry => new Date(entry.created_at) >= cutoff);
  };

  // Get sentiment of an entry
  const getEntrySentiment = (entry: JournalEntry): "positive" | "negative" | "distress" => {
    const analysis = analyzeEntry(entry.content, entry.mood);
    return analysis.sentiment;
  };

  // Get analysis of an entry
  const getEntryAnalysis = (entry: JournalEntry) => {
    return analyzeEntry(entry.content, entry.mood);
  };

  // Get emotion category for an entry
  const getEmotionCategory = (entry: JournalEntry): keyof typeof moodColors => {
    const sentiment = getEntrySentiment(entry);
    const mood = entry.mood;
    
    if (sentiment === "positive") {
      return "Joy & Hope";
    } else if (sentiment === "negative") {
      if (mood === "Anxious" || mood === "Overwhelmed") {
        return "Anxiety / Stress";
      }
      return "Uncertainty";
    }
    // Distress case
    if (sentiment === "distress") {
      return "Anxiety / Stress";
    }
    return "Uncertainty";
  };

  // Calculate statistics
  const filteredEntries = getFilteredEntries();
  const totalEntries = filteredEntries.length;
  
  // Positive percentage
  const positiveCount = filteredEntries.filter(entry => getEntrySentiment(entry) === "positive").length;
  const positivePercentage = totalEntries > 0 ? Math.round((positiveCount / totalEntries) * 100) : 0;
  
  // Streak
  const currentStreak = calculateStreak();
  
  // Mood trend (using our enhanced analysis)
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekEntries = entries.filter(entry => new Date(entry.created_at) >= lastWeek);
  const avgScoreLastWeek = lastWeekEntries.length > 0 
    ? lastWeekEntries.reduce((sum, entry) => {
        const analysis = getEntryAnalysis(entry);
        return sum + (analysis.sentimentScore / 10); // convert 0-100 to 0-10
      }, 0) / lastWeekEntries.length 
    : 5;
  const moodGrowth = Math.round((avgScoreLastWeek - 5) * 10);
  
  // Emotion distribution
  const emotionDistribution: Record<string, number> = {
    "Joy & Hope": 0,
    "Uncertainty": 0,
    "Anxiety / Stress": 0
  };
  
  filteredEntries.forEach(entry => {
    const category = getEmotionCategory(entry);
    emotionDistribution[category]++;
  });

  // Direction of change for "Mood Trajectory": compares the first and last
  // recorded points in the selected range, using real mood_logs /
  // journal_entries scores only — never randomized or placeholder values.
  const moodTrend = (() => {
    const validPoints = moodTrendData.filter(p => p.score !== null);
    if (validPoints.length < 2) {
      return { direction: validPoints.length === 1 ? "flat" : "none" } as const;
    }
    const diff = (validPoints[validPoints.length - 1].score as number) - (validPoints[0].score as number);
    if (diff > 0.3) return { direction: "up" } as const;
    if (diff < -0.3) return { direction: "down" } as const;
    return { direction: "flat" } as const;
  })();

  // Top keywords (simplified)
  const extractKeywords = () => {
    const stopWords = ["the", "a", "and", "of", "to", "in", "for", "is", "are", "on", "with", "that", "this"];
    const wordCount: Record<string, number> = {};
    
    filteredEntries.forEach(entry => {
      if (entry.content) {
        const words = entry.content.toLowerCase().split(/\W+/).filter(word => word.length > 2 && !stopWords.includes(word));
        words.forEach(word => {
          wordCount[word] = (wordCount[word] || 0) + 1;
        });
      }
    });
    
    return Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([word]) => ({
        word,
        color: ["#A8DADC", "#CDB4DB", "#B8E0D2", "#B7E4C7", "#F4A6A6"][Math.floor(Math.random() * 5)]
      }));
  };

  const topKeywords = extractKeywords();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-dark-text/70">Loading your insights...</p>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <PageHeader
        title="Mood Insights"
        subtitle="Your emotional journey over time"
        actions={TIME_RANGES.map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-3 py-1.5 rounded-full text-xs font-poppins transition-all ${
              timeRange === range
                ? "bg-[#A8DADC] text-white shadow-md"
                : "bg-gray-100 text-dark-text/60 hover:bg-[#F5F5F5]"
            }`}
          >
            {range}
          </button>
        ))}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-text/70 text-xs font-poppins mb-1">Total Entries</p>
              <p className="text-2xl font-bold text-dark-text">{totalEntries}</p>
            </div>
            <div className="w-10 h-10 bg-[#A8DADC]/30 rounded-full flex items-center justify-center">
              <span className="text-lg">📝</span>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-text/70 text-xs font-poppins mb-1">Positive Entries</p>
              <p className="text-2xl font-bold text-dark-text">{positivePercentage}%</p>
            </div>
            <div className="w-10 h-10 bg-[#B7E4C7]/40 rounded-full flex items-center justify-center">
              <span className="text-lg">😊</span>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-text/70 text-xs font-poppins mb-1">Current Streak</p>
              <p className="text-2xl font-bold text-dark-text">{currentStreak}</p>
            </div>
            <div className="w-10 h-10 bg-[#FFE8A1]/40 rounded-full flex items-center justify-center">
              <span className="text-lg">🔥</span>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-text/70 text-xs font-poppins mb-1">Mood Growth</p>
              <p className="text-2xl font-bold text-dark-text">
                {moodGrowth > 0 ? "+" : ""}{moodGrowth}%
              </p>
            </div>
            <div className="w-10 h-10 bg-[#CDB4DB]/30 rounded-full flex items-center justify-center">
              <span className="text-lg">📈</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Mood Trajectory Chart */}
          <Card className="p-6 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70">
                Mood Trajectory — This {timeRange}
              </h3>
              {moodTrend.direction !== "none" && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-poppins ${
                    moodTrend.direction === "up"
                      ? "bg-success-green/20 text-success-dark"
                      : moodTrend.direction === "down"
                      ? "bg-[#F4A6A6]/20 text-[#F4A6A6]"
                      : "bg-light-gray text-dark-text/60"
                  }`}
                >
                  {moodTrend.direction === "up" ? "↑ Improving" : moodTrend.direction === "down" ? "↓ Declining" : "→ Stable"}
                  {moodTrendAvg !== null && ` · Avg ${moodTrendAvg}`}
                </span>
              )}
            </div>
            <WeeklyMoodChart
              data={moodTrendData}
              loading={moodTrendLoading}
              hasData={moodTrendHasData}
              heightClassName="h-52"
              ticks={moodTrendTicks}
              emptyMessage={
                timeRange === "Week"
                  ? "No mood entries recorded this week."
                  : timeRange === "Month"
                  ? "No mood entries recorded this month."
                  : timeRange === "3 Months"
                  ? "No mood entries recorded in the last 3 months."
                  : "No mood entries recorded yet."
              }
            />
          </Card>

          {/* Journaling Calendar (simplified) */}
          <Card className="p-6 bg-white">
            <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-4 flex items-center gap-2">
              <span>🗓️</span>
              Journaling Calendar — {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h3>
            <div className="mb-4 grid grid-cols-7 gap-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                <div key={i} className="text-center text-[10px] font-poppins text-[#4F4F4F]/60 py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => {
                const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay();
                let date = i - firstDayOfMonth + 1;
                let color = "bg-white border border-[#F5F5F5]";
                
                // Check if this date has an entry
                const currentYear = new Date().getFullYear();
                const currentMonth = new Date().getMonth();
                const entryDate = new Date(currentYear, currentMonth, date);
                
                const hasEntry = entries.some(entry => {
                  const eDate = new Date(entry.created_at);
                  return eDate.toDateString() === entryDate.toDateString();
                });
                
                if (date < 1 || date > new Date(currentYear, currentMonth + 1, 0).getDate()) {
                  color = "bg-transparent border-none";
                } else if (hasEntry) {
                  // Get sentiment for that day
                  const dayEntries = entries.filter(entry => {
                    const eDate = new Date(entry.created_at);
                    return eDate.toDateString() === entryDate.toDateString();
                  });
                  
                  if (dayEntries.length > 0) {
                    const sentiment = getEntrySentiment(dayEntries[0]);
                    if (sentiment === "positive") {
                      color = "bg-[#A8DADC]";
                    } else if (sentiment === "negative") {
                      color = "bg-[#F4A6A6]";
                    } else if (sentiment === "distress") {
                      color = "bg-[#fca5a5]";
                    }
                  }
                }
                
                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-sm flex items-center justify-center text-[10px] font-inter text-[#4F4F4F] ${color}`}
                  >
                    {date >= 1 && date <= new Date(currentYear, currentMonth + 1, 0).getDate() ? date : ""}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Emotion Distribution */}
          <Card className="p-6 bg-white">
            <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-6 flex items-center gap-2">
              <span>🎨</span>
              Emotion Distribution
            </h3>
            <div className="flex items-center gap-6">
              {/* Pie Chart */}
              <div className="relative w-32 h-32">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="25" fill="white" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xl font-dm-serif text-[#4F4F4F]">{positivePercentage}%</p>
                    <p className="text-[10px] font-inter text-[#4F4F4F]/60">Positive</p>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-2">
                {Object.entries(emotionDistribution).map(([label, count]) => {
                  const percentage = totalEntries > 0 ? Math.round((count / totalEntries) * 100) : 0;
                  return (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: moodColors[label as keyof typeof moodColors] }}></div>
                        <span className="text-xs font-inter text-[#4F4F4F]">{label}</span>
                      </div>
                      <span className="text-xs font-poppins text-[#4F4F4F]/70">{percentage}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Top Emotional Keywords */}
          <Card className="p-6 bg-white">
            <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-4 flex items-center gap-2">
              <span>🔤</span>
              Top Emotional Keywords
            </h3>
            <div className="flex flex-wrap gap-2">
              {topKeywords.map((keyword, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-full text-xs font-inter text-[#4F4F4F]"
                  style={{ backgroundColor: `${keyword.color}40` }}
                >
                  {keyword.word}
                </span>
              ))}
            </div>

            {/* Emotional Trend */}
            <div className="mt-6 pt-4 border-t border-[#F5F5F5]">
              <h4 className="text-xs font-poppins uppercase tracking-wider text-[#4F4F4F]/60 mb-4 flex items-center gap-2">
                <span>📉</span>
                Emotional Trend
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-inter text-[#4F4F4F] mb-1">
                    <span>Positivity trend</span>
                    <span className={positivePercentage >= 50 ? "text-[#A8DADC]" : "text-[#F4A6A6]"}>
                      {positivePercentage >= 50 ? "↑ Growing" : "↓ Decreasing"}
                    </span>
                  </div>
                  <div className="h-2 bg-[#d8e2ed] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary-blue to-success-green rounded-full" style={{ width: `${positivePercentage}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-inter text-[#4F4F4F] mb-1">
                    <span>Stress levels</span>
                    <span className="text-[#F4A6A6]">
                      {positivePercentage >= 50 ? "↓ Decreasing" : "↑ Increasing"}
                    </span>
                  </div>
                  <div className="h-2 bg-[#d8e2ed] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-error-red to-warning-yellow rounded-full" style={{ width: `${100 - positivePercentage}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
