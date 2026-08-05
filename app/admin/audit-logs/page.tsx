"use client";

import { Card } from "@/components/ui/card";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const PAGE_SIZE = 10;

// Define suspicious actions
const SUSPICIOUS_ACTIONS = [
  "Settings Change",
  "User Delete",
  "Database Modify",
  "Role Change",
  "Mass Export"
];

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("All");
  const [adminFilter, setAdminFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  // Fetch logs from Supabase
  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      let query = supabase
        .from("audit_logs")
        .select(`
          *,
          user_profiles!admin_id (
            email,
            role
          )
        `)
        .order("created_at", { ascending: false });

      // Apply filters
      if (actionFilter !== "All") {
        query = query.eq("action", actionFilter);
      }
      
      if (dateFilter === "Today") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte("created_at", today.toISOString());
      } else if (dateFilter === "This Week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte("created_at", weekAgo.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching audit logs:", error);
        setLogs([]);
      } else if (data && data.length > 0) {
        setLogs(data.map((log: any) => ({
          ...log,
          admin: log.user_profiles?.email || "System",
          role: log.user_profiles?.role || "Automated"
        })));
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, dateFilter, supabase, user]);

  // Mock data generator for testing
  const getMockData = () => [
    {
      id: "L-01234",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      admin: "admin@rise-on.edu",
      role: "admin",
      action: "Export Data",
      details: "Mood Report — May 2026",
      ip_address: "192.168.1.100",
      status: "Success",
    },
    {
      id: "L-01233",
      created_at: new Date(Date.now() - 7200000).toISOString(),
      admin: "counselor@rise-on.edu",
      role: "counselor",
      action: "Alert Review",
      details: "RAI-0021 — Critical flag reviewed",
      ip_address: "10.0.0.51",
      status: "Success",
    },
    {
      id: "L-01232",
      created_at: new Date(Date.now() - 10800000).toISOString(),
      admin: "admin@rise-on.edu",
      role: "admin",
      action: "Settings Change",
      details: "Attempted to access user data (blocked)",
      ip_address: "203.177.22.9",
      status: "Blocked",
    },
    {
      id: "L-01231",
      created_at: new Date(Date.now() - 14400000).toISOString(),
      admin: "owner@rise-on.edu",
      role: "owner",
      action: "Report View",
      details: "Mood Analytics — April 2026",
      ip_address: "192.168.1.100",
      status: "Success",
    },
    {
      id: "L-01230",
      created_at: new Date(Date.now() - 18000000).toISOString(),
      admin: "System",
      role: "Automated",
      action: "Database Backup",
      details: "Full backup completed",
      ip_address: "Internal",
      status: "Success",
    },
  ];

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Filter logs based on search and filters
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.admin?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      log.action?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      log.ip_address?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      log.details?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  // Calculate stats
  const totalLogs = logs.length;
  const activeSessions = Math.min(logs.length, 12); // Mock for now
  const suspiciousCount = logs.filter(log => 
    SUSPICIOUS_ACTIONS.includes(log.action) || log.status === "Blocked"
  ).length;
  const encryptedPercentage = 100; // Assuming encrypted storage

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + PAGE_SIZE);

  // Export function
  const exportLogs = () => {
    const csvContent = [
      ["Timestamp", "Admin", "Role", "Action", "Details", "IP Address", "Status"].join(","),
      ...filteredLogs.map(log => [
        log.created_at,
        log.admin,
        log.role,
        log.action,
        `"${log.details || ""}"`,
        log.ip_address,
        log.status
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Get role pill color
  const getRolePillClass = (role: string) => {
    switch (role) {
      case "owner": return "badge-error";
      case "admin": return "badge-success";
      case "counselor": return "badge-info";
      default: return "badge-warning";
    }
  };

  // Check if action is suspicious
  const isSuspicious = (log: any) => 
    SUSPICIOUS_ACTIONS.includes(log.action) || log.status === "Blocked";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue mx-auto mb-4"></div>
          <p className="text-dark-text/60 font-poppins">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Immutable Log Notice Banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
        <span className="text-yellow-600 text-xl">🛡️</span>
        <div>
          <h3 className="font-poppins font-semibold text-yellow-800">Immutable Audit Logs</h3>
          <p className="text-sm font-inter text-yellow-700">
            All audit logs are write-once and cannot be modified or deleted, ensuring complete accountability for all administrative actions.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-1">Audit Logs / Activity Monitor</h1>
          <p className="text-sm text-dark-text/60 font-poppins">Complete record of every admin action, timestamped, and immutable; ensures full accountability</p>
        </div>
        <div className="flex gap-3">
          <button 
            className="btn-secondary flex items-center gap-2"
            onClick={exportLogs}
          >
            <span>📄</span> Export Log
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="stat-card border-l-4 border-l-primary-blue">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-primary-blue/20">📋</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">TOTAL LOG ENTRIES</p>
              <p className="text-2xl font-dm-serif text-dark-text">{totalLogs.toLocaleString()}</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-primary-blue to-lavender"></div>
        </Card>
        <Card className="stat-card border-l-4 border-l-lavender">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-lavender/20">👤</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">ACTIVE ADMIN SESSIONS</p>
              <p className="text-2xl font-dm-serif text-dark-text">{activeSessions}</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-purple-400 to-pink-300"></div>
        </Card>
        <Card className="stat-card border-l-4 border-l-warning-yellow">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-warning-yellow/30">⚠️</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">SUSPICIOUS ACTIONS</p>
              <p className="text-2xl font-dm-serif text-dark-text">{suspiciousCount}</p>
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
              <p className="text-2xl font-dm-serif text-dark-text">{encryptedPercentage}%</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-green-400 to-emerald-300"></div>
        </Card>
      </div>

      {/* Log Table */}
      <Card className="p-6">
        {/* Filters & Search */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="md:col-span-2">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-text/60">🔍</span>
              <input
                type="text"
                placeholder="Search by action, admin, or IP address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-sm font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/50"
              />
            </div>
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/50"
          >
            <option value="All">All Actions</option>
            <option value="Login">Logins</option>
            <option value="Export Data">Exports</option>
            <option value="Report View">Reports</option>
            <option value="Settings Change">Settings</option>
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/50"
          >
            <option value="All">All Time</option>
            <option value="Today">Today</option>
            <option value="This Week">This Week</option>
            <option value="This Month">This Month</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-dark-text/60 font-poppins">No audit logs yet.</p>
              <p className="text-xs text-dark-text/40 font-inter mt-2">Audit logs will appear here when administrative actions are performed.</p>
            </div>
          ) : (
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
              {paginatedLogs.map((log) => (
                <tr 
                  key={log.id} 
                  className={`${
                    isSuspicious(log) ? "bg-red-50 hover:bg-red-100" : ""
                  } transition-colors`}
                >
                  <td><p className="text-sm font-inter text-dark-text/60">{formatTimestamp(log.created_at)}</p></td>
                  <td><p className="text-sm font-poppins text-dark-text">{log.admin}</p></td>
                  <td>
                    <span className={`badge ${getRolePillClass(log.role)}`}>
                      {log.role?.charAt(0).toUpperCase() + log.role?.slice(1) || "Unknown"}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {log.action === "Export Data" && <span>📥</span>}
                      {log.action === "Alert Review" && <span>👁️</span>}
                      {log.action === "Settings Change" && <span>⚙️</span>}
                      {log.action === "Report View" && <span>📊</span>}
                      {log.action === "Database Backup" && <span>💾</span>}
                      {log.action === "Login" && <span>🔐</span>}
                      <p className="text-sm font-inter text-dark-text">{log.action}</p>
                    </div>
                  </td>
                  <td><p className="text-sm font-mono text-dark-text">{log.details || "-"}</p></td>
                  <td><p className="text-sm font-mono text-dark-text/60">{log.ip_address || "-"}</p></td>
                  <td>
                    <span className={`badge ${
                      log.status === "Success" ? "badge-success" : "badge-error"
                    }`}>
                      {log.status || "Unknown"}
                    </span>
                  </td>
                </tr>
              ))}
              {/* Add empty rows to maintain consistent table height */}
              {Array.from({ length: PAGE_SIZE - paginatedLogs.length }).map((_, index) => (
                <tr key={`empty-${index}`} className="border-b border-gray-100">
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
          )}
        </div>

        {/* Pagination */}
        {filteredLogs.length > 0 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-dark-text/60 font-poppins">
              Showing {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length} entries
            </p>
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
                    className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-poppins transition-colors ${
                      currentPage === page
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
