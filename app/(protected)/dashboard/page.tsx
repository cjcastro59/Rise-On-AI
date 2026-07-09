"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoodCard } from "@/components/dashboard/mood-card";
import { InsightCard } from "@/components/dashboard/insight-card";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getSentimentFromMood, analyzeSentiment } from "@/lib/sentiment";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Friend");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [todayMood, setTodayMood] = useState<string | null>(null);
  const [todayEntryPreview, setTodayEntryPreview] = useState<any | null>(null);
  const [stats, setStats] = useState({
    streak: 0,
    totalEntries: 0,
    avgMoodScore: 0,
    positivityThisWeek: 0
  });
  const [weekData, setWeekData] = useState<any[]>([]);
  const { user } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient() as any, []);

  const moodOptions = useMemo(() => [
    { label: "Happy", icon: "😊", score: 10 },
    { label: "Calm", icon: "😌", score: 8 },
    { label: "Excited", icon: "🎉", score: 9 },
    { label: "Anxious", icon: "😰", score: 3 },
    { label: "Sad", icon: "😢", score: 2 },
    { label: "Frustrated", icon: "😤", score: 4 },
    { label: "Overwhelmed", icon: "😵", score: 1 },
    { label: "Confused", icon: "😕", score: 5 },
  ], []);

  const calculateStreak = useCallback((entries: any[]) => {
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
  }, []);

  const calculateStats = useCallback((entries: any[]) => {
    const totalEntries = entries.length;

    let totalScore = 0;
    let scoreCount = 0;
    entries.forEach(entry => {
      if (entry.mood) {
          const moodOption = moodOptions.find(m => m.label === entry.mood);
          if (moodOption) {
            totalScore += moodOption.score;
            scoreCount++;
          }
        } else {
          const sentiment = analyzeSentiment(entry.content || "");
          if (sentiment === "positive") {
            totalScore += 8;
            scoreCount++;
          } else if (sentiment === "negative" || sentiment === "distress") {
            totalScore += 2;
            scoreCount++;
          }
        }
    });
    const avgMoodScore = scoreCount > 0 ? parseFloat((totalScore / scoreCount).toFixed(1)) : 0;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekEntries = entries.filter(entry => new Date(entry.created_at) >= weekAgo);

    let positiveCount = 0;
    thisWeekEntries.forEach(entry => {
      let sentiment = analyzeSentiment(entry.content || "");
      if (entry.mood) {
        sentiment = getSentimentFromMood(entry.mood);
      }
      if (sentiment === "positive") positiveCount++;
    });
    const positivityThisWeek = thisWeekEntries.length > 0 ? Math.round((positiveCount / thisWeekEntries.length) * 100) : 0;

    return {
      streak: calculateStreak(entries),
      totalEntries,
      avgMoodScore,
      positivityThisWeek
    };
  }, [calculateStreak, moodOptions]);

  const calculateWeekData = useCallback((entries: any[]) => {
    const week = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);

      const dayEntries = entries.filter(entry => {
        const entryDate = new Date(entry.created_at);
        return entryDate >= date && entryDate < nextDate;
      });

      let avgScore = 0;
      if (dayEntries.length > 0) {
        let totalScore = 0;
        let count = 0;
        dayEntries.forEach(entry => {
          if (entry.mood) {
            const moodOption = moodOptions.find(m => m.label === entry.mood);
            if (moodOption) {
              totalScore += moodOption.score;
              count++;
            }
          } else {
            const sentiment = analyzeSentiment(entry.content || "");
            if (sentiment === "positive") {
              totalScore += 8;
              count++;
            } else if (sentiment === "negative" || sentiment === "distress") {
              totalScore += 2;
              count++;
            }
          }
        });
        avgScore = count > 0 ? totalScore / count : 0;
      }

      week.push({
        date: date.toLocaleDateString(undefined, { weekday: 'short' }),
        score: avgScore
      });
    }
    return week;
  }, [moodOptions]);

  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch user profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profile) {
      setUserName(profile?.first_name || profile?.username || user.email?.split("@")[0] || "Friend");
    }

    // Fetch journal entries for stats
    const { data: entries } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Calculate stats
    const calculatedStats = calculateStats(entries || []);
    setStats(calculatedStats);

    // Get today's mood and the latest entry from today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayEntry = (entries || []).find((entry: any) => {
      const entryDate = new Date(entry.created_at);
      return entryDate >= todayStart && entryDate <= todayEnd;
    });

    if (todayEntry?.mood) {
      setTodayMood(todayEntry.mood);
      setSelectedMood(todayEntry.mood);
    }

    setTodayEntryPreview(todayEntry || null);

    // Prepare week data for chart
    const week = calculateWeekData(entries || []);
    setWeekData(week);

    setLoading(false);
  }, [calculateStats, calculateWeekData, user, supabase]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleSaveMood = (mood: string) => {
    setSelectedMood(mood);
    setTodayMood(mood);
    router.push(`/journal?mood=${encodeURIComponent(mood)}`);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-dark-text/70">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <>
      {/* Top Header */}
      <header className="flex items-center justify-between mb-8 bg-white rounded-2xl px-6 py-4 shadow-sm border border-light-gray">
        <nav className="flex items-center gap-4">
          <Link href="/dashboard" className="text-dark-text text-sm font-poppins font-semibold">Home</Link>
          <Link href="/journal" className="text-dark-text/60 text-sm font-poppins font-medium hover:text-primary-blue">Journal</Link>
          <Link href="/insights" className="text-dark-text/60 text-sm font-poppins font-medium hover:text-primary-blue">Insights</Link>
          <Link href="/journal/history" className="text-dark-text/60 text-sm font-poppins font-medium hover:text-primary-blue">History</Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/support" className="px-4 py-2 bg-pink-100 text-pink-60 rounded-full text-xs font-poppins font-semibold flex items-center gap-2 hover:bg-pink-200 transition-all">
            <Image src="/icons/crisis-report.svg" alt="Crisis Support" width={16} height={16} className="object-contain" />
            Crisis Support
          </Link>
          <div className="w-10 h-10 bg-gradient-to-r from-primary-blue to-lavender rounded-full flex items-center justify-center text-white font-poppins font-semibold">
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-dm-serif text-dark-text mb-2">
          {getGreeting()}, {userName.split(" ")[0]}!
        </h1>
        <p className="text-dark-text/70 text-sm font-inter flex items-center gap-2">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          <span className="mx-2">•</span>
          How are you feeling today?
        </p>
        <div className="flex flex-wrap items-center gap-4 mt-3">
          {moodOptions.map((mood) => (
            <MoodCard
              key={mood.label}
              mood={mood.label}
              icon={mood.icon}
              selected={selectedMood === mood.label}
              onClick={() => handleSaveMood(mood.label)}
            />
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-text/60 text-xs font-poppins mb-1">Streak</p>
              <p className="text-2xl font-dm-serif text-dark-text">{stats.streak}</p>
            </div>
            <div className="w-12 h-12 bg-warning-yellow/30 rounded-xl flex items-center justify-center">
              <Image src="/icons/streak.svg" alt="Streak" width={24} height={24} className="object-contain" />
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-text/60 text-xs font-poppins mb-1">Total Entries</p>
              <p className="text-2xl font-dm-serif text-dark-text">{stats.totalEntries}</p>
            </div>
            <div className="w-12 h-12 bg-primary-blue/30 rounded-xl flex items-center justify-center">
              <Image src="/icons/entries.svg" alt="Entries" width={24} height={24} className="object-contain" />
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-text/60 text-xs font-poppins mb-1">Avg. Mood Score</p>
              <p className="text-2xl font-dm-serif text-dark-text">{stats.avgMoodScore}</p>
            </div>
            <div className="w-12 h-12 bg-lavender/30 rounded-xl flex items-center justify-center">
              <Image src="/icons/mood.svg" alt="Mood" width={24} height={24} className="object-contain" />
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-text/60 text-xs font-poppins mb-1">Positivity This Week</p>
              <p className="text-2xl font-dm-serif text-dark-text">{stats.positivityThisWeek}%</p>
            </div>
            <div className="w-12 h-12 bg-success-green/30 rounded-xl flex items-center justify-center">
              <Image src="/icons/trends.svg" alt="Trends" width={24} height={24} className="object-contain" />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Journal Preview */}
        <Card className="p-6 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-poppins font-semibold text-dark-text">Today&apos;s Journal</h3>
            <span className="text-xs font-poppins text-dark-text/60">Tap to open</span>
          </div>

          {todayEntryPreview ? (
            <button
              type="button"
              onClick={() => router.push(`/journal/${todayEntryPreview.id}`)}
              className="w-full text-left rounded-xl border border-light-gray bg-light-gray/40 p-4 transition-all hover:border-primary-blue/40 hover:bg-primary-blue/10"
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-poppins font-semibold text-dark-text">
                  {todayEntryPreview.title || "Untitled Entry"}
                </p>
                {todayEntryPreview.mood && (
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-poppins text-dark-text shadow-sm">
                    {todayEntryPreview.mood}
                  </span>
                )}
              </div>
              <p className="text-sm font-inter text-dark-text/70 leading-relaxed whitespace-pre-wrap line-clamp-5">
                {todayEntryPreview.content?.trim() || "Open this entry to read or continue writing."}
              </p>
              <p className="mt-3 text-xs font-poppins text-primary-blue">Open entry →</p>
            </button>
          ) : (
            <div className="rounded-xl border border-dashed border-light-gray bg-light-gray/40 p-6 text-center">
              <p className="text-sm font-poppins font-semibold text-dark-text">No entries made yet today</p>
              <p className="mt-2 text-sm font-inter text-dark-text/70">Choose an emotion to start a new journal entry.</p>
            </div>
          )}
        </Card>

        {/* Mood Chart */}
        <Card className="p-6 bg-white">
          <h3 className="font-poppins font-semibold text-dark-text mb-4">Your Mood This Week</h3>
          <div className="h-48 bg-gradient-to-r from-header-bg to-lavender/20 rounded-xl flex items-end justify-around px-4 pb-4">
            {weekData.map((day, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <div
                  className="w-8 rounded-t-lg transition-all duration-300"
                  style={{
                    height: `${(day.score / 10) * 100}%`,
                    background: day.score > 7
                      ? 'linear-gradient(to top, #10b981, #34d399)'
                      : day.score > 4
                        ? 'linear-gradient(to top, #8b5cf6, #a78bfa)'
                        : 'linear-gradient(to top, #ef4444, #f87171)'
                  }}
                />
                <span className="text-xs font-inter text-dark-text/60">{day.date}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* AI Insight */}
        <InsightCard
          title="Daily Insight"
          content={
            stats.totalEntries > 0
              ? "You've been consistent with your journaling! Keep up the great work — it helps with self-reflection and emotional awareness."
              : "Start your journaling journey today! Write about your thoughts and feelings."
          }
          icon="💡"
        />

        {/* Quick Actions */}
        <Card className="p-6 bg-white">
          <h3 className="font-poppins font-semibold text-dark-text mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link href="/journal" className="flex items-center gap-3 p-3 bg-light-gray/30 rounded-xl hover:bg-light-gray transition-all">
              <Image src="/icons/new-entry.svg" alt="Write New Entry" width={20} height={20} className="object-contain" />
              <div className="flex-1">
                <p className="font-poppins font-medium text-dark-text text-sm">Write New Entry</p>
                <p className="text-xs text-dark-text/60 font-inter">Express your thoughts freely</p>
              </div>
            </Link>
            <Link href="/journal/history" className="flex items-center gap-3 p-3 bg-light-gray/30 rounded-xl hover:bg-light-gray transition-all">
              <Image src="/icons/journal.svg" alt="View History" width={20} height={20} className="object-contain" />
              <div className="flex-1">
                <p className="font-poppins font-medium text-dark-text text-sm">View History</p>
                <p className="text-xs text-dark-text/60 font-inter">See your past entries</p>
              </div>
            </Link>
            <Link href="/insights" className="flex items-center gap-3 p-3 bg-light-gray/30 rounded-xl hover:bg-light-gray transition-all">
              <Image src="/icons/mood-insights.svg" alt="View Insights" width={20} height={20} className="object-contain" />
              <div className="flex-1">
                <p className="font-poppins font-medium text-dark-text text-sm">View Insights</p>
                <p className="text-xs text-dark-text/60 font-inter">Analyze your mood trends</p>
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
