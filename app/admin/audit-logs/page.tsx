"use client";

import { Card } from "@/components/ui/card";
import { useState } from "react";

const mockAuditLogs = [
  {
    id: "L-01234",
    timestamp: "May 28, 10:30 AM",
    admin: "admin@rise-on.edu",
    role: "Super Admin",
    action: "Export Data",
    details: "Mood Report — May 2026",
    ip: "192.168.1.100",
    status: "Success",
  },
  {
    id: "L-01233",
    timestamp: "May 28, 10:15 AM",
    admin: "guidance@cpu.edu",
    role: "Guidance Counselor",
    action: "Alert Review",
    details: "RAI-0021 — Critical flag reviewed",
    ip: "10.0.0.51",
    status: "Success",
  },
  {
    id: "L-01232",
    timestamp: "May 28, 09:00 AM",
    admin: "research@up.edu",
    role: "Researcher",
    action: "Settings Change",
    details: "Attempted to access user data (blocked)",
    ip: "203.177.22.9",
    status: "Blocked",
  },
  {
    id: "L-01231",
    timestamp: "May 28, 08:45 AM",
    admin: "admin@rise-on.edu",
    role: "Super Admin",
    action: "Report View",
    details: "Mood Analytics — April 2026",
    ip: "192.168.1.100",
    status: "Success",
  },
  {
    id: "L-01230",
    timestamp: "May 28, 08:00 AM",
    admin: "sys.admin",
    role: "Automated",
    action: "Database Backup",
    details: "Full backup completed",
    ip: "Internal",
    status: "Success",
  },
];

export default function AdminAuditLogsPage() {
  const [filter, setFilter] = useState("All");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-1">Audit Logs / Activity Monitor</h1>
          <p className="text-sm text-dark-text/60 font-poppins">Complete record of every admin action, timestamped, and immutable; ensures full accountability</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary flex items-center gap-2">
            <span>📄</span> Export Log
          </button>
          <button className="btn-primary">Filter</button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="stat-card border-l-4 border-l-primary-blue">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-primary-blue/20">📋</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">TOTAL LOG ENTRIES</p>
              <p className="text-2xl font-dm-serif text-dark-text">4,812</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-primary-blue to-lavender"></div>
        </Card>
        <Card className="stat-card border-l-4 border-l-lavender">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-lavender/20">👤</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">ACTIVE ADMIN SESSIONS</p>
              <p className="text-2xl font-dm-serif text-dark-text">7</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-purple-400 to-pink-300"></div>
        </Card>
        <Card className="stat-card border-l-4 border-l-warning-yellow">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-warning-yellow/30">⚠️</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">SUSPICIOUS ACTIONS</p>
              <p className="text-2xl font-dm-serif text-dark-text">3</p>
              <p className="text-xs text-warning-yellow font-poppins">Flagged this week</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-yellow-400 to-orange-300"></div>
        </Card>
        <Card className="stat-card border-l-4 border-l-success-green">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-success-green/30">🔒</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">ENCRYPTED STORAGE</p>
              <p className="text-2xl font-dm-serif text-dark-text">100%</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-green-400 to-emerald-300"></div>
        </Card>
      </div>

      {/* Log Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-text/60">🔍</span>
                <input
                  type="text"
                  placeholder="Search by action, admin, or IP address..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-sm font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/50"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter("All")}
                className={`px-3 py-1 rounded-full text-xs font-semibold font-poppins transition-all ${filter === "All" ? "bg-primary-blue/30 text-dark-text" : "text-dark-text/60 hover:bg-gray-50"}`}
              >
                All Actions
              </button>
              <button
                onClick={() => setFilter("Logins")}
                className={`px-3 py-1 rounded-full text-xs font-semibold font-poppins transition-all ${filter === "Logins" ? "bg-primary-blue/30 text-dark-text" : "text-dark-text/60 hover:bg-gray-50"}`}
              >
                Logins
              </button>
              <button
                onClick={() => setFilter("Exports")}
                className={`px-3 py-1 rounded-full text-xs font-semibold font-poppins transition-all ${filter === "Exports" ? "bg-primary-blue/30 text-dark-text" : "text-dark-text/60 hover:bg-gray-50"}`}
              >
                Exports
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>TIMESTAMP</th>
                <th>ADMIN</th>
                <th>ROLE</th>
                <th>ACTION</th>
                <th>DETAILS</th>
                <th>IP ADDRESS</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {mockAuditLogs.map((log) => (
                <tr key={log.id}>
                  <td><p className="text-sm font-inter text-dark-text/60">{log.timestamp}</p></td>
                  <td><p className="text-sm font-poppins text-dark-text">{log.admin}</p></td>
                  <td>
                    <span className={`badge ${
                      log.role === "Super Admin" ? "badge-success" :
                      log.role === "Guidance Counselor" ? "badge-info" :
                      log.role === "Researcher" ? "badge-warning" : "badge"
                    }`}>
                      {log.role}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {log.action === "Export Data" && <span>📥</span>}
                      {log.action === "Alert Review" && <span>👁️</span>}
                      {log.action === "Settings Change" && <span>⚙️</span>}
                      {log.action === "Report View" && <span>📊</span>}
                      {log.action === "Database Backup" && <span>💾</span>}
                      <p className="text-sm font-inter text-dark-text">{log.action}</p>
                    </div>
                  </td>
                  <td><p className="text-sm font-mono text-dark-text">{log.details}</p></td>
                  <td><p className="text-sm font-mono text-dark-text/60">{log.ip}</p></td>
                  <td>
                    <span className={`badge ${
                      log.status === "Success" ? "badge-success" : "badge-error"
                    }`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-dark-text/60 font-inter">Showing 5 of 4,812 entries</p>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm font-poppins text-dark-text/60 hover:bg-gray-50">← Prev</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-r from-primary-blue to-lavender text-sm font-semibold font-poppins text-dark-text">1</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm font-poppins text-dark-text hover:bg-gray-50">2</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm font-poppins text-dark-text hover:bg-gray-50">3</button>
            <span className="text-sm font-poppins text-dark-text/60">...</span>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm font-poppins text-dark-text hover:bg-gray-50">482</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm font-poppins text-dark-text hover:bg-gray-50">Next →</button>
          </div>
        </div>
      </Card>
    </div>
  );
}
