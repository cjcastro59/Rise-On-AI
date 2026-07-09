"use client";

import { Card } from "@/components/ui/card";
import { useState } from "react";

const mockCriticalAlerts = [
  {
    id: "A-0056",
    userId: "RAI-0021",
    trigger: "Severe distress keywords detected",
    details: "Detected: \"hopeless\", \"wanting die\", \"quit kayang sumuko\" • Sentiment: 91% Negative • Score: 2.0/10 • 12 min ago",
  },
  {
    id: "A-0055",
    userId: "RAI-0102",
    trigger: "Crisis-level negative streak",
    details: "6 negative entries in 72 hours • Avg mood: 2.8/10 • Last active: 2 hrs ago",
  },
  {
    id: "A-0054",
    userId: "RAI-0188",
    trigger: "Sudden mood collapse",
    details: "Mood dropped from 8.2 to 1.5 in 48hrs • No entries since May 26",
  },
];

const mockMediumAlerts = [
  {
    id: "A-0089",
    userId: "RAI-0051",
    trigger: "Mood drop pattern",
    mood: "4.1/10",
    lastEntry: "7 days ago",
    assignee: "guidance@cpu.edu",
    status: "In Progress",
  },
  {
    id: "A-0091",
    userId: "RAI-0341",
    trigger: "Anxiety keywords high",
    mood: "4.8/10",
    lastEntry: "Today",
    assignee: "Unassigned",
    status: "New",
  },
];

export default function AdminDistressAlertsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-dm-serif text-error-red mb-1">Distress Alert Monitoring</h1>
          <p className="text-sm text-[#374151] font-poppins">Real-time emotional crisis detection • Anonymized IDs • Requires immediate review</p>
        </div>
        <div className="flex gap-3">
          <span className="badge-error animate-pulse">⚡ 3 Active Alerts</span>
          <button className="btn-secondary flex items-center gap-2">
            <span>📄</span> Export Log
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
            <div className="stat-card-icon bg-error-red/20">🔴</div>
            <div className="text-right">
              <p className="text-xs text-[#374151] font-poppins">CRITICAL ALERTS</p>
              <p className="text-2xl font-dm-serif text-error-red">3</p>
              <p className="text-xs text-error-red font-poppins">Needs immediate review</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-red-400 to-pink-300"></div>
        </Card>
        <Card className="stat-card border-l-4 border-l-warning-yellow">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-warning-yellow/30">🟠</div>
            <div className="text-right">
              <p className="text-xs text-dark-text/60 font-poppins">MEDIUM ALERTS</p>
              <p className="text-2xl font-dm-serif text-dark-text">11</p>
              <p className="text-xs text-[#374151] font-poppins">Monitor closely</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-yellow-400 to-orange-300"></div>
        </Card>
        <Card className="stat-card border-l-4 border-l-success-green">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-success-green/30">🟢</div>
            <div className="text-right">
              <p className="text-xs text-[#374151] font-poppins">RESOLVED THIS WEEK</p>
              <p className="text-2xl font-dm-serif text-dark-text">28</p>
              <p className="text-xs text-success-green font-poppins">↑ Good progress</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-green-400 to-emerald-300"></div>
        </Card>
        <Card className="stat-card border-l-4 border-l-primary-blue">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-primary-blue/20">✅</div>
            <div className="text-right">
              <p className="text-xs text-[#374151] font-poppins">RESPONSE RATE</p>
              <p className="text-2xl font-dm-serif text-dark-text">94%</p>
              <p className="text-xs text-dark-text/60 font-poppins">↑ Within 2hrs</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-primary-blue to-teal"></div>
        </Card>
      </div>

      {/* Critical Alerts */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-error-red"></span>
          <h2 className="text-xs font-poppins font-semibold text-dark-text uppercase tracking-wider">Critical — Immediate Attention Required</h2>
        </div>
        {mockCriticalAlerts.map((alert) => (
          <Card key={alert.id} className="p-5 bg-error-red/5 border border-error-red/20 rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-error-red/30 flex items-center justify-center text-2xl">🩸</div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-semibold text-primary-blue">{alert.id}</span>
                    <span className="badge-error">Active</span>
                  </div>
                  <p className="text-sm font-poppins font-semibold text-dark-text">{alert.trigger} — {alert.userId}</p>
                  <p className="text-xs text-[#374151] font-inter">{alert.details}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button className="btn-sm bg-error-red text-white">Review Now</button>
                <button className="btn-sm border border-primary-blue text-primary-blue">Assign Counselor</button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Medium Alerts */}
      <div className="space-y-4 mt-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-warning-yellow"></span>
          <h2 className="text-xs font-poppins font-semibold text-dark-text uppercase tracking-wider">Medium — Monitor Closely</h2>
        </div>
        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>USER ID</th>
                  <th>TRIGGER</th>
                  <th>MOOD SCORE</th>
                  <th>LAST ENTRY</th>
                  <th>ASSIGNED TO</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {mockMediumAlerts.map((alert) => (
                  <tr key={alert.id}>
                    <td><p className="font-mono text-sm font-semibold text-primary-blue">{alert.userId}</p></td>
                    <td><p className="text-sm font-inter text-dark-text">{alert.trigger}</p></td>
                    <td><p className="text-sm font-poppins text-dark-text">{alert.mood}</p></td>
                    <td><p className="text-sm font-inter text-dark-text/60">{alert.lastEntry}</p></td>
                    <td><p className="text-sm font-inter text-dark-text/60">{alert.assignee}</p></td>
                    <td>
                      <span className={alert.status === "In Progress" ? "badge-warning" : "badge-info"}>
                        {alert.status}
                      </span>
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
          <p className="text-xs font-poppins text-[#374151]">DISTRESS ALERT TREND — LAST 30 DAYS</p>
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
            <span className="text-xs text-[#374151] font-poppins">Apr 28</span>
            <span className="text-xs text-[#374151] font-poppins">May 5</span>
            <span className="text-xs text-[#374151] font-poppins">May 12</span>
            <span className="text-xs text-[#374151] font-poppins">May 19</span>
            <span className="text-xs text-[#374151] font-poppins">May 28</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
