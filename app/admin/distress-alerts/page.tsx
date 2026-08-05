"use client";

import { Card } from "@/components/ui/card";
import { Portal } from "@/components/ui/Portal";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

const getAnonymizedAlertId = (id: string) => {
  return `RAI-${id.slice(0, 8).toUpperCase()}`;
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

export default function AdminDistressAlertsPage() {
  const [logs, setLogs] = useState<DistressLog[]>([]);
  const [entriesByUser, setEntriesByUser] = useState<Record<string, JournalEntry[]>>({});
  const [counselors, setCounselors] = useState<UserProfile[]>([]);
  const [conversationsByUser, setConversationsByUser] = useState<Record<string, Conversation>>({});
  const [assignmentSelections, setAssignmentSelections] = useState<Record<string, string>>({});
  const [selectedAlert, setSelectedAlert] = useState<DistressLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const { user: currentUser } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!currentUser) return;

    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("distress_logs")
          .select("id,user_id,severity,trigger,notes,created_at")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;

        const rawLogs = (data || []) as DistressLog[];
        const logUserIds = Array.from(new Set(rawLogs.map((log) => log.user_id).filter(Boolean))) as string[];
        let entries: JournalEntry[] = [];
        let conversations: Conversation[] = [];
        let counselorProfiles: UserProfile[] = [];

        const { data: counselorsData, error: counselorsError } = await supabase
          .from("user_profiles")
          .select("id,username,full_name")
          .eq("role", "counselor")
          .eq("is_active", true)
          .order("full_name", { ascending: true });

        if (counselorsError) {
          console.error("Error loading counselors:", counselorsError);
        } else {
          counselorProfiles = (counselorsData || []) as UserProfile[];
        }

        if (logUserIds.length > 0) {
          const { data: entriesData, error: entriesError } = await supabase
            .from("journal_entries")
            .select("id,user_id,title,content,mood,created_at")
            .in("user_id", logUserIds)
            .order("created_at", { ascending: false })
            .limit(200);

          if (entriesError) {
            console.error("Error loading alert journal entries:", entriesError);
          } else {
            entries = (entriesData || []) as JournalEntry[];
          }

          const { data: conversationsData, error: conversationsError } = await supabase
            .from("conversations")
            .select("id,user_id,counselor_id,status,created_at,updated_at")
            .in("user_id", logUserIds)
            .eq("status", "open")
            .order("updated_at", { ascending: false });

          if (conversationsError) {
            console.error("Error loading alert conversations:", conversationsError);
          } else {
            conversations = (conversationsData || []) as Conversation[];
          }
        }

        const sortedLogs = rawLogs.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        if (mounted) {
          const conversationsByUserId = conversations.reduce<Record<string, Conversation>>((acc, conversation) => {
            if (!acc[conversation.user_id]) acc[conversation.user_id] = conversation;
            return acc;
          }, {});

          setLogs(sortedLogs);
          setEntriesByUser(groupEntriesByUser(entries));
          setCounselors(counselorProfiles);
          setConversationsByUser(conversationsByUserId);
          setAssignmentSelections((prev) => {
            const next = { ...prev };
            sortedLogs.forEach((log) => {
              const assignedCounselorId = conversationsByUserId[log.user_id]?.counselor_id;
              if (assignedCounselorId && !next[log.id]) {
                next[log.id] = assignedCounselorId;
              }
            });
            return next;
          });
        }
      } catch (err: any) {
        setError(err.message || "Failed to load distress logs");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [currentUser, supabase]);

  const criticalAlerts = logs.filter((l) => (l.severity || "").toLowerCase() === "critical");
  const mediumAlerts = logs.filter((l) => ["medium", "warning"].includes((l.severity || "").toLowerCase()));
  const respondedLogs = logs.filter((l) => !!(l.notes && l.notes.trim()));
  const responseRate = logs.length ? Math.round((respondedLogs.length / logs.length) * 100) : 0;

  const getAssignedCounselor = (alert: DistressLog) => {
    const counselorId = conversationsByUser[alert.user_id]?.counselor_id;
    return counselors.find((counselor) => counselor.id === counselorId) || null;
  };

  const renderEntrySnippets = (userId: string) => {
    const entries = entriesByUser[userId] || [];
    if (entries.length === 0) {
      return <p className="text-sm text-dark-text/60 font-inter">No journal entries available for this user yet.</p>;
    }

    return (
      <div className="space-y-3">
        {entries.slice(0, 2).map((entry) => (
          <div key={entry.id} className="rounded-2xl bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-dark-text/60">{entry.mood || "Mood unknown"}</span>
              <span className="text-xs text-dark-text/60">{new Date(entry.created_at).toLocaleDateString()}</span>
            </div>
            <p className="text-sm font-inter text-dark-text/90 line-clamp-2">{entry.title || entry.content || "No text available."}</p>
          </div>
        ))}
      </div>
    );
  };

  const runAlertAction = async (alertId: string, action: "review" | "assign") => {
    const actionKey = `${action}:${alertId}`;
    const selectedCounselorId = assignmentSelections[alertId];

    if (action === "assign" && !selectedCounselorId) {
      setError("Please choose a counselor before assigning this alert.");
      setActionMessage(null);
      return;
    }

    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));
    setError(null);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/admin/distress-alerts/${alertId}/${action}`, {
        method: "POST",
        headers: action === "assign" ? { "Content-Type": "application/json" } : undefined,
        body: action === "assign" ? JSON.stringify({ counselorId: selectedCounselorId }) : undefined,
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${action} alert`);
      }

      if (result.log) {
        setLogs((prev) =>
          prev.map((log) =>
            log.id === alertId
                ? {
                  ...log,
                  notes: result.log.notes,
                }
              : log
          )
        );
        setSelectedAlert((prev) => (prev?.id === alertId ? { ...prev, notes: result.log.notes } : prev));
      }

      if (result.conversation) {
        setConversationsByUser((prev) => ({
          ...prev,
          [result.conversation.user_id]: result.conversation,
        }));
      }

      setActionMessage(result.message || "Alert updated.");
    } catch (err: any) {
      setError(err.message || "Alert action failed.");
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[actionKey];
        return next;
      });
    }
  };

  const renderAssignmentControls = (alert: DistressLog, compact = false) => {
    const assignedCounselor = getAssignedCounselor(alert);
    const selectedCounselorId = assignmentSelections[alert.id] || conversationsByUser[alert.user_id]?.counselor_id || "";

    return (
      <div className={compact ? "flex items-center gap-2" : "space-y-2"}>
        <select
          className={`border border-gray-200 bg-white text-xs font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/30 ${
            compact ? "w-40 rounded-lg px-2 py-1.5" : "w-full rounded-xl px-3 py-2"
          }`}
          value={selectedCounselorId}
          onChange={(event) =>
            setAssignmentSelections((prev) => ({
              ...prev,
              [alert.id]: event.target.value,
            }))
          }
          disabled={counselors.length === 0}
        >
          <option value="">{counselors.length ? "Choose counselor" : "No counselors"}</option>
          {counselors.map((counselor) => (
            <option key={counselor.id} value={counselor.id}>
              {getProfileName(counselor)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-sm border border-primary-blue text-primary-blue disabled:opacity-60"
          disabled={!!actionLoading[`assign:${alert.id}`] || counselors.length === 0}
          onClick={() => runAlertAction(alert.id, "assign")}
        >
          {actionLoading[`assign:${alert.id}`] ? "Assigning..." : assignedCounselor ? "Reassign" : "Assign"}
        </button>
        {!compact && (
          <p className="text-xs text-dark-text/60 font-inter">
            Assigned: <span className="font-semibold text-dark-text">{getProfileName(assignedCounselor)}</span>
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-dm-serif text-error-red mb-1">Distress Alert Monitoring</h1>
          <p className="text-sm text-dark-text/60 font-poppins">Real-time emotional crisis detection • Anonymized IDs • Requires immediate review</p>
        </div>
        <div className="flex gap-3">
          <span className="badge-error animate-pulse">⚡ {criticalAlerts.length} Active Alerts</span>
          <button className="btn-secondary flex items-center gap-2" onClick={() => window.location.reload()}>
            <span>📄</span> Refresh
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      <div className="admin-alert-banner bg-error-red/10 border-l-error-red">
        <span>🛡️</span>
        <p className="text-sm font-poppins text-dark-text">
          Ethical Protocol: Distress flags use anonymized IDs only. Guidance counselors must follow institutional protocols before any outreach. All actions are logged.
        </p>
      </div>

      {actionMessage && (
        <div className="rounded-xl border border-success-green/30 bg-success-green/10 px-4 py-3 text-sm font-poppins text-dark-text">
          {actionMessage}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="stat-card border-l-4 border-l-error-red">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-error-red/30">🔴</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">CRITICAL ALERTS</p>
              <p className="text-2xl font-dm-serif text-error-red">{criticalAlerts.length}</p>
              <p className="text-xs text-error-red font-poppins">Needs immediate review</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-red-400 to-pink-300" />
        </Card>
        <Card className="stat-card border-l-4 border-l-warning-yellow">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-warning-yellow/30">🟠</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">MEDIUM ALERTS</p>
              <p className="text-2xl font-dm-serif text-dark-text">{mediumAlerts.length}</p>
              <p className="text-xs text-dark-text/60 font-poppins">Monitor closely</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-yellow-400 to-orange-300" />
        </Card>
        <Card className="stat-card border-l-4 border-l-success-green">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-success-green/30">🟢</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">RESPONSES RECORDED</p>
              <p className="text-2xl font-dm-serif text-dark-text">{respondedLogs.length}</p>
              <p className="text-xs text-success-green font-poppins">Follow-up actions logged</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-green-400 to-emerald-300" />
        </Card>
        <Card className="stat-card border-l-4 border-l-primary-blue">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-primary-blue/20">✅</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">RESPONSE RATE</p>
              <p className="text-2xl font-dm-serif text-dark-text">{responseRate}%</p>
              <p className="text-xs text-dark-text/60 font-poppins">Alerts with a logged response</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-primary-blue to-teal" />
        </Card>
      </div>

      {/* Critical Alerts */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-error-red" />
          <h2 className="text-xs font-poppins font-semibold text-dark-text uppercase tracking-wider">Critical — Immediate Attention Required</h2>
        </div>
        {loading && <p className="text-sm text-dark-text/60">Loading alerts…</p>}
        {!loading && error && <p className="text-sm text-error-red">{error}</p>}
        {!loading && criticalAlerts.length === 0 && !error && <p className="text-sm text-dark-text/60">No critical alerts at the moment.</p>}
        {criticalAlerts.map((alert) => (
          <Card key={alert.id} className="p-5 bg-error-red/5 border border-error-red/20 rounded-2xl">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-error-red/30 flex items-center justify-center text-2xl">🩸</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-primary-blue">{getAnonymizedAlertId(alert.id)}</span>
                      <span className="badge-error">Active</span>
                    </div>
                    <p className="text-sm font-poppins font-semibold text-dark-text">{alert.trigger || "Detected distress trigger"}</p>
                  </div>
                </div>
                <div className="flex min-w-[230px] flex-col gap-2">
                  <button
                    type="button"
                    className="btn-sm bg-error-red text-white disabled:opacity-60"
                    onClick={() => setSelectedAlert(alert)}
                  >
                    Review Now
                  </button>
                  {renderAssignmentControls(alert)}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <p className="text-xs text-dark-text/60 uppercase tracking-wide">Last alert</p>
                  <p className="mt-1 text-sm text-dark-text">{new Date(alert.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-text/60 uppercase tracking-wide">Response status</p>
                  <p className="mt-1 text-sm text-dark-text">{getResponseStatus(alert.notes)}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-text/60 uppercase tracking-wide">Counselor</p>
                  <p className="mt-1 text-sm text-dark-text">{getProfileName(getAssignedCounselor(alert))}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-text/60 uppercase tracking-wide">Latest entry</p>
                  <p className="mt-1 text-sm text-dark-text">
                    {entriesByUser[alert.user_id]?.[0]?.title || entriesByUser[alert.user_id]?.[0]?.content?.slice(0, 80) || "No entry found"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-dark-text/60">Recent journal entries</span>
                  <span className="text-xs text-dark-text/60">({entriesByUser[alert.user_id]?.length || 0})</span>
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
        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th>ALERT ID</th>
                  <th>TRIGGER</th>
                  <th>MOOD SCORE</th>
                  <th>LAST ENTRY</th>
                  <th>COUNSELOR</th>
                  <th>RESPONSE</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {mediumAlerts.map((alert) => (
                  <tr key={alert.id}>
                    <td>
                      <p className="font-mono text-sm font-semibold text-primary-blue">{getAnonymizedAlertId(alert.id)}</p>
                    </td>
                    <td>
                      <p className="text-sm font-inter text-dark-text">{alert.trigger || "Pending review"}</p>
                    </td>
                    <td>
                      <p className="text-sm font-poppins text-dark-text">{entriesByUser[alert.user_id]?.[0]?.mood || "—"}</p>
                    </td>
                    <td>
                      <p className="text-sm font-inter text-dark-text/60">
                        {entriesByUser[alert.user_id]?.[0]
                          ? new Date(entriesByUser[alert.user_id]?.[0].created_at).toLocaleDateString()
                          : "No entry"}
                      </p>
                    </td>
                    <td>
                      <p className="text-sm font-inter text-dark-text">{getProfileName(getAssignedCounselor(alert))}</p>
                    </td>
                    <td>
                      <span className="badge-info">{getResponseStatus(alert.notes)}</span>
                    </td>
                    <td>
                      <span className="badge-info">{alert.notes ? "Followed up" : "Pending"}</span>
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="btn-sm border border-warning-yellow text-[#FFB700] disabled:opacity-60"
                          onClick={() => setSelectedAlert(alert)}
                        >
                          Review
                        </button>
                        {renderAssignmentControls(alert, true)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-error-red/20 rounded-lg flex items-center justify-center">📉</div>
          <p className="text-xs font-poppins text-dark-text/60">DISTRESS ALERT TREND — LAST 30 DAYS</p>
        </div>
        <div className="relative h-40">
          <div className="absolute inset-0 bg-gradient-to-t from-error-red/20 to-transparent rounded-lg"></div>
          <svg className="absolute bottom-0 left-0 right-0 h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
            <path
              d="M0 20 Q10 18 20 19 T40 18 T60 15 T80 16 T100 14"
              fill="none"
              stroke="#F4A6A6"
              strokeWidth="1.5"
            />
          </svg>
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-4 pb-2">
            <span className="text-xs text-dark-text/60 font-poppins">Apr 28</span>
            <span className="text-xs text-dark-text/60 font-poppins">May 5</span>
            <span className="text-xs text-dark-text/60 font-poppins">May 12</span>
            <span className="text-xs text-dark-text/60 font-poppins">May 19</span>
            <span className="text-xs text-dark-text/60 font-poppins">May 28</span>
          </div>
        </div>
      </Card>

      {selectedAlert && (
        <Portal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setSelectedAlert(null)}
            ></div>
            <div className="relative bg-white rounded-2xl p-6 w-full max-w-3xl shadow-xl z-10 m-4 max-h-[90vh] overflow-y-auto">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-sm font-semibold text-primary-blue">{getAnonymizedAlertId(selectedAlert.id)}</p>
                  <h3 className="mt-1 text-xl font-dm-serif text-dark-text">Distress Alert Details</h3>
                  <p className="text-sm text-dark-text/60 font-poppins">{selectedAlert.trigger || "Detected distress trigger"}</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-poppins text-dark-text hover:bg-gray-50"
                  onClick={() => setSelectedAlert(null)}
                >
                  Close
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-dark-text/60">Severity</p>
                  <p className="mt-1 text-sm font-poppins text-dark-text">{selectedAlert.severity || "Unknown"}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-dark-text/60">Created</p>
                  <p className="mt-1 text-sm font-poppins text-dark-text">{new Date(selectedAlert.created_at).toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-dark-text/60">Response</p>
                  <p className="mt-1 text-sm font-poppins text-dark-text">{getResponseStatus(selectedAlert.notes)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-dark-text/60">Counselor</p>
                  <p className="mt-1 text-sm font-poppins text-dark-text">{getProfileName(getAssignedCounselor(selectedAlert))}</p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-gray-100 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-dark-text/60">Assign counselor</p>
                {renderAssignmentControls(selectedAlert)}
              </div>

              <div className="mt-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-dark-text/60">Action notes</p>
                <div className="min-h-[80px] whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm font-inter text-dark-text/80">
                  {selectedAlert.notes || "No action notes recorded yet."}
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-dark-text/60">Recent journal entries</p>
                <div className="space-y-3">
                  {(entriesByUser[selectedAlert.user_id] || []).slice(0, 5).map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-gray-100 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-dark-text/60">{entry.mood || "Mood unknown"}</span>
                        <span className="text-xs text-dark-text/60">{new Date(entry.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm font-semibold text-dark-text">{entry.title || "Untitled entry"}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm font-inter text-dark-text/80">{entry.content || "No text available."}</p>
                    </div>
                  ))}
                  {(entriesByUser[selectedAlert.user_id] || []).length === 0 && (
                    <p className="text-sm text-dark-text/60 font-inter">No journal entries available for this user yet.</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  className="btn-sm bg-error-red text-white disabled:opacity-60"
                  disabled={!!actionLoading[`review:${selectedAlert.id}`]}
                  onClick={() => runAlertAction(selectedAlert.id, "review")}
                >
                  {actionLoading[`review:${selectedAlert.id}`] ? "Saving..." : "Done reviewed"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
