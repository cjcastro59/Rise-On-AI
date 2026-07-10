"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConfirmation } from "@/components/layout/ConfirmationModalProvider";
import { analyzeSentiment, getSentimentFromMood } from "@/lib/sentiment";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEntries: 0,
    positiveRate: 0,
    activeAlerts: 0,
    totalDistressLogs: 0,
    newUsersToday: 0,
  });
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [firstUserDate, setFirstUserDate] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [dauPeriod, setDauPeriod] = useState<"week" | "month">("month");
  const [dauData, setDauData] = useState<{ date: string; count: number }[]>([]);
  const [moodDistribution, setMoodDistribution] = useState<{
    positive: number;
    negative: number;
    distress: number;
  }>({ positive: 0, negative: 0, distress: 0 });
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const { user: currentUser } = useAuth();
  const { openConfirmation } = useConfirmation();
  const supabase = useMemo(() => createClient() as any, []);

  // Format date as "Thursday, May 28, 2026"
  const formatFullDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  useEffect(() => {
    setCurrentDate(formatFullDate(new Date()));
  }, []);

  // Load DAU and mood distribution
  const loadAnalyticsData = useCallback(async () => {
    try {
      const now = new Date();
      let startDate = new Date();

      if (dauPeriod === "week") {
        startDate.setDate(now.getDate() - 6); // Last 7 days
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Start of current month
      }

      // Fetch journal entries for the period
      const { data: journalData } = await supabase
        .from("journal_entries")
        .select("user_id, mood, content, created_at")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      // Calculate DAU
      const dauMap = new Map<string, Set<string>>();
      (journalData || []).forEach((entry: { created_at: string; user_id: string }) => {
        const date = new Date(entry.created_at).toLocaleDateString("en-US", { weekday: "short" });
        if (!dauMap.has(date)) dauMap.set(date, new Set());
        dauMap.get(date)!.add(entry.user_id);
      });

      // Build DAU array
      const dauArray: { date: string; count: number }[] = [];

      if (dauPeriod === "week") {
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const dateLabel = d.toLocaleDateString("en-US", { weekday: "short" });
          dauArray.push({ date: dateLabel, count: dauMap.get(dateLabel)?.size || 0 });
        }
      } else {
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
          const d = new Date(now.getFullYear(), now.getMonth(), i);
          const dateLabel = String(i);
          dauArray.push({ date: dateLabel, count: dauMap.get(dateLabel)?.size || 0 });
        }
      }

      setDauData(dauArray);

      // Calculate mood distribution
      const moodCounts = { positive: 0, negative: 0, distress: 0 };
      const allEntries = await supabase.from("journal_entries").select("mood, content");
      
      (allEntries.data || []).forEach((entry: any) => {
        const sentiment = analyzeSentiment(entry.content);
        if (sentiment === "distress") {
          moodCounts.distress++;
        } else if (sentiment === "positive") {
          moodCounts.positive++;
        } else {
          moodCounts.negative++;
        }
      });

      setMoodDistribution(moodCounts);
    } catch (error) {
      console.error("Error loading analytics data:", error);
    }
  }, [dauPeriod, supabase]);

  useEffect(() => {
    if (!currentUser) return;

    const loadData = async () => {
      try {
        setLoading(true);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const [
          { count: userCount, error: userCountError }, 
          { count: entryCount, error: entryCountError }, 
          { count: distressCount, error: distressCountError }, 
          { data: alertsData, error: alertsError }, 
          { data: activityData, error: activityError },
          { data: firstUsers, error: firstUsersError },
          { count: newUsersTodayCount, error: newUsersError }
        ] = await Promise.all([
          supabase.from("user_profiles").select("id", { count: "exact", head: true }),
          supabase.from("journal_entries").select("id", { count: "exact", head: true }),
          supabase.from("distress_logs").select("id", { count: "exact", head: true }),
          supabase.from("distress_logs").select("id, severity, trigger, notes, created_at").order("created_at", { ascending: false }).limit(3),
          supabase.from("audit_logs").select("id, action, details, created_at").order("created_at", { ascending: false }).limit(2),
          supabase.from("user_profiles").select("created_at").order("created_at", { ascending: true }).limit(1),
          supabase.from("user_profiles").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString())
        ]);

        if (userCountError) console.error("userCountError:", userCountError);
        if (entryCountError) console.error("entryCountError:", entryCountError);
        if (distressCountError) console.error("distressCountError:", distressCountError);
        if (alertsError) console.error("alertsError:", alertsError);
        if (activityError) console.error("activityError:", activityError);
        if (firstUsersError) console.error("firstUsersError:", firstUsersError);
        if (newUsersError) console.error("newUsersError:", newUsersError);

        if (firstUsers && firstUsers.length > 0) {
          setFirstUserDate(firstUsers[0].created_at);
        }

        const { data: entries, error: entriesError } = await supabase.from("journal_entries").select("mood, content").order("created_at", { ascending: false });
        if (entriesError) console.error("entriesError:", entriesError);

        const positiveEntries = (entries || []).filter((entry: any) => {
          const text = (entry.content || "").toLowerCase();
          const mood = (entry.mood || "").toLowerCase();
          const positiveKeywords = ["happy", "calm", "excited", "grateful", "peaceful", "content", "hopeful", "optimistic", "proud", "glad", "joy", "love"];
          const negativeKeywords = ["sad", "anxious", "frustrated", "overwhelmed", "angry", "worried", "stress", "depressed", "lonely", "hopeless", "afraid", "tired"];
          const hasPositive = positiveKeywords.some((word) => text.includes(word) || mood.includes(word));
          const hasNegative = negativeKeywords.some((word) => text.includes(word) || mood.includes(word));
          return hasPositive && !hasNegative;
        });

        setStats({
          totalUsers: userCount || 0,
          totalEntries: entryCount || 0,
          positiveRate: entryCount ? Math.round((positiveEntries.length / entryCount) * 100) : 0,
          activeAlerts: alertsData?.length || 0,
          totalDistressLogs: distressCount || 0,
          newUsersToday: newUsersTodayCount || 0,
        });
        setRecentAlerts(alertsData || []);
        setRecentActivity(activityData || []);

        // Load analytics data
        await loadAnalyticsData();
      } catch (error) {
        console.error("Error loading admin dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [loadAnalyticsData, supabase, currentUser]);

  // Reload analytics when period changes
  useEffect(() => {
    if (currentUser) loadAnalyticsData();
  }, [loadAnalyticsData, currentUser]);

  const formatTime = (value?: string) => {
    if (!value) return "just now";
    const date = new Date(value);
    const diffMins = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Export report function
  const exportReport = async () => {
    try {
      // Fetch all data for export
      const [usersRes, entriesRes, alertsRes, auditRes] = await Promise.all([
        supabase.from("user_profiles").select("*"),
        supabase.from("journal_entries").select("*"),
        supabase.from("distress_logs").select("*"),
        supabase.from("audit_logs").select("*")
      ]);

      // Create CSV content
      let csvContent = "Rise On AI Admin Report\n";
      csvContent += `Generated: ${formatFullDate(new Date())}\n\n`;

      // Users section
      csvContent += "=== Users ===\n";
      csvContent += "ID,Email,Username,Full Name,Role,Country,Age,Created At\n";
      (usersRes.data || []).forEach((user: any) => {
        csvContent += `${user.id},"${user.email}","${user.username || ""}","${user.full_name || ""}",${user.role},"${user.country || ""}",${user.age || ""},"${user.created_at}"\n`;
      });

      // Entries section
      csvContent += "\n=== Journal Entries ===\n";
      csvContent += "ID,User ID,Title,Mood,Created At\n";
      (entriesRes.data || []).forEach((entry: any) => {
        csvContent += `${entry.id},${entry.user_id},"${entry.title || ""}","${entry.mood || ""}","${entry.created_at}"\n`;
      });

      // Create download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `rise-on-ai-report-${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Log to audit
      await supabase.from("audit_logs").insert({
        admin_id: currentUser?.id,
        action: "Export Report",
        details: "Admin exported dashboard report"
      });
    } catch (error) {
      console.error("Error exporting report:", error);
      alert("Failed to export report");
    }
  };

  // Create announcement
  const handleCreateAnnouncement = async () => {
    if (!announcementTitle || !announcementContent) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const { error } = await supabase.from("announcements").insert({
        title: announcementTitle,
        content: announcementContent,
        created_by: currentUser?.id
      });

      if (error) throw error;

      // Log to audit
      await supabase.from("audit_logs").insert({
        admin_id: currentUser?.id,
        action: "Create Announcement",
        details: `Created announcement: ${announcementTitle}`
      });

      alert("Announcement created successfully!");
      setShowAnnouncementModal(false);
      setAnnouncementTitle("");
      setAnnouncementContent("");
    } catch (error) {
      console.error("Error creating announcement:", error);
      alert("Failed to create announcement");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-dm-serif text-[#4F4F4F] mb-1">Dashboard Overview</h1>
          <p className="text-sm text-[#4F4F4F]/60 font-poppins">
            {currentDate} - {firstUserDate ? `First user registered: ${formatFullDate(new Date(firstUserDate))}` : "No users yet"}
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportReport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-poppins text-[#4F4F4F] hover:bg-gray-50">
            <span>📊</span> Export Report
          </button>
          <button 
            onClick={() => setShowAnnouncementModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] rounded-lg text-sm font-poppins text-[#4F4F4F] font-medium">
            <span>📢</span> New Announcement
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      <div className="p-4 bg-gradient-to-r from-[#A8DADC]/20 to-[#CDB4DB]/20 rounded-xl border-l-4 border-l-[#A8DADC]">
        <p className="text-sm font-poppins text-[#4F4F4F] flex items-center gap-2">
          <span>🔒</span> All data displayed uses user full names (Owner/Admin only).
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center text-2xl">👥</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">TOTAL USERS</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">{loading ? "—" : stats.totalUsers}</p>
              <p className="text-xs text-[#52B788] font-poppins">Live from user profiles</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-400 to-cyan-300 rounded-full"></div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#52B788]/20 rounded-lg flex items-center justify-center text-2xl">📝</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">TOTAL ENTRIES</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">{loading ? "—" : stats.totalEntries}</p>
              <p className="text-xs text-[#52B788] font-poppins">Live from journal entries</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-300 rounded-full"></div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#FFE8A1]/30 rounded-lg flex items-center justify-center text-2xl">💖</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">AVG POSITIVE RATE</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">{loading ? "—" : `${stats.positiveRate}%`}</p>
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">Based on current journal mood/text</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-yellow-400 to-orange-300 rounded-full"></div>
        </Card>

        <Card className="p-5 border-l-4 border-l-[#F4A6A6]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#F4A6A6]/20 rounded-lg flex items-center justify-center text-2xl">🚨</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">TOTAL DISTRESS LOGS</p>
              <p className="text-2xl font-dm-serif text-[#F4A6A6]">{loading ? "—" : stats.totalDistressLogs}</p>
              <p className="text-xs text-[#F4A6A6] font-poppins">Live from distress logs</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-red-400 to-pink-300 rounded-full"></div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center text-2xl">👤</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">NEW USERS TODAY</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">{loading ? "—" : stats.newUsersToday}</p>
              <p className="text-xs text-[#52B788] font-poppins">Live from user profiles</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-300 rounded-full"></div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center">📈</div>
              <div>
                <p className="text-xs font-poppins text-[#4F4F4F]/60">
                  DAILY ACTIVE USERS — {dauPeriod === "month" ? new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "LAST 7 DAYS"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setDauPeriod("week")}
                className={`px-3 py-1 rounded-lg text-xs font-poppins ${dauPeriod === "week" ? "bg-[#A8DADC]/30 text-[#4F4F4F]" : "bg-gray-100 text-[#4F4F4F]/60"}`}>
                Week
              </button>
              <button 
                onClick={() => setDauPeriod("month")}
                className={`px-3 py-1 rounded-lg text-xs font-poppins ${dauPeriod === "month" ? "bg-[#A8DADC]/30 text-[#4F4F4F]" : "bg-gray-100 text-[#4F4F4F]/60"}`}>
                Month
              </button>
            </div>
          </div>
          <div className="h-48 flex items-end justify-between gap-1 px-4 pb-4">
            {dauData.length > 0 ? (
              dauData.map((d, i) => {
                const maxCount = Math.max(...dauData.map(x => x.count), 1);
                const heightPercent = (d.count / maxCount) * 100;
                const colors = ["#A8DADC", "#52B788", "#CDB4DB"];
                const color = colors[i % colors.length];
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div 
                      className="w-full bg-gradient-to-t rounded-t-lg transition-all"
                      style={{ 
                        height: `${Math.max(heightPercent, 10)}%`,
                        background: `linear-gradient(to top, ${color}, rgba(79, 79, 79, 0.1))`
                      }}
                    ></div>
                    <span className="text-xs text-[#4F4F4F]/60 font-poppins">{d.date}</span>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <p className="text-sm text-[#4F4F4F]/60 font-poppins">No data yet</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center">📊</div>
            <p className="text-xs font-poppins text-[#4F4F4F]/60">PLATFORM MOOD DISTRIBUTION</p>
          </div>
          <div className="flex items-center gap-8">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#EAEAEA" strokeWidth="10"></circle>
                {(() => {
                  const total = moodDistribution.positive + moodDistribution.negative + moodDistribution.distress;
                  const circumference = 2 * Math.PI * 40;
                  let offset = 0;

                  const positivePercent = total ? (moodDistribution.positive / total) * 100 : 0;
                  const negativePercent = total ? (moodDistribution.negative / total) * 100 : 0;
                  const distressPercent = total ? (moodDistribution.distress / total) * 100 : 0;

                  const positiveDash = (positivePercent / 100) * circumference;
                  const negativeDash = (negativePercent / 100) * circumference;
                  const distressDash = (distressPercent / 100) * circumference;

                  return (
                    <>
                      {positiveDash > 0 && (
                        <circle 
                          cx="50" cy="50" r="40" 
                          fill="none" 
                          stroke="#52B788" 
                          strokeWidth="10" 
                          strokeDasharray={`${positiveDash} ${circumference}`}
                          strokeDashoffset={-offset}
                        />
                      )}
                      {negativeDash > 0 && (
                        <circle 
                          cx="50" cy="50" r="40" 
                          fill="none" 
                          stroke="#F4A6A6" 
                          strokeWidth="10" 
                          strokeDasharray={`${negativeDash} ${circumference}`}
                          strokeDashoffset={-(offset += positiveDash)}
                        />
                      )}
                      {distressDash > 0 && (
                        <circle 
                          cx="50" cy="50" r="40" 
                          fill="none" 
                          stroke="#F4A6A6" 
                          strokeWidth="10" 
                          strokeDasharray={`${distressDash} ${circumference}`}
                          strokeDashoffset={-(offset += negativeDash)}
                        />
                      )}
                    </>
                  );
                })()}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-lg font-dm-serif text-[#4F4F4F]">
                    {(() => {
                      const total = moodDistribution.positive + moodDistribution.negative + moodDistribution.distress;
                      return total ? `${Math.round((moodDistribution.positive / total) * 100)}%` : "0%";
                    })()}
                  </p>
                  <p className="text-xs text-[#4F4F4F]/60 font-poppins">Positive</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {(() => {
                const total = moodDistribution.positive + moodDistribution.negative + moodDistribution.distress;
                const p = total ? Math.round((moodDistribution.positive / total) * 100) : 0;
                const n = total ? Math.round((moodDistribution.negative / total) * 100) : 0;
                const d = total ? Math.round((moodDistribution.distress / total) * 100) : 0;
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#52B788]"></div>
                      <span className="text-xs font-poppins text-[#4F4F4F]">Positive {p}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#F4A6A6]"></div>
                      <span className="text-xs font-poppins text-[#4F4F4F]">Negative {n}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#F4A6A6]"></div>
                      <span className="text-xs font-poppins text-[#4F4F4F]">Distress {d}%</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Distress Alerts */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#F4A6A6]/20 rounded-lg flex items-center justify-center">🚨</div>
              <p className="text-xs font-poppins text-[#4F4F4F]/60">RECENT DISTRESS ALERTS</p>
            </div>
            <button className="text-xs font-poppins text-[#A8DADC] hover:underline">View All →</button>
          </div>
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-[#4F4F4F]/60 font-inter">Loading alerts…</p>
            ) : recentAlerts.length === 0 ? (
              <p className="text-sm text-[#4F4F4F]/60 font-inter">No distress alerts found yet.</p>
            ) : recentAlerts.map((alert, index) => (
              <div key={alert.id || index} className="p-3 bg-[#F4A6A6]/10 rounded-xl border border-[#F4A6A6]/30 flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold font-poppins text-[#4F4F4F]">{alert.trigger || "Distress alert"}</p>
                  <p className="text-xs text-[#4F4F4F]/60 font-inter">{alert.notes || alert.severity || "Recent alert"} • {formatTime(alert.created_at)}</p>
                </div>
                <button className="px-3 py-1 bg-[#F4A6A6]/30 text-[#F4A6A6] rounded-full text-xs font-semibold font-poppins">Review</button>
              </div>
            ))}
          </div>
        </Card>

        {/* System Health & Admin Activity */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-[#52B788]/20 rounded-lg flex items-center justify-center">⚙️</div>
              <p className="text-xs font-poppins text-[#4F4F4F]/60">SYSTEM HEALTH</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#52B788]"></span>
                  <span className="text-sm font-poppins text-[#4F4F4F]">AI Module</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#4F4F4F]/60 font-inter">Online</span>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-gradient-to-r from-[#52B788] to-[#A8DADC]"></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#52B788]"></span>
                  <span className="text-sm font-poppins text-[#4F4F4F]">Database</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#4F4F4F]/60 font-inter">Healthy</span>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-[95%] bg-gradient-to-r from-[#A8DADC] to-[#52B788]"></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#A8DADC]"></span>
                  <span className="text-sm font-poppins text-[#4F4F4F]">API Response</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#4F4F4F]/60 font-inter">142ms</span>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-[80%] bg-gradient-to-r from-[#A8DADC] to-[#FFB700]"></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#FFB700]"></span>
                  <span className="text-sm font-poppins text-[#4F4F4F]">Storage Usage</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#4F4F4F]/60 font-inter">74%</span>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-[74%] bg-gradient-to-r from-[#FFE8A1] to-[#FFB700]"></div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-poppins text-[#4F4F4F]/60 mb-3">RECENT ADMIN ACTIVITY</p>
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-[#4F4F4F]/60 font-inter">Loading activity…</p>
              ) : recentActivity.length === 0 ? (
                <p className="text-sm text-[#4F4F4F]/60 font-inter">No admin activity recorded yet.</p>
              ) : recentActivity.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-xs gap-2">
                  <p className="font-poppins text-[#4F4F4F] flex-1">{item.action || item.details || "Admin activity"}</p>
                  <p className="text-[#4F4F4F]/60 font-inter whitespace-nowrap">{formatTime(item.created_at)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-dm-serif text-[#4F4F4F]">Create Announcement</h3>
              <button 
                onClick={() => setShowAnnouncementModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg">
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-poppins text-[#4F4F4F]/60">Title</label>
                <input 
                  type="text"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#A8DADC]/50 text-sm font-inter"
                  placeholder="Announcement title"
                />
              </div>
              <div>
                <label className="text-xs font-poppins text-[#4F4F4F]/60">Content</label>
                <textarea 
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#A8DADC]/50 text-sm font-inter"
                  placeholder="Announcement content"
                ></textarea>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button 
                  onClick={() => setShowAnnouncementModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-poppins text-[#4F4F4F] hover:bg-gray-50">
                  Cancel
                </button>
                <button 
                  onClick={handleCreateAnnouncement}
                  className="px-4 py-2 bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] rounded-lg text-sm font-poppins text-[#4F4F4F] font-medium">
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
