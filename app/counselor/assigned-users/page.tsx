"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { ViewUserModal } from "@/components/admin/ViewUserModal";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDisplayId, loadDisplayIdFormat, type DisplayIdFormat } from "@/lib/display-ids";
import StudentReportModal, { type StudentReportData } from "@/components/counselor/StudentReportModal";

const PAGE_SIZE = 10;

// Mood to score mapping
const moodToScore: Record<string, number> = {
  "Happy": 8,
  "Neutral": 5,
  "Sad": 3,
  "Frustrated": 4,
  "Calm": 7,
  "Excited": 9,
  "Confused": 5,
  "Overwhelmed": 2,
};

const getLastActive = (dateStr: string | null) => {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

export default function CounselorAssignedUsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [users, setUsers] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [displayIdFormat, setDisplayIdFormat] = useState<DisplayIdFormat>("anonymized");
  const [reportModal, setReportModal] = useState<{ isOpen: boolean; data: StudentReportData | null }>({
    isOpen: false,
    data: null,
  });
  const { user: currentUser } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  // Load display ID format from system settings
  useEffect(() => {
    loadDisplayIdFormat(supabase).then(setDisplayIdFormat);
  }, [supabase]);

  // Fetch data
  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const counselorId = currentUser.id;
        const [{ data: profileRows, error: profileError }, { data: conversationRows, error: conversationError }] = await Promise.all([
          supabase
            .from("user_profiles")
            .select("id")
            .eq("role", "user")
            .eq("assigned_counselor_id", counselorId),
          supabase
            .from("conversations")
            .select("user_id")
            .eq("counselor_id", counselorId)
            .eq("status", "open"),
        ]);

        const usersError = profileError || conversationError;
        const assignedUserIds = Array.from(new Set([
          ...((profileRows || []) as { id: string }[]).map((row) => row.id),
          ...((conversationRows || []) as { user_id: string }[]).map((row) => row.user_id),
        ].filter(Boolean)));

        const { data: usersData } = assignedUserIds.length === 0
          ? { data: [] }
          : await supabase
            .from("user_profiles")
            .select("id,first_name,last_name,full_name,username,email,age,sex,is_active,created_at,updated_at")
            .eq("role", "user")
            .in("id", assignedUserIds)
            .order("created_at", { ascending: false });

        if (usersError) {
          console.error("Error fetching users:", usersError);
          setUsers([]);
          setJournalEntries([]);
        } else {
          const userList = usersData || [];
          setUsers(userList);

          if (assignedUserIds.length === 0) {
            setJournalEntries([]);
            return;
          }

          const { data: entriesData, error: entriesError } = await supabase
            .from("journal_entries")
            .select("user_id, mood, sentiment, created_at")
            .in("user_id", assignedUserIds)
            .order("created_at", { ascending: false })
            .limit(500);

          if (entriesError) {
            console.error("Error fetching assigned user entries:", entriesError);
            setJournalEntries([]);
          } else {
            setJournalEntries(entriesData || []);
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, supabase]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Process users to add computed data
  const processedUsers = users.map(user => {
    const userEntries = journalEntries.filter(entry => entry.user_id === user.id);
    const entryCount = userEntries.length;
    const lastEntry = userEntries[0];

    // Calculate average mood score
    const moods = userEntries.map(e => e.mood).filter(Boolean);
    const avgMoodScore = moods.length > 0
      ? Math.round(moods.reduce((sum, mood) => sum + (moodToScore[mood] || 5), 0) / moods.length)
      : null;

    // Derive overall sentiment from stored ML predictions.
    let sentiment = "No Data";
    let activityStatus = "Inactive";
    if (userEntries.length > 0) {
      const counts = { positive: 0, negative: 0, distress: 0 };
      for (const e of userEntries) {
        const s = (e.sentiment as string | null) ?? "";
        if (s === "positive") counts.positive++;
        else if (s === "distress") counts.distress++;
        else if (s === "negative") counts.negative++;
      }
      if (counts.distress > 0) sentiment = "Distress";
      else if (counts.negative >= counts.positive) sentiment = "Negative";
      else if (counts.positive > 0) sentiment = "Positive";

      // Determine activity status
      const daysSinceLastActive = lastEntry
        ? Math.floor((new Date().getTime() - new Date(lastEntry.created_at).getTime()) / 86400000)
        : 999;

      if (daysSinceLastActive < 30) activityStatus = "Active";
      if (sentiment === "Negative" && avgMoodScore && avgMoodScore < 5) activityStatus = "At Risk";
    }

    const displayId = formatDisplayId(user.id, "user", displayIdFormat);

    // User's account active status
    const isAccountActive = user.is_active !== false;

    return {
      id: user.id,
      fullName: displayId,
      role: user.role || "user",
      age: user.age || "N/A",
      sex: user.sex || "N/A",
      entries: entryCount,
      lastActive: getLastActive(lastEntry?.created_at || user.updated_at || user.created_at),
      avgMood: avgMoodScore ? `${avgMoodScore}/10` : "—",
      sentiment,
      activityStatus,
      isAccountActive,
      rawUser: user
    };
  });

  // Filter users
  const filteredUsers = processedUsers.filter(user => {
    const matchesSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === "All") {
      matchesStatus = true;
    } else if (statusFilter === "Deactivated") {
      matchesStatus = !user.isAccountActive;
    } else {
      matchesStatus = user.isAccountActive && user.activityStatus === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const totalUsers = users.length;
  const activeUsers = processedUsers.filter(u => u.isAccountActive && u.activityStatus === "Active").length;
  const atRiskUsers = processedUsers.filter(u => u.isAccountActive && u.activityStatus === "At Risk").length;
  const inactiveUsers = processedUsers.filter(u => !u.isAccountActive || u.activityStatus === "Inactive").length;

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + PAGE_SIZE);

  // Generate report for a specific user
  const handleGenerateReport = async (user: typeof processedUsers[0]) => {
    const rawUser = user.rawUser as any;
    const studentName =
      rawUser.full_name ||
      (rawUser.first_name && rawUser.last_name ? `${rawUser.first_name} ${rawUser.last_name}` : null) ||
      rawUser.username ||
      user.fullName;

    const studentEmail = rawUser.email || null;

    // Fetch wellness and risk data for this user
    const [wellnessRes, riskRes, counselorRes] = await Promise.all([
      supabase
        .from("behavioral_indicators")
        .select("wellness_score,wellness_level,behavioral_trend_score,journaling_frequency_score,mood_consistency_score,consecutive_negative_count")
        .eq("user_id", user.id)
        .eq("lookback_days", 30)
        .not("wellness_score", "is", null)
        .order("window_end_date", { ascending: false })
        .limit(1),
      supabase
        .from("distress_risk_assessments")
        .select("risk_level,total_points")
        .eq("user_id", user.id)
        .eq("lookback_days", 30)
        .order("assessed_date", { ascending: false })
        .limit(1),
      supabase
        .from("user_profiles")
        .select("full_name,first_name,last_name,username")
        .eq("id", currentUser!.id)
        .single(),
    ]);

    const wellness = wellnessRes.data?.[0] as any;
    const risk = riskRes.data?.[0] as any;
    const counselorProfile = counselorRes.data as any;

    const counselorName =
      counselorProfile?.full_name ||
      (counselorProfile?.first_name && counselorProfile?.last_name
        ? `${counselorProfile.first_name} ${counselorProfile.last_name}`
        : counselorProfile?.username || "Counselor");

    // Compute sentiment breakdown from journal entries
    const userEntries = journalEntries.filter(e => e.user_id === user.id);
    const counts = { positive: 0, negative: 0, distress: 0 };
    userEntries.forEach((e: any) => {
      const s = (e.sentiment as string | null) ?? "";
      if (s === "positive") counts.positive++;
      else if (s === "distress") counts.distress++;
      else if (s === "negative") counts.negative++;
    });
    const total = userEntries.length || 1;

    const reportData: StudentReportData = {
      studentId: user.id,
      studentName,
      studentEmail,
      totalEntries: userEntries.length,
      positivePercent: Math.round((counts.positive / total) * 100),
      negativePercent: Math.round((counts.negative / total) * 100),
      distressPercent: Math.round((counts.distress / total) * 100),
      wellnessScore: wellness?.wellness_score ?? null,
      wellnessLevel: wellness?.wellness_level ?? null,
      distressRiskLevel: risk?.risk_level ?? null,
      totalPoints: risk?.total_points ?? 0,
      bts: wellness?.behavioral_trend_score ?? null,
      jfs: wellness?.journaling_frequency_score ?? null,
      mcs: wellness?.mood_consistency_score ?? null,
      cnc: wellness?.consecutive_negative_count ?? 0,
      counselorName,
    };

    setReportModal({ isOpen: true, data: reportData });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue mx-auto mb-4"></div>
          <p className="text-slate-600 font-poppins">Loading users…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-1">Assigned Users</h1>
          <p className="text-sm text-slate-600 font-poppins">{totalUsers} total assigned users</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="stat-card border-l-4 border-l-primary-blue">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-primary-blue/20">👥</div>
            <div className="text-right">
              <p className="text-xs text-slate-600 font-poppins">TOTAL USERS</p>
              <p className="text-2xl font-dm-serif text-dark-text">{totalUsers}</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-primary-blue to-teal" />
        </Card>
        <Card className="stat-card border-l-4 border-l-success-green">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-success-green/20">✅</div>
            <div className="text-right">
              <p className="text-xs text-slate-600 font-poppins">ACTIVE (30d)</p>
              <p className="text-2xl font-dm-serif text-dark-text">{activeUsers}</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-green-400 to-emerald-300" />
        </Card>
        <Card className="stat-card border-l-4 border-l-lavender">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-lavender/20">⏸️</div>
            <div className="text-right">
              <p className="text-xs text-slate-600 font-poppins">INACTIVE</p>
              <p className="text-2xl font-dm-serif text-dark-text">{inactiveUsers}</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-purple-400 to-pink-300" />
        </Card>
        <Card className="stat-card border-l-4 border-l-error-red">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-error-red/30">🚫</div>
            <div className="text-right">
              <p className="text-xs text-slate-600 font-poppins">AT RISK</p>
              <p className="text-2xl font-dm-serif text-error-red">{atRiskUsers}</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-red-400 to-pink-300" />
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur-md">
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">🔍</span>
            <input
              type="text"
              placeholder="Search by User ID..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl text-sm font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <select
          className="px-4 py-3 border border-gray-300 rounded-xl text-sm font-poppins text-dark-text bg-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="At Risk">At Risk</option>
        </select>
      </div>

      {/* Users Table */}
      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="admin-table min-w-[1050px] table-fixed">
            <thead>
              <tr>
                <th>NAME</th>
                <th>AGE</th>
                <th>ENTRIES</th>
                <th>LAST ACTIVE</th>
                <th>AVG MOOD</th>
                <th>SENTIMENT</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user) => (
                <tr key={user.id}>
                  <td className="py-4 px-3">
                    <p className="font-poppins text-sm font-semibold text-slate-900 hover:text-indigo-600">{user.fullName}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-poppins text-dark-text">{user.age}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-poppins text-dark-text">{user.entries}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-inter text-slate-600">{user.lastActive}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-poppins text-dark-text">{user.avgMood}</p>
                  </td>
                  <td className="py-4 px-3">
                    <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${user.sentiment === "Positive" ? "border-emerald-200 bg-emerald-100 text-emerald-800" : user.sentiment === "Neutral" ? "border-indigo-200 bg-indigo-100 text-indigo-800" : user.sentiment === "Negative" || user.sentiment === "Distress" ? "border-rose-200 bg-rose-100 text-rose-800" : "border-slate-200 bg-slate-100 text-slate-800"}`}>
                      {user.sentiment}
                    </span>
                  </td>
                  <td className="py-4 px-3">
                    {!user.isAccountActive ? (
                      <span className="px-2.5 py-1 rounded-full border border-slate-300 bg-slate-100 text-xs font-semibold text-slate-800">
                        Deactivated
                      </span>
                    ) : (
                      <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${user.activityStatus === "Active" ? "border-emerald-200 bg-emerald-100 text-emerald-800" : user.activityStatus === "At Risk" ? "border-amber-200 bg-amber-100 text-amber-900" : "border-slate-200 bg-slate-100 text-slate-800"}`}>
                        {user.activityStatus}
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setViewModalOpen(true);
                        }}
                        className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-slate-800">
                        View
                      </button>
                      <button
                        onClick={() => handleGenerateReport(user)}
                        className="rounded-lg bg-primary-blue px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-primary-blue/80">
                        Report
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredUsers.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-slate-600 font-poppins">Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users</p>
            <div className="flex items-center gap-1 flex-wrap justify-center">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-dark-text text-sm"
              >
                ←
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                .reduce<(number | "...")[]>((acc, page, idx, arr) => {
                  if (idx > 0 && (page as number) - (arr[idx - 1] as number) > 1) acc.push("...");
                  acc.push(page);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "..." ? (
                    <span key={`ellipsis-${idx}`} className="w-9 h-9 flex items-center justify-center text-slate-400 text-sm">…</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item as number)}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-poppins transition-colors ${currentPage === item
                          ? "bg-gradient-to-r from-primary-blue to-lavender text-white"
                          : "text-dark-text hover:bg-gray-100"
                        }`}
                    >
                      {item}
                    </button>
                  )
                )}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-dark-text text-sm"
              >
                →
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* View User Modal */}
      <ViewUserModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        userId={selectedUserId}
        anonymizeIdentity
      />

      {/* Student Report Modal */}
      {reportModal.data && (
        <StudentReportModal
          isOpen={reportModal.isOpen}
          onClose={() => setReportModal({ isOpen: false, data: null })}
          data={reportModal.data}
        />
      )}
    </div>
  );
}
