"use client";

// ============================================================
// app/head-counselor/distress-alerts/page.tsx
//
// Head Counselor Distress Alerts — full view + assignment.
// Head counselor can assign/reassign counselors to students.
// Admin/Owner can also see (read-only from their own panel).
// ============================================================

import { Card } from "@/components/ui/card";
import { Portal } from "@/components/ui/Portal";
import { Toast, useToast } from "@/components/ui/Toast";
import {
  ManagementFilterBar,
  type ManagementRiskFilter,
  type ManagementStatusFilter,
} from "@/components/management/ManagementFilterBar";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DISTRESS_RISK_CONFIG,
  type DistressRiskLevel,
} from "@/lib/distress-risk";
import { formatDisplayId, loadDisplayIdFormat, type DisplayIdFormat } from "@/lib/display-ids";

type JournalEntry = {
  id: string;
  user_id: string;
  title: string | null;
  content: string | null;
  mood: string | null;
  created_at: string;
};

type UserProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
};

type Conversation = {
  id: string;
  user_id: string;
  counselor_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type DistressLog = {
  id: string;
  user_id: string;
  severity: string | null;
  trigger: string | null;
  notes: string | null;
  created_at: string;
};

type UserRiskSnapshot = {
  user_id: string;
  risk_level: string;
  total_points: number;
};

const formatTrigger = (trigger: string | null): string => {
  if (!trigger) return "Detected distress trigger";
  return trigger.replace(
    /Journal entry [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:/gi,
    "Entry:"
  );
};

const getResponseStatus = (notes?: string | null) => {
  if (!notes || !notes.trim()) return "Pending";
  if (notes.toLowerCase().includes("resolved") || notes.toLowerCase().includes("acknowledged")) {
    return "Acknowledged";
  }
  return "Responded";
};

const getProfileName = (profile?: UserProfile | null) => {
  if (!profile) return "Unassigned";
  return profile.full_name || profile.username || profile.id.slice(0, 8);
};

const groupEntriesByUser = (entries: JournalEntry[]) => {
  return entries.reduce<Record<string, JournalEntry[]>>((acc, entry) => {
    const userId = entry.user_id;
    acc[userId] = acc[userId] || [];
    acc[userId].push(entry);
    return acc;
  }, {});
};

export default function HeadCounselorDistressAlertsPage() {
  const [logs, setLogs] = useState<DistressLog[]>([]);
  const [entriesByUser, setEntriesByUser] = useState<Record<string, JournalEntry[]>>({});
  const [counselors, setCounselors] = useState<UserProfile[]>([]);
  const [conversationsByUser, setConversationsByUser] = useState<Record<string, Conversation>>({});
  const [assignedCounselorByUser, setAssignedCounselorByUser] = useState<Record<string, string | null>>({});
  const [assignmentSelections, setAssignmentSelections] = useState<Record<string, string>>({});
  const [filterSearch, setFilterSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<ManagementRiskFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ManagementStatusFilter>("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [selectedAlert, setSelectedAlert] = useState<DistressLog | null>(null);
  const [riskByUser, setRiskByUser] = useState<Map<string, UserRiskSnapshot>>(new Map());
  const [loading, setLoading] = useState(false);
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [refreshToken, setRefreshToken] = useState(0);
  const [displayIdFormat, setDisplayIdFormat] = useState<DisplayIdFormat>("anonymized");
  const [reviewNotes, setReviewNotes] = useState("");
  const [staffProfiles, setStaffProfiles] = useState<Record<string, string>>({});
  const { user: currentUser } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const { toast, showToast, closeToast } = useToast();

  const RiskBadge = ({ userId }: { userId: string }) => {
    const snap = riskByUser.get(userId);
    if (!snap) return <span className="text-xs text-slate-600 font-inter italic">No data</span>;
    const lvl = snap.risk_level as DistressRiskLevel;
    const cfg = DISTRESS_RISK_CONFIG[lvl] ?? DISTRESS_RISK_CONFIG["Low Risk"];
    return (
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-poppins font-semibold ${
          lvl === "Critical Risk" || lvl === "High Risk"
            ? "border-rose-200 bg-rose-100 text-rose-800"
            : lvl === "Moderate Risk"
            ? "border-amber-200 bg-amber-100 text-amber-900"
            : "border-emerald-200 bg-emerald-100 text-emerald-800"
        }`}
        title={`${snap.total_points} point${snap.total_points !== 1 ? "s" : ""}`}
      >
        {cfg.emoji} {lvl}
      </span>
    );
  };

  useEffect(() => {
    if (!currentUser) return;
    loadDisplayIdFormat(supabase).then(setDisplayIdFormat);
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("distress_logs")
          .select("id,user_id,severity,trigger,notes,created_at")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;

        const rawLogs = (data || []) as DistressLog[];
        const { data: activeRows } = await supabase
          .from("distress_logs")
          .select("id,severity,notes")
          .in("severity", ["critical", "high", "Critical", "High"]);
        const unresolvedActiveCount = (activeRows || []).filter((row: { notes?: string | null }) => {
          const notes = row.notes?.toLowerCase() || "";
          return !notes.includes("resolved") && !notes.includes("acknowledged");
        }).length;

        const logUserIds = Array.from(new Set(rawLogs.map((log) => log.user_id).filter(Boolean))) as string[];

        // Load counselors (both counselor and head_counselor roles)
        const { data: counselorsData } = await supabase
          .from("user_profiles")
          .select("id,username,full_name")
          .in("role", ["counselor", "head_counselor"])
          .order("full_name", { ascending: true });

        const counselorProfiles = (counselorsData || []) as UserProfile[];

        let entries: JournalEntry[] = [];
        let conversations: Conversation[] = [];
        let profileAssignments: { id: string; assigned_counselor_id: string | null }[] = [];

        if (logUserIds.length > 0) {
          const [{ data: entriesData }, { data: conversationsData }, { data: profileAssignmentRows }] = await Promise.all([
            supabase.from("journal_entries")
              .select("id,user_id,title,content,mood,created_at")
              .in("user_id", logUserIds)
              .order("created_at", { ascending: false })
              .limit(200),
            supabase.from("conversations")
              .select("id,user_id,counselor_id,status,created_at,updated_at")
              .in("user_id", logUserIds)
              .eq("status", "open")
              .order("updated_at", { ascending: false }),
            supabase.from("user_profiles")
              .select("id,assigned_counselor_id")
              .in("id", logUserIds)
              .eq("role", "user"),
          ]);

          entries = (entriesData || []) as JournalEntry[];
          conversations = (conversationsData || []) as Conversation[];
          profileAssignments = (profileAssignmentRows || []) as typeof profileAssignments;
        }

        const sortedLogs = rawLogs.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        if (mounted) {
          const conversationsByUserId = conversations.reduce<Record<string, Conversation>>((acc, c) => {
            if (!acc[c.user_id]) acc[c.user_id] = c;
            return acc;
          }, {});
          const assignmentsByUserId = profileAssignments.reduce<Record<string, string | null>>((acc, p) => {
            acc[p.id] = p.assigned_counselor_id;
            return acc;
          }, {});

          let rMap = new Map<string, UserRiskSnapshot>();
          if (logUserIds.length > 0) {
            const { data: riskRows } = await supabase
              .from("distress_risk_assessments")
              .select("user_id, risk_level, total_points, assessed_date")
              .in("user_id", logUserIds)
              .eq("lookback_days", 30)
              .order("assessed_date", { ascending: false });

            const seen = new Set<string>();
            for (const row of (riskRows ?? [])) {
              if (!seen.has(row.user_id)) {
                seen.add(row.user_id);
                rMap.set(row.user_id, row as UserRiskSnapshot);
              }
            }
          }

          setLogs(sortedLogs);
          setActiveAlertCount(unresolvedActiveCount);
          setEntriesByUser(groupEntriesByUser(entries));
          setCounselors(counselorProfiles);
          setConversationsByUser(conversationsByUserId);
          setAssignedCounselorByUser(assignmentsByUserId);
          setRiskByUser(rMap);
          setAssignmentSelections((prev) => {
            const next = { ...prev };
            sortedLogs.forEach((log) => {
              const assignedId = assignmentsByUserId[log.user_id] || conversationsByUserId[log.user_id]?.counselor_id;
              if (assignedId && !next[log.id]) next[log.id] = assignedId;
            });
            return next;
          });
        }
      } catch (err: any) {
        showToast(err.message || "Failed to load distress logs", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(interval); };
  }, [currentUser, supabase, refreshToken]);

  // Resolve staff UUIDs in action notes
  useEffect(() => {
    if (!selectedAlert?.notes) return;
    const FULL_UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const SHORT_ID_RE = /\bstaff\s+([0-9a-f]{8})\b/gi;
    const fullIds = [...new Set(selectedAlert.notes.match(FULL_UUID_RE) || [])];
    const shortMatches = [...selectedAlert.notes.matchAll(SHORT_ID_RE)].map(m => m[1]);
    const shortIds = [...new Set(shortMatches)];
    const missingFullIds = fullIds.filter(id => !staffProfiles[id]);
    const missingShortIds = shortIds.filter(id => !staffProfiles[id]);
    const promises: Promise<any[]>[] = [];
    if (missingFullIds.length > 0) {
      promises.push(supabase.from("user_profiles").select("id,full_name,username,role").in("id", missingFullIds).then(({ data }: { data: any[] | null }) => data || []));
    }
    missingShortIds.forEach(shortId => {
      promises.push(supabase.from("user_profiles").select("id,full_name,username,role").ilike("id", `${shortId}%`).limit(1).then(({ data }: { data: any[] | null }) => data || []));
    });
    if (promises.length === 0) return;
    Promise.all(promises).then(results => {
      const map: Record<string, string> = {};
      results.flat().forEach((p: any) => {
        if (!p?.id) return;
        const name = p.full_name || p.username || p.id.slice(0, 8);
        const roleLabel = p.role === "owner" ? "Owner" : p.role === "admin" ? "Admin" : p.role === "head_counselor" ? "Head Counselor" : "Counselor";
        map[p.id] = `${roleLabel} ${name}`;
        map[p.id.slice(0, 8)] = `${roleLabel} ${name}`;
      });
      setStaffProfiles(prev => ({ ...prev, ...map }));
    });
  }, [selectedAlert?.notes]);

  const resolveNotesText = (notes: string | null) => {
    if (!notes) return notes;
    return notes
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, id => staffProfiles[id] || id.slice(0, 8))
      .replace(/\bstaff\s+([0-9a-f]{8})\b/gi, (_, short) => staffProfiles[short] || `staff ${short}`);
  };

  const criticalAlerts = logs.filter((l) => (l.severity || "").toLowerCase() === "critical");
  const mediumAlerts = logs.filter((l) => ["medium", "warning"].includes((l.severity || "").toLowerCase()));
  const respondedLogs = logs.filter((l) => !!(l.notes && l.notes.trim()));
  const responseRate = logs.length ? Math.round((respondedLogs.length / logs.length) * 100) : 0;

  const getAssignedCounselor = (alert: DistressLog) => {
    const counselorId = assignedCounselorByUser[alert.user_id] || conversationsByUser[alert.user_id]?.counselor_id;
    return counselors.find(c => c.id === counselorId) || null;
  };

  const filteredLogs = logs.filter((alert) => {
    const assignedCounselorId = assignedCounselorByUser[alert.user_id] || conversationsByUser[alert.user_id]?.counselor_id;
    const assignedCounselor = getAssignedCounselor(alert);
    const entrySearchText = (entriesByUser[alert.user_id] || []).map(e => `${e.title || ""} ${e.content || ""}`).join(" ");
    const searchText = [alert.id, alert.user_id, alert.trigger, alert.notes, getProfileName(assignedCounselor), entrySearchText].join(" ").toLowerCase();
    const matchesSearch = !filterSearch.trim() || searchText.includes(filterSearch.trim().toLowerCase());
    const riskLevel = riskByUser.get(alert.user_id)?.risk_level;
    const matchesRisk = riskFilter === "all" || (riskFilter === "critical" && (riskLevel === "Critical Risk" || riskLevel === "High Risk")) || (riskFilter === "moderate" && riskLevel === "Moderate Risk") || (riskFilter === "no-data" && !riskLevel);
    const responseStatus = getResponseStatus(alert.notes);
    const matchesStatus = statusFilter === "all" || (statusFilter === "pending" && responseStatus === "Pending") || (statusFilter === "responded" && responseStatus !== "Pending") || (statusFilter === "followed-up" && !!alert.notes?.trim());
    const matchesAssignment = assignmentFilter === "all" || (assignmentFilter === "unassigned" && !assignedCounselorId) || assignedCounselorId === assignmentFilter;
    return matchesSearch && matchesRisk && matchesStatus && matchesAssignment;
  });

  const filteredCriticalAlerts = filteredLogs.filter(a => (a.severity || "").toLowerCase() === "critical");
  const filteredMediumAlerts = filteredLogs.filter(a => ["medium", "warning"].includes((a.severity || "").toLowerCase()));

  const formatAlertId = (id: string) => formatDisplayId(id, "alert", displayIdFormat);
  const formatUserId = (id: string) => formatDisplayId(id, "user", displayIdFormat);
  const formatEntryId = (id: string) => formatDisplayId(id, "entry", displayIdFormat);
  const getStudentName = (userId: string) => formatDisplayId(userId, "user", displayIdFormat);

  const runAlertAction = async (alertId: string, action: "assign" | "review") => {
    const actionKey = `${action}:${alertId}`;
    setActionLoading(prev => ({ ...prev, [actionKey]: true }));
    try {
      let body: Record<string, unknown> = {};
      if (action === "assign") {
        const counselorId = assignmentSelections[alertId];
        if (!counselorId) { showToast("Please select a counselor first.", "error"); return; }
        body = { counselorId };
      } else {
        body = { notes: reviewNotes };
      }

      const res = await fetch(`/api/admin/distress-alerts/${alertId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) { showToast(result.error || "Action failed.", "error"); return; }

      if (action === "assign" && result.conversation) {
        setConversationsByUser(prev => ({ ...prev, [result.conversation.user_id]: result.conversation }));
        if (body.counselorId) {
          setAssignedCounselorByUser(prev => ({ ...prev, [result.conversation.user_id]: body.counselorId as string }));
        }
      }
      if (result.log) {
        setLogs(prev => prev.map(l => l.id === alertId ? { ...l, notes: result.log.notes } : l));
        if (selectedAlert?.id === alertId) setSelectedAlert(prev => prev ? { ...prev, notes: result.log.notes } : prev);
      }
      if (action === "review") setReviewNotes("");
      showToast(result.message || "Alert updated.", "success");
    } catch (err: any) {
      showToast(err.message || "Alert action failed.", "error");
    } finally {
      setActionLoading(prev => { const next = { ...prev }; delete next[actionKey]; return next; });
    }
  };

  const renderAssignmentControls = (alert: DistressLog, compact = false) => {
    const assignedCounselor = getAssignedCounselor(alert);
    const selectedCounselorId = assignmentSelections[alert.id] || assignedCounselorByUser[alert.user_id] || conversationsByUser[alert.user_id]?.counselor_id || "";
    return (
      <div className={compact ? "flex min-w-0 flex-wrap items-center gap-2" : "min-w-0 space-y-2"}>
        <select
          className={`min-w-0 max-w-full border border-gray-200 bg-white text-xs font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/30 ${compact ? "w-36 rounded-lg px-2 py-1.5" : "w-full rounded-xl px-3 py-2"}`}
          value={selectedCounselorId}
          onChange={e => setAssignmentSelections(prev => ({ ...prev, [alert.id]: e.target.value }))}
          disabled={counselors.length === 0}
        >
          <option value="">{counselors.length ? "Choose counselor" : "No counselors"}</option>
          {counselors.map(c => <option key={c.id} value={c.id}>{getProfileName(c)}</option>)}
        </select>
        <button
          type="button"
          className="btn-sm bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
          disabled={!!actionLoading[`assign:${alert.id}`] || counselors.length === 0}
          onClick={() => runAlertAction(alert.id, "assign")}
        >
          {actionLoading[`assign:${alert.id}`] ? "Assigning..." : assignedCounselor ? "Reassign" : "Assign"}
        </button>
        {!compact && (
          <p className="text-xs text-slate-600 font-inter">
            Assigned: <span className="font-semibold text-dark-text">{getProfileName(assignedCounselor)}</span>
          </p>
        )}
      </div>
    );
  };

  const renderEntrySnippets = (userId: string) => {
    const entries = entriesByUser[userId] || [];
    if (entries.length === 0) return <p className="text-sm text-slate-600 font-inter">No journal entries available.</p>;
    return (
      <div className="space-y-3">
        {entries.slice(0, 2).map(entry => (
          <div key={entry.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-900">{formatEntryId(entry.id)}</span>
              <span className="text-xs text-slate-600">{new Date(entry.created_at).toLocaleDateString()}</span>
            </div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{entry.mood || "Mood unknown"}</p>
            <p title={entry.title || entry.content || ""} className="inline-block max-w-[200px] truncate text-sm font-inter leading-relaxed text-slate-800">{entry.title || entry.content || "No text available."}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Toast {...toast} onClose={closeToast} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-dm-serif text-error-red mb-1">Distress Alert Monitoring</h1>
          <p className="text-sm text-slate-600 font-poppins">Assign counselors to students · Anonymized IDs · All actions are logged</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge-error animate-pulse flex items-center">{activeAlertCount} Active Alert{activeAlertCount === 1 ? "" : "s"}</span>
          <button className="btn-secondary flex items-center gap-2" onClick={() => setRefreshToken(v => v + 1)} disabled={loading}>Refresh</button>
        </div>
      </div>

      {/* Alert Banner */}
      <div className="admin-alert-banner bg-white border-l-error-red shadow-sm">
        <p className="text-sm font-poppins text-dark-text">
          Ethical Protocol: Distress flags use anonymized IDs only. Follow institutional protocols before any outreach. All assignments and actions are logged.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="stat-card border-l-4 border-l-error-red">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-error-red/30">!</div>
            <div className="text-right">
              <p className="text-xs text-slate-600 font-poppins">CRITICAL ALERTS</p>
              <p className="text-2xl font-dm-serif text-error-red">{criticalAlerts.length}</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-red-400 to-pink-300" />
        </Card>
        <Card className="stat-card border-l-4 border-l-warning-yellow">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-warning-yellow/30">!</div>
            <div className="text-right">
              <p className="text-xs text-slate-600 font-poppins">MEDIUM ALERTS</p>
              <p className="text-2xl font-dm-serif text-dark-text">{mediumAlerts.length}</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-yellow-400 to-orange-300" />
        </Card>
        <Card className="stat-card border-l-4 border-l-success-green">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-success-green/30">+</div>
            <div className="text-right">
              <p className="text-xs text-slate-600 font-poppins">RESPONSES RECORDED</p>
              <p className="text-2xl font-dm-serif text-dark-text">{respondedLogs.length}</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-green-400 to-emerald-300" />
        </Card>
        <Card className="stat-card border-l-4 border-l-primary-blue">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-primary-blue/20">+</div>
            <div className="text-right">
              <p className="text-xs text-slate-600 font-poppins">RESPONSE RATE</p>
              <p className="text-2xl font-dm-serif text-dark-text">{responseRate}%</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-primary-blue to-teal" />
        </Card>
      </div>

      <ManagementFilterBar
        search={filterSearch}
        onSearchChange={setFilterSearch}
        risk={riskFilter}
        onRiskChange={setRiskFilter}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        assignment={assignmentFilter}
        onAssignmentChange={setAssignmentFilter}
        counselors={counselors.map(c => ({ id: c.id, name: getProfileName(c) }))}
      />

      {/* Critical Alerts */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-error-red" />
          <h2 className="text-xs font-poppins font-semibold text-dark-text uppercase tracking-wider">Critical — Immediate Attention Required</h2>
        </div>
        {loading && <p className="text-sm text-slate-600">Loading alerts...</p>}
        {!loading && filteredCriticalAlerts.length === 0 && <p className="text-sm text-slate-600">No critical alerts match the current filters.</p>}
        {filteredCriticalAlerts.map(alert => (
          <Card key={alert.id} className="p-5 bg-rose-50 border-l-4 border-l-rose-500 border border-rose-200 text-rose-900 rounded-2xl">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-error-red/30 flex items-center justify-center text-2xl">!</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-slate-900">{formatAlertId(alert.id)}</span>
                      <span className="badge-error">Active</span>
                    </div>
                    <p className="text-sm font-poppins font-semibold text-dark-text">{formatTrigger(alert.trigger)}</p>
                  </div>
                </div>
                <div className="flex min-w-0 w-full max-w-[280px] flex-col gap-2">
                  <button type="button" className="btn-sm bg-amber-500 text-white hover:bg-amber-600" onClick={() => setSelectedAlert(alert)}>
                    Review Now
                  </button>
                  {renderAssignmentControls(alert)}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide">Student</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{getStudentName(alert.user_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide">Last alert</p>
                  <p className="mt-1 text-sm text-dark-text">{new Date(alert.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide">Response status</p>
                  <p className="mt-1 text-sm text-dark-text">{getResponseStatus(alert.notes)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide">Distress Risk</p>
                  <div className="mt-1"><RiskBadge userId={alert.user_id} /></div>
                </div>
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide">Counselor</p>
                  <p className="mt-1 text-sm text-dark-text">{getProfileName(getAssignedCounselor(alert))}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Recent journal entries</span>
                  <span className="text-xs text-slate-600">({entriesByUser[alert.user_id]?.length || 0})</span>
                </div>
                {renderEntrySnippets(alert.user_id)}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Medium Alerts */}
      <div className="space-y-4 mt-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-warning-yellow" />
          <h2 className="text-xs font-poppins font-semibold text-dark-text uppercase tracking-wider">Medium — Monitor Closely</h2>
        </div>
        <Card className="overflow-hidden p-6">
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[1200px] table-fixed">
              <thead>
                <tr>
                  <th>ALERT ID</th>
                  <th>USER ID</th>
                  <th>TRIGGER</th>
                  <th>MOOD</th>
                  <th>DISTRESS RISK</th>
                  <th>LAST ENTRY</th>
                  <th>COUNSELOR</th>
                  <th>RESPONSE</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredMediumAlerts.map(alert => (
                  <tr key={alert.id}>
                    <td className="w-32 overflow-hidden p-3">
                      <p className="inline-block max-w-[200px] truncate font-mono text-sm font-semibold text-slate-900">{formatAlertId(alert.id)}</p>
                    </td>
                    <td className="w-32 overflow-hidden p-3">
                      <p className="inline-block max-w-[200px] truncate text-sm font-semibold text-slate-900">{getStudentName(alert.user_id)}</p>
                    </td>
                    <td className="w-48 overflow-hidden p-3">
                      <p className="inline-block max-w-[200px] truncate text-sm font-inter text-dark-text">{formatTrigger(alert.trigger)}</p>
                    </td>
                    <td><p className="text-sm font-poppins text-dark-text">{entriesByUser[alert.user_id]?.[0]?.mood || "—"}</p></td>
                    <td><RiskBadge userId={alert.user_id} /></td>
                    <td>
                      {entriesByUser[alert.user_id]?.[0] ? (
                        <div>
                          <p className="inline-block max-w-[200px] truncate font-mono text-xs font-semibold text-slate-900">{formatEntryId(entriesByUser[alert.user_id][0].id)}</p>
                          <p className="text-xs font-inter text-slate-600">{new Date(entriesByUser[alert.user_id][0].created_at).toLocaleDateString()}</p>
                        </div>
                      ) : <p className="text-sm font-inter text-slate-600">No entry</p>}
                    </td>
                    <td><p className="text-sm font-inter text-dark-text">{getProfileName(getAssignedCounselor(alert))}</p></td>
                    <td><span className={`badge ${alert.notes?.trim() ? "badge-success" : "badge-info"}`}>{getResponseStatus(alert.notes)}</span></td>
                    <td className="max-w-[280px] overflow-hidden p-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <button type="button" className="btn-sm bg-amber-500 text-white hover:bg-amber-600" onClick={() => setSelectedAlert(alert)}>Review</button>
                        {renderAssignmentControls(alert, true)}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredMediumAlerts.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-sm text-slate-600">No alerts match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Review Modal */}
      {selectedAlert && (
        <Portal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedAlert(null)} />
            <div className="relative bg-white rounded-2xl p-6 w-full max-w-3xl shadow-xl z-10 m-4 max-h-[90vh] overflow-y-auto">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-sm font-semibold text-slate-900">{formatAlertId(selectedAlert.id)}</p>
                  <h3 className="mt-1 text-xl font-dm-serif text-dark-text">Distress Alert Details</h3>
                  <p className="text-sm text-slate-600 font-poppins">{formatTrigger(selectedAlert.trigger)}</p>
                </div>
                <button type="button" className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-poppins text-dark-text hover:bg-gray-50" onClick={() => setSelectedAlert(null)}>Close</button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 mb-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Severity</p>
                  <p className="mt-1 text-sm font-poppins text-dark-text">{selectedAlert.severity || "Unknown"}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Student</p>
                  <p className="mt-1 text-sm font-poppins text-dark-text">{formatUserId(selectedAlert.user_id)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Assigned Counselor</p>
                  <p className="mt-1 text-sm font-poppins text-dark-text">{getProfileName(getAssignedCounselor(selectedAlert))}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Distress Risk</p>
                  <div className="mt-1"><RiskBadge userId={selectedAlert.user_id} /></div>
                </div>
              </div>

              {selectedAlert.notes && (
                <div className="mb-4 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">Action Notes</p>
                  <p className="text-sm font-inter text-dark-text whitespace-pre-wrap">{resolveNotesText(selectedAlert.notes)}</p>
                </div>
              )}

              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">Add Review Note</p>
                <textarea
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-inter text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                  rows={3}
                  placeholder="Enter review notes, actions taken, or follow-up plan..."
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                />
                <button
                  type="button"
                  className="mt-2 btn-sm bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
                  disabled={!reviewNotes.trim() || !!actionLoading[`review:${selectedAlert.id}`]}
                  onClick={() => runAlertAction(selectedAlert.id, "review")}
                >
                  {actionLoading[`review:${selectedAlert.id}`] ? "Saving..." : "Save Review Note"}
                </button>
              </div>

              <div className="mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">Assign / Reassign Counselor</p>
                {renderAssignmentControls(selectedAlert)}
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">Recent Journal Entries</p>
                {renderEntrySnippets(selectedAlert.user_id)}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
