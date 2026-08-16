"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import {
  WELLNESS_LEVEL_CONFIG,
  classifyWellnessLevel,
  type WellnessLevel,
} from "@/lib/wellness-assessment";
import {
  DISTRESS_RISK_CONFIG,
  classifyDistressRiskLevel,
  type DistressRiskLevel,
} from "@/lib/distress-risk";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserWellnessSnapshot {
  user_id: string;
  wellness_score: number | null;
  wellness_level: string | null;
  window_end_date: string;
}

interface UserRiskSnapshot {
  user_id: string;
  risk_level: string;
  total_points: number;
  assessed_date: string;
}

interface AssignedUserRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
}

// ── Wellness badge ─────────────────────────────────────────────────────────────
function WellnessBadge({
  score,
  level,
}: {
  score: number | null;
  level: string | null;
}) {
  if (score === null) {
    return (
      <span className="text-[10px] font-inter text-dark-text/40 italic">No data</span>
    );
  }
  const lvl  = (level as WellnessLevel) ?? classifyWellnessLevel(score);
  const cfg  = WELLNESS_LEVEL_CONFIG[lvl];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-poppins font-medium"
      style={{ backgroundColor: cfg.bgColor, color: cfg.color }}
    >
      {cfg.emoji} {score.toFixed(1)} · {lvl}
    </span>
  );
}

// ── Distress Risk badge ───────────────────────────────────────────────────────
function RiskBadge({ riskLevel }: { riskLevel: string | null }) {
  if (!riskLevel) {
    return <span className="text-[10px] font-inter text-dark-text/40 italic">No data</span>;
  }
  const lvl = riskLevel as DistressRiskLevel;
  const cfg = DISTRESS_RISK_CONFIG[lvl] ?? DISTRESS_RISK_CONFIG["Low Risk"];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-poppins font-medium"
      style={{ backgroundColor: cfg.bgColor, color: cfg.color }}
    >
      {cfg.emoji} {lvl}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CounselorDashboardPage() {
  const [stats, setStats] = useState({
    assignedUsers:   0,
    activeCases:     0,
    pendingMessages: 0,
    newUsersToday:   0,
  });
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<AssignedUserRow[]>([]);
  const [wellnessMap, setWellnessMap] = useState<Map<string, UserWellnessSnapshot>>(new Map());
  const [riskMap, setRiskMap] = useState<Map<string, UserRiskSnapshot>>(new Map());
  const [wellnessLoading, setWellnessLoading]  = useState(true);
  const [currentDate, setCurrentDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient() as any, []);

  // Prevent hydration mismatch
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    setCurrentDate(
      new Date().toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      })
    );
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const loadData = async () => {
      try {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const counselorId = user.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setDate(todayEnd.getDate() + 1);

        const [
          { count: userCount },
          { data: casesData },
          { data: messagesData },
          { count: newUsersCount },
          { data: usersData },
        ] = await Promise.all([
          supabase
            .from("user_profiles")
            .select("id", { count: "exact", head: true })
            .eq("assigned_counselor_id", counselorId),
          supabase
            .from("distress_logs")
            .select("id, user_id, severity, trigger, created_at, assigned_counselor_id")
            .eq("assigned_counselor_id", counselorId)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("messages")
            .select("id, conversation_id, sender_id, created_at, conversations!inner(counselor_id)")
            .eq("conversations.counselor_id", counselorId)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("user_profiles")
            .select("id", { count: "exact", head: true })
            .eq("assigned_counselor_id", counselorId)
            .gte("created_at", today.toISOString())
            .lt("created_at", todayEnd.toISOString()),
          // Fetch assigned user profiles for wellness panel (up to 20)
          supabase
            .from("user_profiles")
            .select("id, first_name, last_name, username, email")
            .eq("assigned_counselor_id", counselorId)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

        setStats({
          assignedUsers:   userCount   || 0,
          activeCases:     casesData?.length   || 0,
          pendingMessages: messagesData?.length || 0,
          newUsersToday:   newUsersCount || 0,
        });
        setRecentCases(casesData    || []);
        setRecentMessages(messagesData || []);
        setAssignedUsers(usersData  || []);

        // ── Load wellness snapshot for each assigned user ─────────────────
        if (usersData && usersData.length > 0) {
          setWellnessLoading(true);
          const userIds = (usersData as AssignedUserRow[]).map(u => u.id);

          const { data: wellnessRows } = await supabase
            .from("behavioral_indicators")
            .select("user_id, wellness_score, wellness_level, window_end_date")
            .in("user_id", userIds)
            .eq("lookback_days", 30)
            .not("wellness_score", "is", null)
            .order("window_end_date", { ascending: false });

          // Deduplicate: keep most-recent row per user
          const seen  = new Set<string>();
          const wMap  = new Map<string, UserWellnessSnapshot>();
          for (const row of (wellnessRows ?? [])) {
            if (!seen.has(row.user_id)) {
              seen.add(row.user_id);
              wMap.set(row.user_id, row as UserWellnessSnapshot);
            }
          }
          setWellnessMap(wMap);

          // ── Load DRI snapshot for each assigned user ─────────────────
          const { data: riskRows } = await supabase
            .from("distress_risk_assessments")
            .select("user_id, risk_level, total_points, assessed_date")
            .in("user_id", userIds)
            .eq("lookback_days", 30)
            .order("assessed_date", { ascending: false });

          const rSeen = new Set<string>();
          const rMap  = new Map<string, UserRiskSnapshot>();
          for (const row of (riskRows ?? [])) {
            if (!rSeen.has(row.user_id)) {
              rSeen.add(row.user_id);
              rMap.set(row.user_id, row as UserRiskSnapshot);
            }
          }
          setRiskMap(rMap);

          setWellnessLoading(false);
        } else {
          setWellnessLoading(false);
        }
      } catch (err) {
        console.error("Error loading counselor dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabase, isMounted]);

  const formatTime = (value?: string) => {
    if (!value) return "just now";
    const d = new Date(value);
    const mins = Math.max(1, Math.round((Date.now() - d.getTime()) / 60000));
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs  < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  };

  const displayName = (u: AssignedUserRow) =>
    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
    u.username ||
    u.email?.split("@")[0] ||
    u.id.slice(0, 8);

  if (!isMounted) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-dark-text/70 font-poppins">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-1">Dashboard Overview</h1>
          <p className="text-sm text-dark-text/70 font-poppins">{currentDate}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card variant="white" className="stat-card border-l-4 border-l-primary-blue">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-primary-blue/20">👥</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">ASSIGNED USERS</p>
              <p className="text-2xl font-dm-serif text-dark-text">{loading ? "—" : stats.assignedUsers}</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-primary-blue to-teal" />
        </Card>

        <Card variant="white" className="stat-card border-l-4 border-l-error-red">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-error-red/30">🚨</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">ACTIVE CASES</p>
              <p className="text-2xl font-dm-serif text-dark-text">{loading ? "—" : stats.activeCases}</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-red-400 to-pink-300" />
        </Card>

        <Card variant="white" className="stat-card border-l-4 border-l-lavender">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-lavender/20">💬</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">PENDING MESSAGES</p>
              <p className="text-2xl font-dm-serif text-dark-text">{loading ? "—" : stats.pendingMessages}</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-purple-400 to-pink-300" />
        </Card>
      </div>

      {/* ── ASSIGNED USERS WELLNESS PANEL ─────────────────────────────────── */}
      <Card variant="white" className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#B7E4C7]/30 rounded-lg flex items-center justify-center">💚</div>
            <div>
              <p className="text-xs font-poppins text-dark-text/70 uppercase tracking-wider">
                ASSIGNED USERS — WELLNESS OVERVIEW
              </p>
              <p className="text-[10px] text-dark-text/40 font-inter mt-0.5">
                Latest 30-day Wellness Score per user · updated automatically
              </p>
            </div>
          </div>
          <Link
            href="/counselor/assigned-users"
            className="text-xs font-poppins text-[#A8DADC] hover:underline"
          >
            View All →
          </Link>
        </div>

        {loading || wellnessLoading ? (
          <p className="text-sm text-dark-text/50 py-3 font-inter">Loading wellness data…</p>
        ) : assignedUsers.length === 0 ? (
          <p className="text-sm text-dark-text/70 font-inter">No users assigned to you yet.</p>
        ) : (
          <div className="divide-y divide-[#F5F5F5]">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 pb-2">
              <span className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/50">User</span>
              <span className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/50 text-right">Wellness</span>
              <span className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/50 text-right">Risk</span>
              <span className="text-[10px] font-poppins uppercase tracking-wider text-dark-text/50 text-right">Updated</span>
            </div>

            {/* Rows */}
            {assignedUsers.map((u) => {
              const snap = wellnessMap.get(u.id);
              const riskSnap = riskMap.get(u.id);
              const lvl = snap?.wellness_level
                ? (snap.wellness_level as WellnessLevel)
                : snap?.wellness_score != null
                ? classifyWellnessLevel(snap.wellness_score)
                : null;
              const riskLvl = (riskSnap?.risk_level as DistressRiskLevel) ?? null;
              const isAtRisk = lvl === "At Risk" || lvl === "High Risk";
              const isCritical = riskLvl === "Critical Risk" || riskLvl === "High Risk";
              const flagged = isAtRisk || isCritical;

              return (
                <div
                  key={u.id}
                  className={`grid grid-cols-[1fr_auto_auto_auto] gap-3 py-2.5 items-center ${
                    flagged ? "bg-[#FFF1F1] -mx-1 px-1 rounded-lg" : ""
                  }`}
                >
                  {/* User name */}
                  <div className="flex items-center gap-2 min-w-0">
                    {flagged && (
                      <span className="text-[#f77f7f] text-xs shrink-0" title="Flagged user">⚠</span>
                    )}
                    <span className="text-sm font-poppins text-dark-text truncate">
                      {displayName(u)}
                    </span>
                  </div>

                  {/* Wellness badge */}
                  <div className="flex justify-end">
                    <WellnessBadge
                      score={snap?.wellness_score ?? null}
                      level={snap?.wellness_level ?? null}
                    />
                  </div>

                  {/* Risk badge */}
                  <div className="flex justify-end">
                    <RiskBadge riskLevel={riskSnap?.risk_level ?? null} />
                  </div>

                  {/* Last updated */}
                  <span className="text-[10px] text-dark-text/40 font-inter text-right whitespace-nowrap">
                    {snap?.window_end_date
                      ? new Date(snap.window_end_date).toLocaleDateString("en-US", {
                          month: "short", day: "numeric",
                        })
                      : "—"}
                  </span>
                </div>
              );
            })}

            {/* At-Risk summary footer */}
            {(() => {
              const flaggedCount = assignedUsers.filter((u) => {
                const snap    = wellnessMap.get(u.id);
                const rSnap   = riskMap.get(u.id);
                const wLvl    = snap?.wellness_level as WellnessLevel | null;
                const rLvl    = rSnap?.risk_level as DistressRiskLevel | null;
                return (
                  wLvl === "At Risk" || wLvl === "High Risk" ||
                  rLvl === "High Risk" || rLvl === "Critical Risk"
                );
              }).length;
              if (flaggedCount === 0) return null;
              return (
                <div className="pt-3 flex items-center gap-2">
                  <span className="text-xs text-[#f77f7f] font-poppins font-semibold">
                    ⚠ {flaggedCount} user{flaggedCount !== 1 ? "s" : ""} flagged (At Risk / High Risk / Critical Risk)
                  </span>
                  <Link
                    href="/counselor/cases"
                    className="text-[10px] text-[#A8DADC] font-poppins hover:underline ml-auto"
                  >
                    Review cases →
                  </Link>
                </div>
              );
            })()}
          </div>
        )}
      </Card>
      {/* ── END WELLNESS PANEL ────────────────────────────────────────────── */}

      {/* Bottom Row — Cases + Messages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Cases */}
        <Card variant="white" className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#F4A6A6]/20 rounded-lg flex items-center justify-center">🚨</div>
              <p className="text-xs font-poppins text-dark-text/70">RECENT CASES</p>
            </div>
            <Link href="/counselor/cases" className="text-xs font-poppins text-[#A8DADC] hover:underline">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-dark-text/70 font-inter">Loading cases…</p>
            ) : recentCases.length === 0 ? (
              <p className="text-sm text-dark-text/70 font-inter">No cases yet.</p>
            ) : recentCases.map((c, i) => {
              const snap    = wellnessMap.get(c.user_id);
              const rSnap   = riskMap.get(c.user_id);
              return (
                <div
                  key={c.id || i}
                  className="p-3 bg-[#F4A6A6]/10 rounded-xl border border-[#F4A6A6]/30"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold font-poppins text-dark-text truncate">
                        {c.trigger || "Case"}
                      </p>
                      <p className="text-xs text-dark-text/70 font-inter">
                        {c.severity || "Recent"} · {formatTime(c.created_at)}
                      </p>
                    </div>
                    <Link
                      href="/counselor/cases"
                      className="px-3 py-1 bg-[#F4A6A6]/30 text-[#F4A6A6] rounded-full text-xs font-semibold font-poppins shrink-0"
                    >
                      View
                    </Link>
                  </div>
                  {/* Inline wellness + risk badges */}
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {snap && snap.wellness_score !== null && (
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-dark-text/40 font-inter">Wellness:</span>
                        <WellnessBadge score={snap.wellness_score} level={snap.wellness_level} />
                      </div>
                    )}
                    {rSnap?.risk_level && (
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-dark-text/40 font-inter">Risk:</span>
                        <RiskBadge riskLevel={rSnap.risk_level} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Recent Messages */}
        <Card variant="white" className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center">💬</div>
              <p className="text-xs font-poppins text-dark-text/70">RECENT MESSAGES</p>
            </div>
            <Link href="/counselor/messages" className="text-xs font-poppins text-[#A8DADC] hover:underline">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-dark-text/70 font-inter">Loading messages…</p>
            ) : recentMessages.length === 0 ? (
              <p className="text-sm text-dark-text/70 font-inter">No messages yet.</p>
            ) : recentMessages.map((m, i) => (
              <div
                key={m.id || i}
                className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center"
              >
                <div>
                  <p className="text-sm font-semibold font-poppins text-dark-text">New Message</p>
                  <p className="text-xs text-dark-text/70 font-inter">{formatTime(m.created_at)}</p>
                </div>
                <Link
                  href="/counselor/messages"
                  className="px-3 py-1 bg-[#CDB4DB]/30 text-[#CDB4DB] rounded-full text-xs font-semibold font-poppins"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
