"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Portal } from "@/components/ui/Portal";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDisplayId, loadDisplayIdFormat, type DisplayIdFormat } from "@/lib/display-ids";
import { Toast, useToast } from "@/components/ui/Toast";
import {
  WELLNESS_LEVEL_CONFIG,
  classifyWellnessLevel,
  type WellnessLevel,
} from "@/lib/wellness-assessment";
import {
  DISTRESS_RISK_CONFIG,
  type DistressRiskLevel,
} from "@/lib/distress-risk";

// ── Types ────────────────────────────────────────────────────────────────────

interface RawUser {
  id: string;
  age: number | null;
  sex: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  assigned_counselor_id: string | null;
}

interface CounselorProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  username: string | null;
}

interface WellnessRow {
  user_id: string;
  wellness_score: number | null;
  wellness_level: string | null;
  consecutive_negative_count: number;
  behavioral_trend_score: number;
  journaling_frequency_score: number;
  mood_consistency_score: number;
  total_entries_window: number;
  window_end_date: string;
}

interface RiskRow {
  user_id: string;
  risk_level: string;
  total_points: number;
  assessed_date: string;
}

interface DistressLogRow {
  id: string;
  user_id: string;
  severity: string | null;
  notes: string | null;
}

interface JournalRow {
  user_id: string;
  mood: string | null;
  sentiment: string | null;
  created_at: string;
}

type SortKey = "lastActive" | "wellness" | "streak" | "status";
type SortDir = "asc" | "desc";

// ── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const moodToScore: Record<string, number> = {
  Happy: 8, Neutral: 5, Sad: 3, Frustrated: 4,
  Calm: 7, Excited: 9, Confused: 5, Overwhelmed: 2,
};

function getLastActive(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(diff / 86400000);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function getLastActiveMs(dateStr: string | null): number {
  if (!dateStr) return 0;
  return new Date(dateStr).getTime();
}

function WellnessBadge({ score, level }: { score: number | null; level: string | null }) {
  if (score == null) return <span className="text-xs text-slate-400 font-inter">—</span>;
  const lvl = (level as WellnessLevel) ?? classifyWellnessLevel(score);
  const cfg = WELLNESS_LEVEL_CONFIG[lvl] ?? WELLNESS_LEVEL_CONFIG["Stable"];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-poppins font-medium whitespace-nowrap"
      style={{ backgroundColor: cfg.bgColor, color: cfg.color }}
    >
      {cfg.emoji} {score.toFixed(1)}
    </span>
  );
}

function RiskBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-xs text-slate-400 font-inter">—</span>;
  const cfg = DISTRESS_RISK_CONFIG[level as DistressRiskLevel] ?? DISTRESS_RISK_CONFIG["Low Risk"];
  const isBad = level === "Critical Risk" || level === "High Risk";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-poppins font-semibold whitespace-nowrap ${isBad
      ? "border-rose-200 bg-rose-100 text-rose-800"
      : level === "Moderate Risk"
        ? "border-amber-200 bg-amber-100 text-amber-900"
        : "border-emerald-200 bg-emerald-100 text-emerald-800"
      }`}>
      {cfg.emoji} {level}
    </span>
  );
}

function SortableHeader({
  label, sortKey, currentSort, dir, onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = currentSort === sortKey;
  return (
    <th className="cursor-pointer select-none whitespace-nowrap" onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[10px] ${active ? "opacity-100" : "opacity-30"}`}>
          {active && dir === "asc" ? "↑" : "↓"}
        </span>
      </span>
    </th>
  );
}

// ── Processed user ────────────────────────────────────────────────────────────

interface ProcessedUser {
  id: string;
  displayId: string;
  age: string;
  sex: string;
  entries: number;
  lastActive: string;
  lastActiveMs: number;
  avgMood: string | null;
  sentiment: string;
  activityStatus: string;
  isAccountActive: boolean;
  wellness: WellnessRow | null;
  risk: RiskRow | null;
  openCases: DistressLogRow[];
  worstSeverity: "critical" | "medium" | null;
  counselorId: string | null;
  counselorName: string;
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function DetailModal({
  user, onClose, displayIdFormat, casesBasePath,
}: {
  user: ProcessedUser;
  onClose: () => void;
  displayIdFormat: DisplayIdFormat;
  casesBasePath: string;
}) {
  const w = user.wellness;
  const r = user.risk;
  const wLvl = w?.wellness_level as WellnessLevel | null;

  const openCritical = user.openCases.filter(
    (c) => (c.severity || "").toLowerCase() === "critical"
  );
  const openMedium = user.openCases.filter((c) =>
    ["medium", "warning"].includes((c.severity || "").toLowerCase())
  );

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl z-10 m-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-dm-serif text-dark-text">User Details</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-slate-500" aria-label="Close">✕</button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-poppins text-slate-600 uppercase tracking-wider mb-1">User ID</p>
              <p className="text-sm font-poppins text-dark-text font-semibold">{user.displayId}</p>
            </div>
            <div>
              <p className="text-xs font-poppins text-slate-600 uppercase tracking-wider mb-1">Age</p>
              <p className="text-sm font-poppins text-dark-text">{user.age}</p>
            </div>
            <div>
              <p className="text-xs font-poppins text-slate-600 uppercase tracking-wider mb-1">Sex</p>
              <p className="text-sm font-poppins text-dark-text">{user.sex}</p>
            </div>
            <div>
              <p className="text-xs font-poppins text-slate-600 uppercase tracking-wider mb-1">Account Status</p>
              {user.isAccountActive ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-100 text-emerald-800 text-xs font-semibold">Active</span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-slate-100 text-slate-700 text-xs font-semibold">Deactivated</span>
              )}
            </div>
            <div>
              <p className="text-xs font-poppins text-slate-600 uppercase tracking-wider mb-1">Journal Entries</p>
              <p className="text-sm font-poppins text-dark-text">{user.entries}</p>
            </div>
            <div>
              <p className="text-xs font-poppins text-slate-600 uppercase tracking-wider mb-1">Avg Mood</p>
              <p className="text-sm font-poppins text-dark-text">{user.avgMood ?? "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-poppins text-slate-600 uppercase tracking-wider mb-1">Assigned Counselor</p>
              <p className="text-sm font-poppins text-dark-text">{user.counselorName}</p>
            </div>
          </div>

          {/* Wellness */}
          <div className="mt-5 rounded-xl bg-slate-50 p-4 space-y-3">
            <p className="text-xs font-poppins font-semibold uppercase tracking-wider text-slate-600">Wellness (30-day)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Score / Level</p>
                {w ? (
                  <WellnessBadge score={w.wellness_score} level={w.wellness_level} />
                ) : (
                  <span className="text-xs text-slate-400">No data</span>
                )}
                {wLvl && <p className="text-xs text-slate-600 mt-1">{wLvl}</p>}
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Negative Streak</p>
                <p className="text-sm font-poppins font-semibold text-dark-text">
                  {w != null ? w.consecutive_negative_count : "—"}
                  {w && w.consecutive_negative_count > 0 && (
                    <span className="ml-1 text-xs font-normal text-amber-600">consecutive</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Behavioral Trend</p>
                <p className="text-sm font-poppins text-dark-text">{w != null ? w.behavioral_trend_score.toFixed(1) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Journaling Freq.</p>
                <p className="text-sm font-poppins text-dark-text">{w != null ? `${w.journaling_frequency_score.toFixed(0)}/100` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Mood Consistency</p>
                <p className="text-sm font-poppins text-dark-text">{w != null ? `${w.mood_consistency_score.toFixed(0)}/100` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Entries Analyzed</p>
                <p className="text-sm font-poppins text-dark-text">{w != null ? w.total_entries_window : "—"}</p>
              </div>
            </div>
          </div>

          {/* Distress risk */}
          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-poppins font-semibold uppercase tracking-wider text-slate-600 mb-2">Distress Risk</p>
            {r ? (
              <div className="flex items-center gap-4 flex-wrap">
                <RiskBadge level={r.risk_level} />
                <span className="text-xs text-slate-500">{r.total_points} pts · {new Date(r.assessed_date).toLocaleDateString()}</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400">No assessment data</span>
            )}
          </div>

          {/* Open cases */}
          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-poppins font-semibold uppercase tracking-wider text-slate-600 mb-2">
              Open Cases ({user.openCases.length})
            </p>
            {user.openCases.length === 0 ? (
              <p className="text-xs text-slate-400">No open cases.</p>
            ) : (
              <div className="space-y-1.5">
                {openCritical.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-error-red shrink-0" />
                    <Link
                      href={`${casesBasePath}?search=${encodeURIComponent(user.displayId)}`}
                      className="text-xs font-poppins text-error-red hover:underline"
                      onClick={onClose}
                    >
                      {openCritical.length} Critical case{openCritical.length !== 1 ? "s" : ""} → View on Cases page
                    </Link>
                  </div>
                )}
                {openMedium.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <Link
                      href={`${casesBasePath}?search=${encodeURIComponent(user.displayId)}`}
                      className="text-xs font-poppins text-amber-700 hover:underline"
                      onClick={onClose}
                    >
                      {openMedium.length} Medium case{openMedium.length !== 1 ? "s" : ""} → View on Cases page
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end mt-6">
            <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-dark-text font-poppins text-sm rounded-lg">
              Close
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ── Mobile action menu ────────────────────────────────────────────────────────

function ActionMenu({
  user, onView, casesBasePath,
}: {
  user: ProcessedUser;
  onView: () => void;
  casesBasePath: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-gray-50"
        aria-label="More actions"
      >⋯</button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-36 rounded-xl border border-gray-100 bg-white shadow-lg py-1">
          <button
            className="w-full text-left px-3 py-2 text-sm font-poppins text-dark-text hover:bg-gray-50"
            onClick={() => { setOpen(false); onView(); }}
          >View</button>
          {user.openCases.length > 0 && (
            <Link
              href={`${casesBasePath}?search=${encodeURIComponent(user.displayId)}`}
              className="block px-3 py-2 text-sm font-poppins text-dark-text hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${user.worstSeverity === "critical" ? "bg-error-red" : "bg-amber-500"}`} />
                Review
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HeadCounselorAssignedUsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [streakFilter, setStreakFilter] = useState("All");
  const [counselorFilter, setCounselorFilter] = useState("All");
  const [caseFilter, setCaseFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("lastActive");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [users, setUsers] = useState<RawUser[]>([]);
  const [journalRows, setJournalRows] = useState<JournalRow[]>([]);
  const [wellnessMap, setWellnessMap] = useState<Map<string, WellnessRow>>(new Map());
  const [riskMap, setRiskMap] = useState<Map<string, RiskRow>>(new Map());
  const [distressLogs, setDistressLogs] = useState<DistressLogRow[]>([]);
  const [counselors, setCounselors] = useState<CounselorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [detailUser, setDetailUser] = useState<ProcessedUser | null>(null);
  const [assignSelections, setAssignSelections] = useState<Record<string, string>>({});
  const [assignLoading, setAssignLoading] = useState<Record<string, boolean>>({});
  const [displayIdFormat, setDisplayIdFormat] = useState<DisplayIdFormat>("anonymized");
  const { user: currentUser } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const { toast, showToast, closeToast } = useToast();

  const handleAssignCounselor = async (userId: string, counselorId: string) => {
    if (!counselorId) { showToast("Please select a counselor.", "error"); return; }
    setAssignLoading(prev => ({ ...prev, [userId]: true }));
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ assigned_counselor_id: counselorId })
        .eq("id", userId)
        .eq("role", "user");
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, assigned_counselor_id: counselorId } : u));
      showToast("Counselor assigned successfully.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to assign counselor.", "error");
    } finally {
      setAssignLoading(prev => { const next = { ...prev }; delete next[userId]; return next; });
    }
  };

  const CASES_PATH = "/head-counselor/cases";

  useEffect(() => { loadDisplayIdFormat(supabase).then(setDisplayIdFormat); }, [supabase]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Head Counselor sees ALL users
        const { data: usersData, error: usersError } = await supabase
          .from("user_profiles")
          .select("id,age,sex,is_active,created_at,updated_at,assigned_counselor_id")
          .eq("role", "user")
          .order("created_at", { ascending: false })
          .limit(500);

        if (usersError) throw usersError;
        const userList = (usersData || []) as RawUser[];
        setUsers(userList);

        if (userList.length === 0) {
          setJournalRows([]); setDistressLogs([]);
          setWellnessMap(new Map()); setRiskMap(new Map());
          setCounselors([]);
          return;
        }

        const userIds = userList.map((u) => u.id);

        // Fetch counselor profiles (for the Counselor column + filter)
        const counselorIds = [...new Set(
          userList.map((u) => u.assigned_counselor_id).filter(Boolean) as string[]
        )];

        const [
          { data: journalData },
          { data: wellnessData },
          { data: riskData },
          { data: distressData },
          counselorResult,
        ] = await Promise.all([
          supabase.from("journal_entries")
            .select("user_id,mood,sentiment,created_at")
            .in("user_id", userIds)
            .order("created_at", { ascending: false })
            .limit(2000),
          supabase.from("behavioral_indicators")
            .select("user_id,wellness_score,wellness_level,consecutive_negative_count,behavioral_trend_score,journaling_frequency_score,mood_consistency_score,total_entries_window,window_end_date")
            .in("user_id", userIds)
            .eq("lookback_days", 30)
            .order("window_end_date", { ascending: false }),
          supabase.from("distress_risk_assessments")
            .select("user_id,risk_level,total_points,assessed_date")
            .in("user_id", userIds)
            .eq("lookback_days", 30)
            .order("assessed_date", { ascending: false }),
          supabase.from("distress_logs")
            .select("id,user_id,severity,notes")
            .in("user_id", userIds),
          counselorIds.length > 0
            ? supabase.from("user_profiles")
              .select("id,first_name,last_name,full_name,username")
              .in("id", counselorIds)
            : Promise.resolve({ data: [] }),
        ]);

        setJournalRows((journalData || []) as JournalRow[]);
        setDistressLogs((distressData || []) as DistressLogRow[]);
        setCounselors((counselorResult.data || []) as CounselorProfile[]);

        const wMap = new Map<string, WellnessRow>();
        for (const row of (wellnessData || []) as WellnessRow[]) {
          if (!wMap.has(row.user_id)) wMap.set(row.user_id, row);
        }
        setWellnessMap(wMap);

        const rMap = new Map<string, RiskRow>();
        for (const row of (riskData || []) as RiskRow[]) {
          if (!rMap.has(row.user_id)) rMap.set(row.user_id, row);
        }
        setRiskMap(rMap);
      } catch (err) {
        console.error("Error fetching all users data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser, supabase]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, streakFilter, counselorFilter, caseFilter, sortKey, sortDir]);

  // Build counselor lookup map
  const counselorById = useMemo(() => {
    const m = new Map<string, CounselorProfile>();
    counselors.forEach((c) => m.set(c.id, c));
    return m;
  }, [counselors]);

  function getCounselorDisplayName(c: CounselorProfile | undefined): string {
    if (!c) return "Unassigned";
    if (c.first_name && c.last_name) return `${c.first_name} ${c.last_name}`;
    if (c.full_name) return c.full_name;
    if (c.username) return c.username;
    return c.id.slice(0, 8);
  }

  // Build processed users
  const processedUsers: ProcessedUser[] = useMemo(() => users.map((user) => {
    const userJournal = journalRows.filter((e) => e.user_id === user.id);
    const lastEntry = userJournal[0];
    const entryCount = userJournal.length;

    const moods = userJournal.map((e) => e.mood).filter(Boolean) as string[];
    const avgMoodScore = moods.length > 0
      ? Math.round(moods.reduce((s, m) => s + (moodToScore[m] || 5), 0) / moods.length)
      : null;

    let sentiment = "No Data";
    let activityStatus = "Inactive";
    if (userJournal.length > 0) {
      const counts = { positive: 0, negative: 0, distress: 0 };
      for (const e of userJournal) {
        const s = (e.sentiment as string | null) ?? "";
        if (s === "positive") counts.positive++;
        else if (s === "distress") counts.distress++;
        else if (s === "negative") counts.negative++;
      }
      if (counts.distress > 0) sentiment = "Distress";
      else if (counts.negative >= counts.positive) sentiment = "Negative";
      else if (counts.positive > 0) sentiment = "Positive";

      const daysSince = lastEntry
        ? Math.floor((Date.now() - new Date(lastEntry.created_at).getTime()) / 86400000)
        : 999;
      if (daysSince < 30) activityStatus = "Active";
      if (sentiment === "Negative" && avgMoodScore != null && avgMoodScore < 5) activityStatus = "At Risk";
    }

    const displayId = formatDisplayId(user.id, "user", displayIdFormat);
    const wellness = wellnessMap.get(user.id) ?? null;
    const risk = riskMap.get(user.id) ?? null;
    // "Open" = Complete Review has NOT been done.
    // Complete Review writes "acknowledged" or "resolved" into notes (case-insensitive),
    // matching getResponseStatus() on the Cases page.
    const openCases = distressLogs.filter((l) => {
      if (l.user_id !== user.id) return false;
      const n = (l.notes ?? "").toLowerCase();
      return !n.includes("acknowledged") && !n.includes("resolved");
    });
    const hasCritical = openCases.some((c) => (c.severity || "").toLowerCase() === "critical");
    const hasMedium = openCases.some((c) => ["medium", "warning"].includes((c.severity || "").toLowerCase()));
    const counselorProfile = user.assigned_counselor_id ? counselorById.get(user.assigned_counselor_id) : undefined;

    return {
      id: user.id,
      displayId,
      age: user.age != null ? String(user.age) : "—",
      sex: user.sex ?? "—",
      entries: entryCount,
      lastActive: getLastActive(lastEntry?.created_at || user.updated_at || user.created_at),
      lastActiveMs: getLastActiveMs(lastEntry?.created_at || user.updated_at || user.created_at),
      avgMood: avgMoodScore != null ? `${avgMoodScore}/10` : null,
      sentiment,
      activityStatus,
      isAccountActive: user.is_active !== false,
      wellness,
      risk,
      openCases,
      worstSeverity: hasCritical ? "critical" : hasMedium ? "medium" : null,
      counselorId: user.assigned_counselor_id,
      counselorName: getCounselorDisplayName(counselorProfile),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [users, journalRows, wellnessMap, riskMap, distressLogs, displayIdFormat, counselorById]);

  // Filter
  const filteredUsers = useMemo(() => processedUsers.filter((u) => {
    if (!u.displayId.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (statusFilter !== "All") {
      if (statusFilter === "Deactivated" && u.isAccountActive) return false;
      if (statusFilter !== "Deactivated" && (!u.isAccountActive || u.activityStatus !== statusFilter)) return false;
    }
    if (streakFilter === "High" && (u.wellness?.consecutive_negative_count ?? 0) < 3) return false;
    if (streakFilter === "Low") {
      const cnt = u.wellness?.consecutive_negative_count ?? 0;
      if (cnt < 1 || cnt > 2) return false;
    }
    if (counselorFilter === "Me") {
      if (u.counselorId !== currentUser?.id) return false;
    } else if (counselorFilter === "Unassigned") {
      if (u.counselorId != null) return false;
    } else if (counselorFilter !== "All") {
      if (u.counselorId !== counselorFilter) return false;
    }
    if (caseFilter === "Critical" && !u.openCases.some((c) => (c.severity || "").toLowerCase() === "critical")) return false;
    if (caseFilter === "Medium" && !u.openCases.some((c) => ["medium", "warning"].includes((c.severity || "").toLowerCase()))) return false;
    if (caseFilter === "None" && u.openCases.length > 0) return false;
    return true;
  }), [processedUsers, searchTerm, statusFilter, streakFilter, counselorFilter, caseFilter, currentUser]);

  // Sort
  const sortedUsers = useMemo(() => [...filteredUsers].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "lastActive") cmp = a.lastActiveMs - b.lastActiveMs;
    else if (sortKey === "wellness") cmp = (a.wellness?.wellness_score ?? -1) - (b.wellness?.wellness_score ?? -1);
    else if (sortKey === "streak") cmp = (a.wellness?.consecutive_negative_count ?? 0) - (b.wellness?.consecutive_negative_count ?? 0);
    else if (sortKey === "status") cmp = a.activityStatus.localeCompare(b.activityStatus);
    return sortDir === "asc" ? cmp : -cmp;
  }), [filteredUsers, sortKey, sortDir]);

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const totalUsers = users.length;
  const activeUsers = processedUsers.filter((u) => u.isAccountActive && u.activityStatus === "Active").length;
  const atRiskUsers = processedUsers.filter((u) => u.isAccountActive && u.activityStatus === "At Risk").length;
  const inactiveUsers = processedUsers.filter((u) => !u.isAccountActive || u.activityStatus === "Inactive").length;

  const totalPages = Math.ceil(sortedUsers.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedUsers = sortedUsers.slice(startIndex, startIndex + PAGE_SIZE);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue mx-auto mb-4" />
          <p className="text-slate-600 font-poppins">Loading users…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toast {...toast} onClose={closeToast} />
      {detailUser && (
        <DetailModal
          user={detailUser}
          onClose={() => setDetailUser(null)}
          displayIdFormat={displayIdFormat}
          casesBasePath={CASES_PATH}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-1">All Users</h1>
          <p className="text-sm text-slate-600 font-poppins">{totalUsers} total users</p>
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
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur-md">
        <div className="flex-1 min-w-[220px]">
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
          <option value="Deactivated">Deactivated</option>
        </select>
        <select
          className="px-4 py-3 border border-gray-300 rounded-xl text-sm font-poppins text-dark-text bg-white"
          value={streakFilter}
          onChange={(e) => setStreakFilter(e.target.value)}
        >
          <option value="All">All Streaks</option>
          <option value="High">Negative Streak High (3+)</option>
          <option value="Low">Negative Streak Low (1–2)</option>
        </select>
        <select
          className="px-4 py-3 border border-gray-300 rounded-xl text-sm font-poppins text-dark-text bg-white"
          value={counselorFilter}
          onChange={(e) => setCounselorFilter(e.target.value)}
        >
          <option value="All">All Counselors</option>
          <option value="Me">Me</option>
          <option value="Unassigned">Unassigned</option>
          {counselors.map((c) => (
            <option key={c.id} value={c.id}>{getCounselorDisplayName(c)}</option>
          ))}
        </select>
        <select
          className="px-4 py-3 border border-gray-300 rounded-xl text-sm font-poppins text-dark-text bg-white"
          value={caseFilter}
          onChange={(e) => setCaseFilter(e.target.value)}
        >
          <option value="All">Any Case</option>
          <option value="Critical">Has Critical</option>
          <option value="Medium">Has Medium</option>
          <option value="None">No Cases</option>
        </select>
      </div>

      {/* Table */}
      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="admin-table min-w-[1100px] table-fixed">
            <thead>
              <tr>
                <th>USER ID</th>
                <th>COUNSELOR</th>
                <SortableHeader label="LAST ACTIVE" sortKey="lastActive" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHeader label="WELLNESS" sortKey="wellness" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHeader label="STREAK" sortKey="streak" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                <th>SENTIMENT</th>
                <SortableHeader label="STATUS" sortKey="status" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-slate-600">No users match the current filters.</td>
                </tr>
              )}
              {paginatedUsers.map((user) => {
                const streak = user.wellness?.consecutive_negative_count ?? null;
                const streakHigh = streak != null && streak >= 3;
                const streakLow = streak != null && streak >= 1 && streak <= 2;
                return (
                  <tr key={user.id}>
                    <td className="py-4 px-3">
                      <p className="font-poppins text-sm font-semibold text-slate-900">{user.displayId}</p>
                    </td>
                    <td className="py-4 px-3">
                      <p className="text-sm font-inter text-slate-600 truncate max-w-[120px]">{user.counselorName}</p>
                    </td>
                    <td className="py-4 px-3">
                      <p className="text-sm font-inter text-slate-600">{user.lastActive}</p>
                    </td>
                    <td className="py-4 px-3">
                      <WellnessBadge score={user.wellness?.wellness_score ?? null} level={user.wellness?.wellness_level ?? null} />
                    </td>
                    <td className="py-4 px-3">
                      {streak == null ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${streakHigh
                          ? "border-rose-200 bg-rose-100 text-rose-800"
                          : streakLow
                            ? "border-amber-200 bg-amber-100 text-amber-800"
                            : "border-slate-200 bg-slate-100 text-slate-700"
                          }`}>
                          {streak}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-3">
                      <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${user.sentiment === "Positive" ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                        : user.sentiment === "Neutral" ? "border-indigo-200 bg-indigo-100 text-indigo-800"
                          : user.sentiment === "Negative" || user.sentiment === "Distress" ? "border-rose-200 bg-rose-100 text-rose-800"
                            : "border-slate-200 bg-slate-100 text-slate-800"
                        }`}>
                        {user.sentiment}
                      </span>
                    </td>
                    <td className="py-4 px-3">
                      {!user.isAccountActive ? (
                        <span className="px-2.5 py-1 rounded-full border border-slate-300 bg-slate-100 text-xs font-semibold text-slate-800">Deactivated</span>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${user.activityStatus === "Active" ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                          : user.activityStatus === "At Risk" ? "border-amber-200 bg-amber-100 text-amber-900"
                            : "border-slate-200 bg-slate-100 text-slate-800"
                          }`}>
                          {user.activityStatus}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-3">
                      {/* Desktop */}
                      <div className="hidden sm:flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setDetailUser(user)}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-slate-800"
                        >
                          View
                        </button>
                        {/* Assign Counselor inline */}
                        <select
                          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-poppins text-dark-text focus:outline-none focus:ring-1 focus:ring-primary-blue/30 max-w-[140px]"
                          value={assignSelections[user.id] ?? user.counselorId ?? ""}
                          onChange={e => setAssignSelections(prev => ({ ...prev, [user.id]: e.target.value }))}
                        >
                          <option value="">Unassigned</option>
                          {counselors.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.full_name || c.username || c.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssignCounselor(user.id, assignSelections[user.id] ?? user.counselorId ?? "")}
                          disabled={!!assignLoading[user.id]}
                          className="rounded-lg bg-[#A8DADC] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-[#4EAAB3] disabled:opacity-50"
                        >
                          {assignLoading[user.id] ? "..." : user.counselorId ? "Reassign" : "Assign"}
                        </button>
                        {user.openCases.length > 0 && (
                          <Link
                            href={`${CASES_PATH}?search=${encodeURIComponent(user.displayId)}`}
                            className="relative inline-flex items-center gap-1.5 rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-gray-50"
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${user.worstSeverity === "critical" ? "bg-error-red" : "bg-amber-500"}`} />
                            Review
                          </Link>
                        )}
                      </div>
                      {/* Mobile */}
                      <div className="sm:hidden">
                        <ActionMenu user={user} onView={() => setDetailUser(user)} casesBasePath={CASES_PATH} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sortedUsers.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-slate-600 font-poppins">
              Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, sortedUsers.length)} of {sortedUsers.length} users
            </p>
            <div className="flex items-center gap-1 flex-wrap justify-center">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-dark-text text-sm"
              >←</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | "…")[]>((acc, p, i, arr) => {
                  if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                  acc.push(p); return acc;
                }, [])
                .map((item, idx) =>
                  item === "…" ? (
                    <span key={`e${idx}`} className="w-9 h-9 flex items-center justify-center text-slate-400 text-sm">…</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item as number)}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-poppins transition-colors ${currentPage === item ? "bg-gradient-to-r from-primary-blue to-lavender text-white" : "text-dark-text hover:bg-gray-100"
                        }`}
                    >{item}</button>
                  )
                )}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-dark-text text-sm"
              >→</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
