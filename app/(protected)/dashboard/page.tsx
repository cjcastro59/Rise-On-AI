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
import { MOOD_OPTIONS } from "@/lib/mood";
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
  const [announcements, setAnnouncements] = useState<
    { id: string; title: string; content: string; created_at: string }[]
  >([]);
  const [announcementsExpanded, setAnnouncementsExpanded] = useState(true);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [todayMood, setTodayMood] = useState<string | null>(null);
  const [todayEntryPreview, setTodayEntryPreview] = useState<any | null>(null);
  const [showAllMoods, setShowAllMoods] = useState(false);
  const [stats, setStats] = useState({
    streak: 0,
    totalEntries: 0,
    avgMoodScore: 0,
    positivityThisWeek: 0
  });
  const { user } = useAuth();
  const { data: weekData, loading: weekMoodLoading, hasData: weekMoodHasData } = useMoodTrend("Week");
  const {
    latest: wellnessLatest,
    history: wellnessHistory,
    loading: wellnessLoading,
  } = useWellnessAssessment(30, 7);   // last 7 compute dates for sparkline
  const router = useRouter();
  const supabase = useMemo(() => createClient() as any, []);

  const loadAnnouncements = useCallback(async () => {
    const { data, error } = await supabase
      .from("announcements")
      .select("id,title,content,created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Failed to load announcements:", error);
      return;
    }
    setAnnouncements(data || []);
  }, [supabase]);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  useEffect(() => {
    const channel = supabase
      .channel("member-announcements")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        (payload: {
          eventType: string;
          old: { id: string };
          new: { id: string; is_active: boolean };
        }) => {
          if (payload.eventType !== "DELETE" && payload.new.is_active) return;
          const announcementId =
            payload.eventType === "DELETE" ? payload.old.id : payload.new.id;
          setAnnouncements((prev) =>
            prev.filter((announcement) => announcement.id !== announcementId)
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const moodOptions = useMemo(() =>
    MOOD_OPTIONS.map((m) => ({ label: m.label, icon: m.emoji, score: m.score * 2 }))
  , []);

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
        <p className="text-slate-700">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <>
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
      {announcements.length > 0 && (
        <Card className="mb-6 border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setAnnouncementsExpanded((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <h2 className="text-sm font-semibold font-poppins text-slate-800">
              Announcements
              <span className="ml-2 text-xs font-normal text-slate-600">({announcements.length})</span>
            </h2>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 text-slate-600 transition-transform duration-200 ${announcementsExpanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {announcementsExpanded && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
              {announcements.map((announcement) => (
                <article key={announcement.id} className="rounded-xl border border-amber-200 bg-white p-3">
                  <h3 className="text-sm font-semibold font-poppins text-slate-900">
                    {announcement.title}
                  </h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-inter text-slate-700">
                    {announcement.content}
                  </p>
                  <time
                    dateTime={announcement.created_at}
                    className="mt-2 block text-xs font-inter text-slate-600"
                  >
                    {new Date(announcement.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                </article>
              ))}
            </div>
          )}
        </Card>
      )}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {(showAllMoods ? moodOptions : moodOptions.slice(0, 8)).map((mood) => (
            <MoodCard
              key={mood.label}
              mood={mood.label}
              icon={mood.icon}
              selected={selectedMood === mood.label}
              onClick={() => handleSaveMood(mood.label)}
            />
          ))}
        </div>
        {moodOptions.length > 8 && (
          <button
            type="button"
            onClick={() => setShowAllMoods((v) => !v)}
            className="mt-2 text-xs font-poppins text-[#4EAAB3] hover:underline"
          >
            {showAllMoods ? "Show less ↑" : `Show ${moodOptions.length - 8} more emotions ↓`}
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 animate-in fade-in duration-200">
        <Card className="p-4 sm:p-5 bg-white/80 backdrop-blur-md border border-white/40 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-xs font-poppins mb-1">Streak</p>
              <p className="text-2xl font-dm-serif text-dark-text">{stats.streak}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-warning-yellow/30 rounded-xl flex items-center justify-center">
              <Image src="/icons/streak.svg" alt="Streak" width={20} height={20} className="object-contain" />
            </div>
          </div>
        </Card>
        <Card className="p-4 sm:p-5 bg-white/80 backdrop-blur-md border border-white/40 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-xs font-poppins mb-1">Total Entries</p>
              <p className="text-2xl font-dm-serif text-dark-text">{stats.totalEntries}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-blue/30 rounded-xl flex items-center justify-center">
              <Image src="/icons/entries.svg" alt="Entries" width={20} height={20} className="object-contain" />
            </div>
          </div>
        </Card>
        <Card className="p-4 sm:p-5 bg-white/80 backdrop-blur-md border border-white/40 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-xs font-poppins mb-1">Avg. Mood Score</p>
              <p className="text-2xl font-dm-serif text-dark-text">{stats.avgMoodScore}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-lavender/30 rounded-xl flex items-center justify-center">
              <Image src="/icons/mood.svg" alt="Mood" width={20} height={20} className="object-contain" />
            </div>
          </div>
        </Card>
        <Card className="p-4 sm:p-5 bg-white/80 backdrop-blur-md border border-white/40 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-xs font-poppins mb-1">Positivity This Week</p>
              <p className="text-2xl font-dm-serif text-dark-text">{stats.positivityThisWeek}%</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-success-green/30 rounded-xl flex items-center justify-center">
              <Image src="/icons/trends.svg" alt="Trends" width={20} height={20} className="object-contain" />
            </div>
          </div>
        </Card>
      </div>

      {/* ── Wellness Assessment Banner ─────────────────────────────────────── */}
      <div
        className="mb-8 rounded-2xl border border-white/40 bg-white/80 shadow-sm backdrop-blur-md overflow-hidden"
        style={{ borderLeftWidth: 4, borderLeftStyle: "solid", borderLeftColor: wellnessCfg?.borderColor ?? "#e5e7eb" }}
      >
        <Card className="px-6 py-4 bg-white/80 backdrop-blur-md transition-all" variant="white">
          {wellnessLoading ? (
            <p className="text-xs text-slate-600 py-1">Loading wellness data…</p>
          ) : !wellnessLatest || wellnessLatest.wellness_score === null ? (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-poppins font-semibold text-slate-700 uppercase tracking-wider mb-0.5">
                  Wellness Assessment
                </p>
                <p className="text-sm text-slate-600 font-inter">
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
                    color: wellnessCfg!.color,
                  }}
                >
                  <span className="text-xl leading-none">
                    {wellnessLatest.wellness_score!.toFixed(1)}
                  </span>
                  <span className="text-xs font-normal opacity-70 leading-none mt-0.5">/10</span>
                </div>
                {/* Label */}
                <div>
                  <p className="text-xs font-poppins font-semibold uppercase tracking-wider text-slate-600 mb-0.5">
                    Wellness Assessment
                  </p>
                  <p
                    className="text-base font-poppins font-semibold"
                    style={{ color: wellnessCfg!.color }}
                  >
                    {wellnessCfg!.emoji} {wellnessLatest.wellness_level}
                  </p>
                  <p className="text-xs text-slate-600 font-inter mt-0.5 max-w-xs">
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
                  <span className="text-xs text-slate-600 font-inter">
                    Last {sparklinePoints.length} updates
                  </span>
                </div>
              )}

              {/* Right: metadata + link */}
              <div className="flex flex-col items-end gap-1.5 ml-auto">
                <p className="text-xs text-slate-600 font-inter">
                  {wellnessLatest.entries_analyzed} entries · last 30 days
                </p>
                <p className="text-xs text-slate-600 font-inter">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
        {/* Today's Journal Preview */}
        <Card className="p-6 bg-white/80 backdrop-blur-md border border-white/40 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-poppins font-semibold text-dark-text">Today&apos;s Journal</h3>
            <span className="text-xs font-poppins text-slate-600">Tap to open</span>
          </div>

          {todayEntryPreview ? (
            <button
              type="button"
              onClick={() => router.push(`/journal/${todayEntryPreview.id}`)}
              className="w-full text-left rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 transition-all hover:border-emerald-300 hover:bg-emerald-50"
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-poppins font-semibold text-dark-text">
                  {todayEntryPreview.title || "Untitled Entry"}
                </p>
                {todayEntryPreview.mood && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-poppins font-medium text-emerald-700 shadow-sm">
                    {todayEntryPreview.mood}
                  </span>
                )}
              </div>
              <p className="text-sm font-inter text-slate-700 leading-relaxed whitespace-pre-wrap line-clamp-5">
                {todayEntryPreview.content?.trim() || "Open this entry to read or continue writing."}
              </p>
              <p className="mt-3 text-xs font-poppins text-primary-blue">Open entry →</p>
            </button>
          ) : (
            <div className="rounded-xl border border-dashed border-light-gray bg-light-gray/40 p-6 text-center">
              <p className="text-sm font-poppins font-semibold text-dark-text">No entries made yet today</p>
              <p className="mt-2 text-sm font-inter text-slate-700">Choose an emotion to start a new journal entry.</p>
            </div>
          )}
        </Card>

        {/* Mood Chart */}
        <Card className="p-6 bg-white/80 backdrop-blur-md border border-white/40 shadow-sm">
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
        <Card className="p-6 bg-white/80 backdrop-blur-md border border-white/40 shadow-sm">
          <h3 className="font-poppins font-semibold text-dark-text mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link href="/journal" className="flex items-center gap-3 p-3 bg-emerald-50/70 rounded-xl border border-emerald-100 hover:bg-emerald-50 hover:-translate-y-0.5 hover:shadow-md active:scale-95 transition-all duration-200">
              <Image src="/icons/new-entry.svg" alt="Write New Entry" width={20} height={20} className="object-contain" />
              <div className="flex-1">
                <p className="font-poppins font-medium text-dark-text text-sm">Write New Entry</p>
                <p className="text-xs text-slate-600 font-inter">Express your thoughts freely</p>
              </div>
            </Link>
            <Link href="/journal/history" className="flex items-center gap-3 p-3 bg-sky-50/70 rounded-xl border border-sky-100 hover:bg-sky-50 hover:-translate-y-0.5 hover:shadow-md active:scale-95 transition-all duration-200">
              <Image src="/icons/journal.svg" alt="View History" width={20} height={20} className="object-contain" />
              <div className="flex-1">
                <p className="font-poppins font-medium text-dark-text text-sm">View History</p>
                <p className="text-xs text-slate-600 font-inter">See your past entries</p>
              </div>
            </Link>
            <Link href="/insights" className="flex items-center gap-3 p-3 bg-violet-50/70 rounded-xl border border-violet-100 hover:bg-violet-50 hover:-translate-y-0.5 hover:shadow-md active:scale-95 transition-all duration-200">
              <Image src="/icons/mood-insights.svg" alt="View Insights" width={20} height={20} className="object-contain" />
              <div className="flex-1">
                <p className="font-poppins font-medium text-dark-text text-sm">View Insights</p>
                <p className="text-xs text-slate-600 font-inter">Analyze your mood trends</p>
              </div>
            </Link>
            <Link href="/mood-trends" className="flex items-center gap-3 p-3 bg-amber-50/70 rounded-xl border border-amber-100 hover:bg-amber-50 hover:-translate-y-0.5 hover:shadow-md active:scale-95 transition-all duration-200">
              <Image src="/icons/trends.svg" alt="Mood Trends" width={20} height={20} className="object-contain" />
              <div className="flex-1">
                <p className="font-poppins font-medium text-dark-text text-sm">Mood Trends</p>
                <p className="text-xs text-slate-600 font-inter">Charts: distribution, wellness, risk</p>
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
