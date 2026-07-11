"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { analyzeSentiment, getSentimentFromMood } from "@/lib/sentiment";

export default function CounselorDashboardPage() {
  const [stats, setStats] = useState({
    assignedUsers: 0,
    activeCases: 0,
    pendingMessages: 0,
    newUsersToday: 0,
  });
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [firstUserDate, setFirstUserDate] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();
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

  useEffect(() => {
    if (!currentUser) return;

    const loadData = async () => {
      try {
        setLoading(true);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
          { count: userCount, error: userCountError },
          { data: casesData, error: casesError },
          { data: messagesData, error: messagesError },
        ] = await Promise.all([
          supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("role", "user"),
          supabase.from("distress_logs").select("id, user_id, severity, trigger, created_at").order("created_at", { ascending: false }).limit(5),
          supabase.from("messages").select("id, conversation_id, sender_id, created_at").order("created_at", { ascending: false }).limit(5),
        ]);

        setStats({
          assignedUsers: userCount || 0,
          activeCases: casesData?.length || 0,
          pendingMessages: messagesData?.length || 0,
          newUsersToday: 0, // We can add this later
        });
        setRecentCases(casesData || []);
        setRecentMessages(messagesData || []);
      } catch (error) {
        console.error("Error loading counselor dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabase, currentUser]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-1">Dashboard Overview</h1>
          <p className="text-sm text-dark-text/70 font-poppins">
            {currentDate}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center text-2xl">👥</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/70 font-poppins">ASSIGNED USERS</p>
              <p className="text-2xl font-dm-serif text-dark-text">{loading ? "—" : stats.assignedUsers}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-400 to-cyan-300 rounded-full"></div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#F4A6A6]/20 rounded-lg flex items-center justify-center text-2xl">🚨</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/70 font-poppins">ACTIVE CASES</p>
              <p className="text-2xl font-dm-serif text-dark-text">{loading ? "—" : stats.activeCases}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-red-400 to-pink-300 rounded-full"></div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center text-2xl">💬</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/70 font-poppins">PENDING MESSAGES</p>
              <p className="text-2xl font-dm-serif text-dark-text">{loading ? "—" : stats.pendingMessages}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-300 rounded-full"></div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Cases */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#F4A6A6]/20 rounded-lg flex items-center justify-center">🚨</div>
              <p className="text-xs font-poppins text-dark-text/70">RECENT CASES</p>
            </div>
            <Link href="/counselor/cases" className="text-xs font-poppins text-[#A8DADC] hover:underline">View All →</Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-dark-text/70 font-inter">Loading cases…</p>
            ) : recentCases.length === 0 ? (
              <p className="text-sm text-dark-text/70 font-inter">No cases yet.</p>
            ) : recentCases.map((c, index) => (
              <div key={c.id || index} className="p-3 bg-[#F4A6A6]/10 rounded-xl border border-[#F4A6A6]/30 flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold font-poppins text-dark-text">{c.trigger || "Case"}</p>
                  <p className="text-xs text-dark-text/70 font-inter">{c.severity || "Recent"} • {formatTime(c.created_at)}</p>
                </div>
                <Link href="/counselor/cases" className="px-3 py-1 bg-[#F4A6A6]/30 text-[#F4A6A6] rounded-full text-xs font-semibold font-poppins">View</Link>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Messages */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center">💬</div>
              <p className="text-xs font-poppins text-dark-text/70">RECENT MESSAGES</p>
            </div>
            <Link href="/counselor/messages" className="text-xs font-poppins text-[#A8DADC] hover:underline">View All →</Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-dark-text/70 font-inter">Loading messages…</p>
            ) : recentMessages.length === 0 ? (
              <p className="text-sm text-dark-text/70 font-inter">No messages yet.</p>
            ) : recentMessages.map((m, index) => (
              <div key={m.id || index} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold font-poppins text-dark-text">New Message</p>
                  <p className="text-xs text-dark-text/70 font-inter">{formatTime(m.created_at)}</p>
                </div>
                <Link href="/counselor/messages" className="px-3 py-1 bg-[#CDB4DB]/30 text-[#CDB4DB] rounded-full text-xs font-semibold font-poppins">View</Link>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
