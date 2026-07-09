"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";

const mockUsers = [
  {
    id: "RAI-0001",
    university: "UP Diliman",
    year: "3rd Year",
    entries: 47,
    lastActive: "Today, 9:24 AM",
    avgMood: "7.4/10",
    sentiment: "Positive",
    status: "Active",
  },
  {
    id: "RAI-0002",
    university: "DLSU Manila",
    year: "2nd Year",
    entries: 31,
    lastActive: "Yesterday",
    avgMood: "5.9/10",
    sentiment: "Mixed",
    status: "Active",
  },
  {
    id: "RAI-0089",
    university: "UST Manila",
    year: "4th Year",
    entries: 12,
    lastActive: "2 days ago",
    avgMood: "4.7/10",
    sentiment: "Declining",
    status: "At Risk",
  },
  {
    id: "RAI-0032",
    university: "Ateneo de Manila",
    year: "1st Year",
    entries: 68,
    lastActive: "Today, 6:48 AM",
    avgMood: "8.2/10",
    sentiment: "Positive",
    status: "Flagged",
  },
  {
    id: "RAI-0052",
    university: "UP Diliman",
    year: "2nd Year",
    entries: 29,
    lastActive: "Today, 8:00 AM",
    avgMood: "3.5/10",
    sentiment: "Negative",
    status: "At Risk",
  },
  {
    id: "RAI-0064",
    university: "DLSU Manila",
    year: "Graduate",
    entries: 84,
    lastActive: "3 days ago",
    avgMood: "6.8/10",
    sentiment: "Positive",
    status: "Active",
  },
  {
    id: "RAI-0789",
    university: "Ateneo de Manila",
    year: "3rd Year",
    entries: 5,
    lastActive: "2 weeks ago",
    avgMood: "—",
    sentiment: "No Data",
    status: "Inactive",
  },
];

export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [users] = useState(mockUsers);

  const filteredUsers = users.filter(
    (user) =>
      user.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.university.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-dm-serif text-[#4F4F4F] mb-1">User Management</h1>
          <p className="text-sm text-[#374151] font-poppins">2,418 total registered users; Anonymized IDs shown</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-poppins text-[#4F4F4F] hover:bg-gray-50">
            <span>📊</span> Export CSV
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] rounded-lg text-sm font-poppins text-[#4F4F4F] font-medium">
            <span>➕</span> Add Admin User
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      <div className="p-4 bg-gradient-to-r from-[#A8DADC]/20 to-[#CDB4DB]/20 rounded-xl border-l-4 border-l-[#CDB4DB]">
        <p className="text-sm font-poppins text-[#4F4F4F] flex items-center gap-2">
          <span>🔒</span> User identities are shown as anonymized IDs (RAI-###). Personal details are restricted to Super Admin only. Journal content is never displayed here.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-l-4 border-l-[#A8DADC]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center text-2xl">👥</div>
            <div className="text-right">
              <p className="text-xs text-[#374151] font-poppins">TOTAL USERS</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">2,418</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-400 to-cyan-300 rounded-full"></div>
        </Card>
        <Card className="p-5 border-l-4 border-l-[#52B788]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#52B788]/20 rounded-lg flex items-center justify-center text-2xl">✅</div>
            <div className="text-right">
              <p className="text-xs text-[#374151] font-poppins">ACTIVE (30d)</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">1,984</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-300 rounded-full"></div>
        </Card>
        <Card className="p-5 border-l-4 border-l-[#CDB4DB]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center text-2xl">⏸️</div>
            <div className="text-right">
              <p className="text-xs text-[#374151] font-poppins">INACTIVE</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">312</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-300 rounded-full"></div>
        </Card>
        <Card className="p-5 border-l-4 border-l-[#F4A6A6]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#F4A6A6]/20 rounded-lg flex items-center justify-center text-2xl">🚫</div>
            <div className="text-right">
              <p className="text-xs text-[#374151] font-poppins">FLAGGED / AT RISK</p>
              <p className="text-2xl font-dm-serif text-[#F4A6A6]">122</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-red-400 to-pink-300 rounded-full"></div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4F4F4F]/60">🔍</span>
            <input
              type="text"
              placeholder="Search by RAI-ID, University, Year Level..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl text-sm font-poppins text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#A8DADC]/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <select className="px-4 py-3 border border-gray-300 rounded-xl text-sm font-poppins text-[#4F4F4F] bg-white">
          <option>All Universities</option>
          <option>UP Diliman</option>
          <option>DLSU Manila</option>
          <option>UST Manila</option>
          <option>Ateneo de Manila</option>
        </select>
        <select className="px-4 py-3 border border-gray-300 rounded-xl text-sm font-poppins text-[#4F4F4F] bg-white">
          <option>All Statuses</option>
          <option>Active</option>
          <option>Inactive</option>
          <option>At Risk</option>
          <option>Flagged</option>
        </select>
        <select className="px-4 py-3 border border-gray-300 rounded-xl text-sm font-poppins text-[#4F4F4F] bg-white">
          <option>All Year Levels</option>
          <option>1st Year</option>
          <option>2nd Year</option>
          <option>3rd Year</option>
          <option>4th Year</option>
          <option>Graduate</option>
        </select>
        <button className="px-4 py-3 bg-[#A8DADC] rounded-xl text-sm font-semibold font-poppins text-[#4F4F4F]">
          Apply Filters
        </button>
      </div>

      {/* Users Table */}
      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#374151] font-poppins uppercase tracking-wider">USER ID</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#374151] font-poppins uppercase tracking-wider">UNIVERSITY</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#374151] font-poppins uppercase tracking-wider">YEAR</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#374151] font-poppins uppercase tracking-wider">ENTRIES</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#374151] font-poppins uppercase tracking-wider">LAST ACTIVE</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#374151] font-poppins uppercase tracking-wider">AVG MOOD</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#374151] font-poppins uppercase tracking-wider">SENTIMENT</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#374151] font-poppins uppercase tracking-wider">STATUS</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#374151] font-poppins uppercase tracking-wider">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-3">
                    <p className="font-poppins font-mono text-sm text-[#A8DADC] font-semibold">{user.id}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-poppins text-[#4F4F4F]">{user.university}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-poppins text-[#4F4F4F]/80">{user.year}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-poppins text-[#4F4F4F]">{user.entries}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-inter text-[#4F4F4F]/60">{user.lastActive}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-poppins text-[#4F4F4F]">{user.avgMood}</p>
                  </td>
                  <td className="py-4 px-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.sentiment === "Positive" ? "bg-[#52B788]/20 text-[#52B788]" : user.sentiment === "Mixed" ? "bg-[#A8DADC]/30 text-[#4F4F4F]/80" : user.sentiment === "Declining" ? "bg-[#FFE8A1]/30 text-[#FFB700]" : user.sentiment === "Negative" ? "bg-[#F4A6A6]/20 text-[#F4A6A6]" : "bg-gray-100 text-[#4F4F4F]/60"}`}>
                      {user.sentiment}
                    </span>
                  </td>
                  <td className="py-4 px-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.status === "Active" ? "bg-[#52B788]/20 text-[#52B788]" : user.status === "At Risk" ? "bg-[#F4A6A6]/20 text-[#F4A6A6]" : user.status === "Flagged" ? "bg-[#FFE8A1]/30 text-[#FFB700]" : "bg-gray-100 text-[#4F4F4F]/60"}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="py-4 px-3">
                    <div className="flex items-center gap-2">
                      <button className="text-[#A8DADC] text-sm font-poppins hover:underline">View</button>
                      {user.status === "At Risk" && (
                        <button className="px-3 py-1 bg-[#F4A6A6]/20 text-[#F4A6A6] rounded-full text-xs font-semibold font-poppins">
                          Review
                        </button>
                      )}
                      {user.status === "Flagged" && (
                        <button className="px-3 py-1 bg-[#FFE8A1]/30 text-[#FFB700] rounded-full text-xs font-semibold font-poppins">
                          Status
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-[#374151] font-inter">Showing 1-7 of 2,418 users</p>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm font-poppins text-[#374151] hover:bg-gray-50">←</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] text-sm font-semibold font-poppins text-[#4F4F4F]">1</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm font-poppins text-[#4F4F4F] hover:bg-gray-50">2</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm font-poppins text-[#4F4F4F] hover:bg-gray-50">3</button>
            <span className="text-sm font-poppins text-[#374151]">...</span>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm font-poppins text-[#4F4F4F] hover:bg-gray-50">346</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm font-poppins text-[#4F4F4F] hover:bg-gray-50">→</button>
          </div>
        </div>
      </Card>
    </div>
  );
}
