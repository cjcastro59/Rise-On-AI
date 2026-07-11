"use client";

import { Card } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type UserProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
};

type JournalEntry = {
  id: string;
  user_id: string;
  title: string | null;
  content: string | null;
  mood: string | null;
  created_at: string;
  user_profiles?: UserProfile | null;
};

type DistressLog = {
  id: string;
  user_id: string;
  severity: string | null;
  trigger: string | null;
  notes: string | null;
  created_at: string;
  user_profiles?: UserProfile | null;
};

const getUserDisplayName = (user?: UserProfile | null) => {
  if (!user) return "Unknown user";
  return user.full_name || user.username || user.id.slice(0, 8);
};

const getResponseStatus = (notes?: string | null) => {
  if (!notes || !notes.trim()) return "Pending";
  if (notes.toLowerCase().includes("resolved") || notes.toLowerCase().includes("acknowledged")) {
    return "Acknowledged";
  }
  return "Responded";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        let profilesById: Record<string, UserProfile> = {};

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

          const { data: profilesData, error: profilesError } = await supabase
            .from("user_profiles")
            .select("id,username,full_name")
            .in("id", logUserIds);

          if (profilesError) {
            console.error("Error loading alert user profiles:", profilesError);
          } else {
            profilesById = ((profilesData || []) as UserProfile[]).reduce<Record<string, UserProfile>>((acc, profile) => {
              acc[profile.id] = profile;
              return acc;
            }, {});
          }
        }

        const fetchedLogs = rawLogs.map((log) => ({
          ...log,
          user_profiles: profilesById[log.user_id] || null,
        }));
        const entriesWithProfiles = entries.map((entry) => ({
          ...entry,
          user_profiles: profilesById[entry.user_id] || null,
        }));
        const sortedLogs = fetchedLogs.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        if (mounted) {
          setLogs(sortedLogs);
          setEntriesByUser(groupEntriesByUser(entriesWithProfiles));
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
                      <span className="font-mono text-sm font-semibold text-primary-blue">{alert.id.slice(0, 8)}</span>
                      <span className="badge-error">Active</span>
                    </div>
                    <p className="text-sm font-poppins font-semibold text-dark-text">{alert.trigger || "Detected distress trigger"}</p>
                    <p className="text-xs text-dark-text/60 font-inter">User: {getUserDisplayName(alert.user_profiles)}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button className="btn-sm bg-error-red text-white">Review Now</button>
                  <button className="btn-sm border border-primary-blue text-primary-blue">Assign Counselor</button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-dark-text/60 uppercase tracking-wide">Last alert</p>
                  <p className="mt-1 text-sm text-dark-text">{new Date(alert.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-text/60 uppercase tracking-wide">Response status</p>
                  <p className="mt-1 text-sm text-dark-text">{getResponseStatus(alert.notes)}</p>
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
                  <th>USER</th>
                  <th>TRIGGER</th>
                  <th>MOOD SCORE</th>
                  <th>LAST ENTRY</th>
                  <th>RESPONSE</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {mediumAlerts.map((alert) => (
                  <tr key={alert.id}>
                    <td>
                      <p className="font-mono text-sm font-semibold text-primary-blue">{getUserDisplayName(alert.user_profiles)}</p>
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
                      <span className="badge-info">{getResponseStatus(alert.notes)}</span>
                    </td>
                    <td>
                      <span className="badge-info">{alert.notes ? "Followed up" : "Pending"}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button className="btn-sm border border-warning-yellow text-[#FFB700]">Assign</button>
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
    </div>
  );
}
