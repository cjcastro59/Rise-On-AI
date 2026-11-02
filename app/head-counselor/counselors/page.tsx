"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Portal } from "@/components/ui/Portal";
import { createClient } from "@/lib/supabase/client";
import { formatDisplayId, loadDisplayIdFormat, type DisplayIdFormat } from "@/lib/display-ids";

interface CounselorRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  username: string | null;
  is_active: boolean;
}

interface DistressLog {
  id: string;
  user_id: string;
  severity: string | null;
  trigger: string | null;
  notes: string | null;
  created_at: string;
}

interface AssignedUser {
  id: string;
}

interface CounselorStats {
  assignedUsers: number;
  openCritical: number;
  openMedium: number;
  unacknowledged: number;
}

export default function HeadCounselorCounselorsPage() {
  const [counselors, setCounselors] = useState<CounselorRow[]>([]);
  const [statsByCounselor, setStatsByCounselor] = useState<Record<string, CounselorStats>>({});
  const [assignedUsersByCounselor, setAssignedUsersByCounselor] = useState<Record<string, AssignedUser[]>>({});
  const [casesByCounselor, setCasesByCounselor] = useState<Record<string, DistressLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCounselor, setSelectedCounselor] = useState<CounselorRow | null>(null);
  const [displayIdFormat, setDisplayIdFormat] = useState<DisplayIdFormat>("anonymized");
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    loadDisplayIdFormat(supabase).then(setDisplayIdFormat);
  }, [supabase]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all counselors (active and inactive, so the table always resolves names)
        const { data: counselorRows, error: counselorError } = await supabase
          .from("user_profiles")
          .select("id, first_name, last_name, full_name, username, is_active")
          .eq("role", "counselor")
          .order("created_at", { ascending: false });

        if (counselorError) throw counselorError;

        const counselorList = (counselorRows || []) as CounselorRow[];
        setCounselors(counselorList);

        // Fetch all users with role="user" (to group by assigned_counselor_id)
        const { data: userRows, error: userError } = await supabase
          .from("user_profiles")
          .select("id, assigned_counselor_id")
          .eq("role", "user");

        if (userError) throw userError;

        // Group users by their assigned counselor
        const usersByCounselor: Record<string, AssignedUser[]> = {};
        const allAssignedUserIds: string[] = [];
        for (const row of (userRows || []) as { id: string; assigned_counselor_id: string | null }[]) {
          if (row.assigned_counselor_id) {
            if (!usersByCounselor[row.assigned_counselor_id]) {
              usersByCounselor[row.assigned_counselor_id] = [];
            }
            usersByCounselor[row.assigned_counselor_id].push({ id: row.id });
            allAssignedUserIds.push(row.id);
          }
        }
        setAssignedUsersByCounselor(usersByCounselor);

        // Fetch all distress logs (limited to recent for performance)
        const { data: logRows, error: logError } = await supabase
          .from("distress_logs")
          .select("id, user_id, severity, trigger, notes, created_at")
          .order("created_at", { ascending: false })
          .limit(1000);

        if (logError) throw logError;

        const allLogs = (logRows || []) as DistressLog[];

        // Build a set of assigned user IDs for quick lookup
        const assignedUserIdSet = new Set(allAssignedUserIds);

        // Group distress logs by user_id (only for users assigned to a counselor)
        const logsByUserId: Record<string, DistressLog[]> = {};
        for (const log of allLogs) {
          if (!assignedUserIdSet.has(log.user_id)) continue;
          if (!logsByUserId[log.user_id]) logsByUserId[log.user_id] = [];
          logsByUserId[log.user_id].push(log);
        }

        // Compute stats per counselor
        const statsMap: Record<string, CounselorStats> = {};
        const casesMap: Record<string, DistressLog[]> = {};
        for (const counselor of counselorList) {
          const assigned = usersByCounselor[counselor.id] || [];
          let openCritical = 0;
          let openMedium = 0;
          let unacknowledged = 0;
          const counselorCases: DistressLog[] = [];

          for (const user of assigned) {
            const userLogs = logsByUserId[user.id] || [];
            for (const log of userLogs) {
              counselorCases.push(log);
              const severity = (log.severity || "").toLowerCase();
              if (severity === "critical") openCritical++;
              if (["medium", "warning"].includes(severity)) openMedium++;
              if (!log.notes || !log.notes.trim()) unacknowledged++;
            }
          }

          statsMap[counselor.id] = {
            assignedUsers: assigned.length,
            openCritical,
            openMedium,
            unacknowledged,
          };
          // Sort cases by created_at descending
          counselorCases.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          casesMap[counselor.id] = counselorCases;
        }
        setStatsByCounselor(statsMap);
        setCasesByCounselor(casesMap);
      } catch (err) {
        console.error("Error loading counselors data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  const getCounselorDisplayName = (counselor: CounselorRow) => {
    if (counselor.first_name && counselor.last_name) {
      return `${counselor.first_name} ${counselor.last_name}`;
    }
    if (counselor.full_name) return counselor.full_name;
    if (counselor.username) return counselor.username;
    return formatDisplayId(counselor.id, "user", displayIdFormat);
  };

  const formatTrigger = (trigger: string | null): string => {
    if (!trigger) return "Detected distress trigger";
    return trigger.replace(
      /Journal entry [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:/gi,
      "Entry:"
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue mx-auto mb-4"></div>
          <p className="text-slate-600 font-poppins">Loading counselors…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-1">Counselors</h1>
          <p className="text-sm text-slate-600 font-poppins">
            Overview of all counselors and their assigned users
          </p>
        </div>
      </div>

      {/* Counselors table — read-only */}
      <Card className="overflow-hidden p-6">
        <div className="overflow-x-auto">
          <table className="admin-table min-w-[1000px] table-fixed">
            <thead>
              <tr>
                <th>COUNSELOR</th>
                <th>ASSIGNED USERS</th>
                <th>OPEN CRITICAL</th>
                <th>OPEN MEDIUM</th>
                <th>UNACKNOWLEDGED</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {counselors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-600">
                    No counselors found.
                  </td>
                </tr>
              ) : (
                counselors.map((counselor) => {
                  const stats = statsByCounselor[counselor.id] || {
                    assignedUsers: 0,
                    openCritical: 0,
                    openMedium: 0,
                    unacknowledged: 0,
                  };
                  return (
                    <tr key={counselor.id}>
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-poppins font-semibold text-slate-900">
                            {getCounselorDisplayName(counselor)}
                          </span>
                          {!counselor.is_active && (
                            <span className="px-2 py-0.5 rounded-full border border-slate-300 bg-slate-100 text-xs font-semibold text-slate-600">
                              Inactive
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <span className="text-sm font-poppins text-dark-text">
                          {stats.assignedUsers}
                        </span>
                      </td>
                      <td className="py-4 px-3">
                        <span className={`text-sm font-poppins font-semibold ${stats.openCritical > 0 ? "text-error-red" : "text-slate-500"}`}>
                          {stats.openCritical}
                        </span>
                      </td>
                      <td className="py-4 px-3">
                        <span className={`text-sm font-poppins font-semibold ${stats.openMedium > 0 ? "text-amber-600" : "text-slate-500"}`}>
                          {stats.openMedium}
                        </span>
                      </td>
                      <td className="py-4 px-3">
                        <span className={`text-sm font-poppins font-semibold ${stats.unacknowledged > 0 ? "text-error-red" : "text-slate-500"}`}>
                          {stats.unacknowledged}
                        </span>
                      </td>
                      <td className="py-4 px-3">
                        <button
                          onClick={() => setSelectedCounselor(counselor)}
                          className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-slate-800"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* View Counselor Modal */}
      {selectedCounselor && (
        <Portal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setSelectedCounselor(null)}
            ></div>
            <div className="relative bg-white rounded-2xl p-6 w-full max-w-3xl shadow-xl z-10 m-4 max-h-[90vh] overflow-y-auto">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-dm-serif text-dark-text">
                    {getCounselorDisplayName(selectedCounselor)}
                  </h3>
                  <p className="text-sm text-slate-600 font-poppins mt-0.5">
                    Assigned users and open cases
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-poppins text-dark-text hover:bg-gray-50"
                  onClick={() => setSelectedCounselor(null)}
                >
                  Close
                </button>
              </div>

              {/* Assigned user codes */}
              <div className="mb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Assigned Users ({assignedUsersByCounselor[selectedCounselor.id]?.length || 0})
                </p>
                {(assignedUsersByCounselor[selectedCounselor.id] || []).length === 0 ? (
                  <p className="text-sm text-slate-600 font-inter">
                    No users assigned to this counselor.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(assignedUsersByCounselor[selectedCounselor.id] || []).map((user) => (
                      <span
                        key={user.id}
                        className="inline-block rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-poppins text-slate-700"
                      >
                        {formatDisplayId(user.id, "user", displayIdFormat)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Open cases */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Open Cases ({casesByCounselor[selectedCounselor.id]?.length || 0})
                </p>
                {(casesByCounselor[selectedCounselor.id] || []).length === 0 ? (
                  <p className="text-sm text-slate-600 font-inter">
                    No open cases for this counselor.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {(casesByCounselor[selectedCounselor.id] || []).map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"
                      >
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            {log.severity || "Unknown"}
                          </span>
                          <span className="text-xs text-slate-600">
                            {new Date(log.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-poppins text-dark-text">
                          {formatTrigger(log.trigger)}
                        </p>
                        <p className="mt-0.5 text-xs font-inter text-slate-600">
                          User: {formatDisplayId(log.user_id, "user", displayIdFormat)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
