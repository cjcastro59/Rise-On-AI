"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConfirmation } from "@/components/layout/ConfirmationModalProvider";
import { ViewUserModal } from "@/components/admin/ViewUserModal";
import { analyzeSentiment } from "@/lib/sentiment";
import { EyeIcon } from "@/components/ui/icons/EyeIcon";
import { PowerIcon } from "@/components/ui/icons/PowerIcon";
import { TrashIcon } from "@/components/ui/icons/TrashIcon";

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

export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [users, setUsers] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const { user: currentUser } = useAuth();
  const { openConfirmation } = useConfirmation();
  const supabase = useMemo(() => createClient(), []);

  // View user modal state
  const [viewModal, setViewModal] = useState<{
    isOpen: boolean;
    userId: string;
  }>({ isOpen: false, userId: "" });

  // Check if current user can perform admin actions
  const canManageUsers = currentUserProfile?.role === "owner" || currentUserProfile?.role === "admin";

  // Fetch data
  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch user profiles
        const [usersRes, entriesRes, currentUserRes] = await Promise.all([
          supabase
            .from("user_profiles")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("journal_entries")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("user_profiles")
            .select("*")
            .eq("id", currentUser.id)
            .single()
        ]);

        if (!currentUserRes.error && currentUserRes.data) {
          setCurrentUserProfile(currentUserRes.data);
        }

        if (usersRes.error) {
          console.error("Error fetching users:", usersRes.error);
          // Use mock data if error
          setUsers(getMockUsers());
        } else {
          const userList = usersRes.data || [];
          setUsers(userList);
        }

        if (!entriesRes.error && entriesRes.data) {
          setJournalEntries(entriesRes.data);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setUsers(getMockUsers());
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, supabase]);

  // Get mock users for fallback
  const getMockUsers = () => [
    {
      id: "mock1",
      first_name: "Jane",
      last_name: "Doe",
      full_name: "Jane Doe",
      country: "Philippines",
      role: "user",
      age: 20,
      sex: "Female",
      is_active: true,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: "mock2",
      first_name: "John",
      last_name: "Smith",
      full_name: "John Smith",
      country: "Philippines",
      role: "counselor",
      age: 30,
      sex: "Male",
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString()
    }
  ];

  // Function to update user role
  const handleRoleChange = async (userId: string, newRole: string, userName: string) => {
    const confirmed = await openConfirmation({
      title: "Change User Role",
      message: `Are you sure you want to change ${userName}'s role to ${newRole}?`,
      confirmText: "Yes, Change Role",
      cancelText: "Cancel",
      isDangerous: false,
      icon: <PowerIcon className="w-6 h-6 text-primary-blue" />
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) {
        console.error("Error updating role:", error);
        alert(`Failed to update role: ${error.message}`);
      } else {
        // Refresh user list
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));

        // Log audit
        await supabase.from("audit_logs").insert({
          admin_id: currentUser?.id,
          action: "Role Change",
          target_id: userId,
          target_type: "user",
          details: `Changed ${userName}'s role to ${newRole}`
        });
      }
    } catch (err) {
      console.error("Error updating role:", err);
    }
  };

  // Function to transfer ownership
  const handleTransferOwnership = async (userId: string, userName: string) => {
    const confirmed = await openConfirmation({
      title: "Transfer Ownership",
      message: `Are you sure you want to transfer ownership to ${userName}? This will make them the new owner and you will become an admin.`,
      confirmText: "Yes, Transfer Ownership",
      cancelText: "Cancel",
      isDangerous: true,
      icon: <PowerIcon className="w-6 h-6 text-[#F4A6A6]" />
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase.rpc('transfer_ownership', { new_owner_id: userId });

      if (error) {
        console.error("Error transferring ownership:", error);
        alert(`Failed to transfer ownership: ${error.message}`);
      } else {
        // Refresh user list
        const { data: refreshedUsers } = await supabase
          .from("user_profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (refreshedUsers) {
          setUsers(refreshedUsers);
        }

        // Refresh current user profile
        const { data: currentProfileData } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", currentUser?.id)
          .single();

        if (currentProfileData) {
          setCurrentUserProfile(currentProfileData);
        }
      }
    } catch (err) {
      console.error("Error transferring ownership:", err);
    }
  };

  // Function to toggle user active status
  const handleToggleActive = async (userId: string, userName: string, currentStatus: boolean) => {
    const confirmed = await openConfirmation({
      title: currentStatus ? "Deactivate User" : "Activate User",
      message: `Are you sure you want to ${currentStatus ? "deactivate" : "activate"} ${userName}?`,
      confirmText: `Yes, ${currentStatus ? "Deactivate" : "Activate"}`,
      cancelText: "Cancel",
      isDangerous: currentStatus,
      icon: <PowerIcon className="w-6 h-6" style={{ color: currentStatus ? "#F4A6A6" : "#52B788" }} />
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ is_active: !currentStatus })
        .eq("id", userId);

      if (error) {
        console.error("Error updating user status:", error);
        alert("Failed to update user status. Please try again.");
      } else {
        // Refresh user list
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u));

        // Log audit
        await supabase.from("audit_logs").insert({
          admin_id: currentUser?.id,
          action: currentStatus ? "User Deactivated" : "User Activated",
          target_id: userId,
          target_type: "user",
          details: `${currentStatus ? "Deactivated" : "Activated"} user ${userName}`
        });
      }
    } catch (err) {
      console.error("Error updating user status:", err);
    }
  };

  // Function to delete a user
  const handleDeleteUser = async (userId: string, userName: string) => {
    const confirmed = await openConfirmation({
      title: "Delete User",
      message: `Are you sure you want to delete ${userName}? This action cannot be undone.`,
      confirmText: "Yes, Delete User",
      cancelText: "Cancel",
      isDangerous: true,
      icon: <TrashIcon className="w-6 h-6 text-red-500" />
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("user_profiles")
        .delete()
        .eq("id", userId);

      if (error) {
        console.error("Error deleting user:", error);
        alert("Failed to delete user. Please try again.");
      } else {
        // Refresh user list
        setUsers(prev => prev.filter(u => u.id !== userId));

        // Log audit
        await supabase.from("audit_logs").insert({
          admin_id: currentUser?.id,
          action: "User Deleted",
          target_id: userId,
          target_type: "user",
          details: `Deleted user ${userName}`
        });
      }
    } catch (err) {
      console.error("Error deleting user:", err);
    }
  };

  // Function to view user details
  const handleViewUser = (userId: string) => {
    setViewModal({ isOpen: true, userId });
  };

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

    const matchesRole = roleFilter === "All" || user.role === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
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
          <p className="text-dark-text/60 font-poppins">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View User Modal */}
      <ViewUserModal
        isOpen={viewModal.isOpen}
        onClose={() => setViewModal({ isOpen: false, userId: "" })}
        userId={viewModal.userId}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-1">User Management</h1>
          <p className="text-sm text-dark-text/60 font-poppins">{totalUsers} total registered users</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-poppins text-dark-text hover:bg-gray-50">
            <span>📊</span> Export CSV
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      <div className="p-4 bg-gradient-to-r from-primary-blue/20 to-lavender/20 rounded-xl border-l-4 border-l-lavender">
        <p className="text-sm font-poppins text-dark-text flex items-center gap-2">
          <span>🔒</span> Only Admins and Owners can change user roles.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-primary-blue/20 rounded-lg flex items-center justify-center text-2xl">👥</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">TOTAL USERS</p>
              <p className="text-2xl font-dm-serif text-dark-text">{totalUsers}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-400 to-cyan-300 rounded-full"></div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#52B788]/20 rounded-lg flex items-center justify-center text-2xl">✅</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">ACTIVE (30d)</p>
              <p className="text-2xl font-dm-serif text-dark-text">{activeUsers}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-300 rounded-full"></div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-lavender/20 rounded-lg flex items-center justify-center text-2xl">⏸️</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">INACTIVE</p>
              <p className="text-2xl font-dm-serif text-dark-text">{inactiveUsers}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-300 rounded-full"></div>
        </Card>
        <Card className="p-5 border-l-4 border-l-[#F4A6A6]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#F4A6A6]/20 rounded-lg flex items-center justify-center text-2xl">🚫</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">AT RISK</p>
              <p className="text-2xl font-dm-serif text-[#F4A6A6]">{atRiskUsers}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-red-400 to-pink-300 rounded-full"></div>
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
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="All">All Roles</option>
          <option value="user">User</option>
          <option value="counselor">Counselor</option>
          <option value="admin">Admin</option>
          <option value="owner">Owner</option>
        </select>
        <select
          className="px-4 py-3 border border-gray-300 rounded-xl text-sm font-poppins text-dark-text bg-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="At Risk">At Risk</option>
          <option value="Deactivated">Deactivated</option>
        </select>
      </div>

      {/* Users Table */}
      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">NAME</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">ROLE</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">COUNTRY</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">AGE</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">ENTRIES</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">LAST ACTIVE</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">AVG MOOD</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">SENTIMENT</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">STATUS</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-dark-text/60 font-poppins uppercase tracking-wider">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-3">
                    <p className="font-poppins text-sm text-dark-text font-medium">{user.fullName}</p>
                  </td>
                  <td className="py-4 px-3">
                    {currentUserProfile?.role === "owner" || currentUserProfile?.role === "admin" ? (
                      <>
                        {user.role === "owner" ? (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-[#F4A6A6]/20 text-[#F4A6A6]">
                            Owner
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value, user.fullName)}
                              className="px-2 py-1 rounded-full text-xs font-semibold border border-gray-200 bg-white"
                            >
                              <option value="user">User</option>
                              <option value="counselor">Counselor</option>
                              <option value="admin">Admin</option>
                            </select>
                            {currentUserProfile?.role === "owner" && (
                              <button
                                onClick={() => handleTransferOwnership(user.id, user.fullName)}
                                className="px-2 py-1 rounded-full text-xs font-semibold border border-[#F4A6A6] text-[#F4A6A6] hover:bg-[#F4A6A6]/10"
                                title="Transfer Ownership"
                              >
                                Transfer Ownership
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.role === "owner" ? "bg-[#F4A6A6]/20 text-[#F4A6A6]" :
                          user.role === "admin" ? "bg-[#52B788]/20 text-[#52B788]" :
                            user.role === "counselor" ? "bg-primary-blue/30 text-dark-text/80" :
                              "bg-gray-100 text-dark-text/60"
                        }`}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    )}
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
                    <div className="flex items-center gap-2">
                      {/* View Button */}
                      <button
                        onClick={() => handleViewUser(user.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-primary-blue hover:bg-primary-blue/10 transition-colors"
                        title="View User"
                      >
                        <EyeIcon className="w-5 h-5" />
                      </button>

                      {/* Toggle Active Button: Owner can toggle anyone, Admin can toggle anyone except Owner */}
                      {(currentUserProfile?.role === "owner" || currentUserProfile?.role === "admin") && user.id !== currentUser?.id && !(currentUserProfile?.role === "admin" && user.role === "owner") && (
                        <button
                          onClick={() => handleToggleActive(user.id, user.fullName, user.isAccountActive)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                          title={user.isAccountActive ? "Deactivate User" : "Activate User"}
                        >
                          <PowerIcon className="w-5 h-5" />
                        </button>
                      )}

                      {/* Delete Button: Only Owner can delete users */}
                      {currentUserProfile?.role === "owner" && user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.fullName)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg text-[#F4A6A6] hover:bg-[#F4A6A6]/10 transition-colors"
                          title="Delete User"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
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
                  <td className="py-4 px-3"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredUsers.length > 0 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-dark-text/60 font-poppins">Showing {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users</p>
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
                    className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-poppins transition-colors ${currentPage === page
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
    </div>
  );
}
