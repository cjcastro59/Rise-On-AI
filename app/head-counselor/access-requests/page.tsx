"use client";

import { Card } from "@/components/ui/card";

/**
 * Access Requests page for the Head Counselor.
 *
 * NOTE: No backing table for access requests exists in the database yet.
 * All counts are hard-coded to 0 and the history table is intentionally empty.
 * When a table is added, wire up the queries here.
 */
export default function HeadCounselorAccessRequestsPage() {
  const pendingCount = 0;
  const activeCount = 0;
  const history: Array<{
    requested: string;
    counselor: string;
    user: string;
    severity: string;
    status: string;
    decidedBy: string;
  }> = [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-1">Access Requests</h1>
          <p className="text-sm text-slate-600 font-poppins">
            Review counselor access requests to user data
          </p>
        </div>
      </div>

      {/* Small cards — Pending (yellow) and Active (green) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pending card */}
        <Card
          variant="white"
          className={`p-5 border-l-4 ${pendingCount > 0 ? "border-l-amber-400 bg-amber-50/60" : "border-l-amber-300 bg-amber-50/30"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-amber-200">
                ⏳
              </div>
              <div>
                <p className="text-xs font-poppins text-slate-600 uppercase tracking-wider">
                  Pending
                </p>
                <p className="text-2xl font-dm-serif text-amber-700">
                  {pendingCount}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs font-inter text-slate-600">
            {pendingCount > 0
              ? "Requests awaiting your decision."
              : "No pending access requests."}
          </p>
        </Card>

        {/* Active card */}
        <Card
          variant="white"
          className={`p-5 border-l-4 ${activeCount > 0 ? "border-l-emerald-500 bg-emerald-50/60" : "border-l-emerald-300 bg-emerald-50/30"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-emerald-200">
                ✅
              </div>
              <div>
                <p className="text-xs font-poppins text-slate-600 uppercase tracking-wider">
                  Active
                </p>
                <p className="text-2xl font-dm-serif text-emerald-700">
                  {activeCount}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs font-inter text-slate-600">
            {activeCount > 0
              ? "Currently approved and active access grants."
              : "No active access requests."}
          </p>
        </Card>
      </div>

      {/* History table */}
      <Card className="overflow-hidden p-6">
        <div className="mb-4">
          <h2 className="text-xs font-poppins font-semibold text-dark-text uppercase tracking-wider">
            History
          </h2>
          <p className="text-xs text-slate-600 font-inter mt-0.5">
            Past access request decisions
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="admin-table min-w-[900px] table-fixed">
            <thead>
              <tr>
                <th>REQUESTED</th>
                <th>COUNSELOR</th>
                <th>USER</th>
                <th>SEVERITY</th>
                <th>STATUS</th>
                <th>DECIDED BY</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-600">
                    No access request history yet.
                  </td>
                </tr>
              ) : (
                history.map((row, idx) => (
                  <tr key={idx}>
                    <td className="py-4 px-3 text-sm font-inter text-slate-600">
                      {row.requested}
                    </td>
                    <td className="py-4 px-3 text-sm font-poppins text-dark-text">
                      {row.counselor}
                    </td>
                    <td className="py-4 px-3 text-sm font-poppins text-dark-text">
                      {row.user}
                    </td>
                    <td className="py-4 px-3 text-sm font-poppins text-dark-text">
                      {row.severity}
                    </td>
                    <td className="py-4 px-3">
                      <span className="badge badge-info">{row.status}</span>
                    </td>
                    <td className="py-4 px-3 text-sm font-inter text-slate-600">
                      {row.decidedBy}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
