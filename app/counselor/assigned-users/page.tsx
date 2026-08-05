"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { ViewUserModal } from "@/components/admin/ViewUserModal";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { analyzeSentiment } from "@/lib/sentiment";

const PAGE_SIZE = 10;

// Mood to score mapping
const moodToScore: Record<string, number> = {
  "😊 Happy": 8,
  "😐 Neutral": 5,
  "😢 Sad": 3,
  "😤 Frustrated": 4,
  "😌 Calm": 7,
  "🎉 Excited": 9,
  "😕 Confused": 5,
  "😰 Overwhelmed": 2,
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
  const { user: currentUser } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  // Fetch data
  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch user profiles with role "user"
        const [usersRes, entriesRes] = await Promise.all([
          supabase
            .from("user_profiles")
            .select("*")
            .eq("role", "user")
            .order("created_at", { ascending: false }),
          supabase
            .from("journal_entries")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

        if (usersRes.error) {
          console.error("Error fetching users:", usersRes.error);
        } else {
          const userList = usersRes.data || [];
          setUsers(userList);
        }

        if (!entriesRes.error && entriesRes.data) {
          setJournalEntries(entriesRes.data);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, supabase]);

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

    // Sentiment analysis from entries
    let sentiment = "No Data";
    let activityStatus = "Inactive";
    if (userEntries.length > 0) {
      const allText = userEntries.map(e => (e.title || "") + " " + (e.content || "")).join(" ");
      const sent = analyzeSentiment(allText);
      if (sent === "positive") sentiment = "Positive";
      else if (sent === "negative") sentiment = "Negative";
      else sentiment = "Neutral";

      // Determine activity status
      const daysSinceLastActive = lastEntry 
        ? Math.floor((new Date().getTime() - new Date(lastEntry.created_at).getTime()) / 86400000) 
        : 999;
      
      if (daysSinceLastActive < 30) activityStatus = "Active";
      if (sentiment === "Negative" && avgMoodScore && avgMoodScore < 5) activityStatus = "At Risk";
    }

    const fullName = (user.first_name && user.last_name) 
      ? `${user.first_name} ${user.last_name}` 
      : (user.full_name || user.username || "Unknown User");

    // User's account active status
    const isAccountActive = user.is_active !== false;

    return {
      id: user.id,
      fullName,
      role: user.role || "user",
      country: user.country || "Unknown",
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
    const matchesSearch = 
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.country && user.country.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.rawUser.username && user.rawUser.username.toLowerCase().includes(searchTerm.toLowerCase()));
    
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue mx-auto mb-4"></div>
          <p className="text-dark-text/60 font-poppins">Loading users…</p>
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
          <p className="text-sm text-dark-text/60 font-poppins">{totalUsers} total assigned users</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="stat-card border-l-4 border-l-primary-blue">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-primary-blue/20">👥</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">TOTAL USERS</p>
              <p className="text-2xl font-dm-serif text-dark-text">{totalUsers}</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-primary-blue to-teal" />
        </Card>
        <Card className="stat-card border-l-4 border-l-success-green">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-success-green/20">✅</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">ACTIVE (30d)</p>
              <p className="text-2xl font-dm-serif text-dark-text">{activeUsers}</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-green-400 to-emerald-300" />
        </Card>
        <Card className="stat-card border-l-4 border-l-lavender">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-lavender/20">⏸️</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">INACTIVE</p>
              <p className="text-2xl font-dm-serif text-dark-text">{inactiveUsers}</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-purple-400 to-pink-300" />
        </Card>
        <Card className="stat-card border-l-4 border-l-error-red">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-error-red/30">🚫</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">AT RISK</p>
              <p className="text-2xl font-dm-serif text-error-red">{atRiskUsers}</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-red-400 to-pink-300" />
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-text/60">🔍</span>
            <input
              type="text"
              placeholder="Search by Name, Country, Username..."
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
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">NAME</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">COUNTRY</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">AGE</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">ENTRIES</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">LAST ACTIVE</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">AVG MOOD</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">SENTIMENT</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">STATUS</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-3">
                    <p className="font-poppins text-sm text-dark-text font-medium">{user.fullName}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-poppins text-dark-text">{user.country}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-poppins text-dark-text">{user.age}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-poppins text-dark-text">{user.entries}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-inter text-dark-text/60">{user.lastActive}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-poppins text-dark-text">{user.avgMood}</p>
                  </td>
                  <td className="py-4 px-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.sentiment === "Positive" ? "bg-[#52B788]/20 text-[#52B788]" : user.sentiment === "Neutral" ? "bg-primary-blue/30 text-dark-text/80" : user.sentiment === "Negative" ? "bg-[#F4A6A6]/20 text-[#F4A6A6]" : "bg-gray-100 text-dark-text/60"}`}>
                      {user.sentiment}
                    </span>
                  </td>
                  <td className="py-4 px-3">
                    {!user.isAccountActive ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-500">
                        Deactivated
                      </span>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.activityStatus === "Active" ? "bg-[#52B788]/20 text-[#52B788]" : user.activityStatus === "At Risk" ? "bg-[#F4A6A6]/20 text-[#F4A6A6]" : "bg-gray-100 text-dark-text/60"}`}>
                        {user.activityStatus}
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-3">
                    <button 
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setViewModalOpen(true);
                      }}
                      className="px-3 py-1 bg-primary-blue/20 text-primary-blue rounded-full text-xs font-semibold font-poppins">
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {/* Add empty rows to maintain consistent table height */}
              {Array.from({ length: PAGE_SIZE - paginatedUsers.length }).map((_, index) => (
                <tr key={`empty-${index}`} className="border-b border-gray-100">
                  <td className="py-4 px-3"></td>
                  <td className="py-4 px-3"></td>
                  <td className="py-4 px-3"></td>
                  <td className="py-4 px-3"></td>
                  <td className="py-4 px-3"></td>
                  <td className="py-4 px-3"></td>
                  <td className="py-4 px-3"></td>
                  <td className="py-4 px-3"></td>
                  <td className="py-4 px-3"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredUsers.length > 0 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-dark-text/60 font-poppins">Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
                        ? "bg-gradient-to-r from-primary-blue to-lavender text-white"
                        : "text-dark-text hover:bg-gray-100"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-dark-text"
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
      />
    </div>
  );
}
