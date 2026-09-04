"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoodCard } from "@/components/dashboard/mood-card";
import { InsightCard } from "@/components/dashboard/insight-card";
import PageHeader from "@/components/layout/PageHeader";
import WeeklyMoodChart from "@/components/dashboard/WeeklyMoodChart";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMoodTrend } from "@/hooks/useMoodTrend";
import { useWellnessAssessment } from "@/hooks/useWellnessAssessment";
import { getSentimentFromMood } from "@/lib/sentiment";
import { WELLNESS_LEVEL_CONFIG, type WellnessLevel } from "@/lib/wellness-assessment";

// ── Compact sparkline (SVG path, no library needed) ──────────────────────────
function WellnessSparkline({
  points,
  color,
}: {
  points: number[];  // values 0-10, oldest-first
  color: string;
}) {
  if (points.length < 2) return null;
  const W = 80;
  const H = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const xs = points.map((_, i) => (i / (points.length - 1)) * W);
  const ys = points.map((v) => H - ((v - min) / range) * (H - 4) - 2);
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={xs[xs.length - 1].toFixed(1)}
        cy={ys[ys.length - 1].toFixed(1)}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

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
  const { user } = useAuth();
  const { data: weekData, loading: weekMoodLoading, hasData: weekMoodHasData } = useMoodTrend("Week");
  const {
    latest:  wellnessLatest,
    history: wellnessHistory,
    loading: wellnessLoading,
  } = useWellnessAssessment(30, 7);   // last 7 compute dates for sparkline
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

    // Use the ML-predicted sentiment_score column for avg mood, and the
    // sentiment column for positivity — no keyword analysis.
    const toScore = (entry: any): number => {
      if (entry.sentiment_score != null) return entry.sentiment_score / 10;
      const s = (entry.sentiment as string | null) ?? getSentimentFromMood(entry.mood);
      if (s === "positive") return 7.5;
      if (s === "distress") return 1.0;
      return 3.5;
    };

    let totalScore = 0;
    entries.forEach(entry => { totalScore += toScore(entry); });
    const avgMoodScore = entries.length > 0 ? parseFloat((totalScore / entries.length).toFixed(1)) : 0;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekEntries = entries.filter(entry => new Date(entry.created_at) >= weekAgo);

    let positiveCount = 0;
    thisWeekEntries.forEach(entry => {
      const s = (entry.sentiment as string | null) ?? getSentimentFromMood(entry.mood);
      if (s === "positive") positiveCount++;
    });
    const positivityThisWeek = thisWeekEntries.length > 0 ? Math.round((positiveCount / thisWeekEntries.length) * 100) : 0;

    return {
      streak: calculateStreak(entries),
      totalEntries,
      avgMoodScore,
      positivityThisWeek
    };
  }, [calculateStreak]);

  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profile) {
      setUserName(profile?.first_name || profile?.username || user.email?.split("@")[0] || "Friend");
    }

    const { data: entries } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const calculatedStats = calculateStats(entries || []);
    setStats(calculatedStats);

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
    setLoading(false);
  }, [calculateStats, user, supabase]);

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

  // Wellness display values
  const wellnessCfg = wellnessLatest?.wellness_level
    ? WELLNESS_LEVEL_CONFIG[wellnessLatest.wellness_level as WellnessLevel]
    : null;
  // Sparkline: oldest → newest (history is newest-first, reverse it)
  const sparklinePoints = wellnessHistory
    .filter(r => r.wellness_score !== null)
    .slice()
    .reverse()
    .map(r => r.wellness_score as number);

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
      <header className="flex items-center justify-between mb-8 bg-white rounded-2xl px-6 py-5 shadow-sm border border-gray-100">
        <div className="w-40"></div>
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
        </div>
      </header>

      {/* Welcome Section */}
      <PageHeader
        title={`${getGreeting()}, ${userName.split(" ")[0]}!`}
        subtitle={
          <>
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            <span className="mx-2">•</span>
            How are you feeling today?
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-4 mb-8">
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

      {/* ── Wellness Assessment Banner ─────────────────────────────────────── */}
      <div
        className="mb-8 rounded-2xl border border-light-gray shadow-sm overflow-hidden"
        style={{ borderLeftWidth: 4, borderLeftStyle: "solid", borderLeftColor: wellnessCfg?.borderColor ?? "#e5e7eb" }}
      >
      <Card className="px-6 py-4 bg-white transition-all" variant="white">
        {wellnessLoading ? (
          <p className="text-xs text-dark-text/50 py-1">Loading wellness data…</p>
        ) : !wellnessLatest || wellnessLatest.wellness_score === null ? (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-poppins font-semibold text-dark-text/70 uppercase tracking-wider mb-0.5">
                Wellness Assessment
              </p>
              <p className="text-sm text-dark-text/60 font-inter">
                No data yet — write your first journal entry to get your Wellness Score.
              </p>
            </div>
            <Link href="/journal">
              <Button size="sm" variant="secondary" className="text-xs border-[#A8DADC] text-[#4EAAB3] hover:bg-[#A8DADC]/10 whitespace-nowrap">
                Start Journaling →
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-6 flex-wrap">
            {/* Left: score + level */}
            <div className="flex items-center gap-4">
              {/* Score badge */}
              <div
                className="flex flex-col items-center justify-center w-14 h-14 rounded-xl font-bold shrink-0"
                style={{
                  backgroundColor: wellnessCfg!.bgColor,
                  color:           wellnessCfg!.color,
                }}
              >
                <span className="text-xl leading-none">
                  {wellnessLatest.wellness_score!.toFixed(1)}
                </span>
                <span className="text-[9px] font-normal opacity-70 leading-none mt-0.5">/10</span>
              </div>
              {/* Label */}
              <div>
                <p className="text-[10px] font-poppins font-semibold uppercase tracking-wider text-dark-text/50 mb-0.5">
                  Wellness Assessment
                </p>
                <p
                  className="text-base font-poppins font-semibold"
                  style={{ color: wellnessCfg!.color }}
                >
                  {wellnessCfg!.emoji} {wellnessLatest.wellness_level}
                </p>
                <p className="text-xs text-dark-text/60 font-inter mt-0.5 max-w-xs">
                  {wellnessCfg!.description}
                </p>
              </div>
            </div>

            {/* Centre: sparkline trend */}
            {sparklinePoints.length >= 2 && (
              <div className="flex flex-col items-center gap-1">
                <WellnessSparkline
                  points={sparklinePoints}
                  color={wellnessCfg!.color}
                />
                <span className="text-[10px] text-dark-text/40 font-inter">
                  Last {sparklinePoints.length} updates
                </span>
              </div>
            )}

            {/* Right: metadata + link */}
            <div className="flex flex-col items-end gap-1.5 ml-auto">
              <p className="text-[10px] text-dark-text/40 font-inter">
                {wellnessLatest.entries_analyzed} entries · last 30 days
              </p>
              <p className="text-[10px] text-dark-text/40 font-inter">
                Updated {new Date(wellnessLatest.updated_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric",
                })}
              </p>
              <Link href="/insights" className="text-xs font-poppins text-[#4EAAB3] hover:underline mt-0.5">
                View full details →
              </Link>
            </div>
          </div>
        )}
      </Card>
      </div>
      {/* ── END Wellness Banner ────────────────────────────────────────────── */}

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
          <WeeklyMoodChart data={weekData} loading={weekMoodLoading} hasData={weekMoodHasData} />
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
            <Link href="/mood-trends" className="flex items-center gap-3 p-3 bg-light-gray/30 rounded-xl hover:bg-light-gray transition-all">
              <Image src="/icons/trends.svg" alt="Mood Trends" width={20} height={20} className="object-contain" />
              <div className="flex-1">
                <p className="font-poppins font-medium text-dark-text text-sm">Mood Trends</p>
                <p className="text-xs text-dark-text/60 font-inter">Charts: distribution, wellness, risk</p>
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
