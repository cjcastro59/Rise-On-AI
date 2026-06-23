"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 bg-[#1E293B] text-white p-6 flex flex-col min-h-screen">
      <div className="mb-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌻</span>
          <h2 className="text-lg font-poppins font-semibold">Rise On AI</h2>
        </div>
        <p className="text-xs text-white/50 font-poppins mt-1">Admin Panel</p>
      </div>

      {/* MAIN Section */}
      <div className="mb-6">
        <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">Main</p>
        <div className="space-y-1">
          <Link
            href="/admin/dashboard"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/dashboard" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>📊</span> Dashboard
          </Link>
          <Link
            href="/admin/users"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/users" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>👥</span> User Management
          </Link>
        </div>
      </div>

      {/* ANALYTICS Section */}
      <div className="mb-6">
        <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">Analytics</p>
        <div className="space-y-1">
          <Link
            href="/admin/journal-monitor"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/journal-monitor" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>📝</span> Journal Monitor
          </Link>
          <Link
            href="/admin/mood-trends"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/mood-trends" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>📈</span> Mood Reports
          </Link>
          <Link
            href="/admin/sentiment-monitoring"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/sentiment-monitoring" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>🤖</span> Sentiment Monitor
          </Link>
          <Link
            href="/admin/feedback"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/feedback" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>💬</span> Feedback
          </Link>
        </div>
      </div>

      {/* SAFETY Section */}
      <div className="mb-6">
        <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">Safety</p>
        <div className="space-y-1">
          <Link
            href="/admin/distress-alerts"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/distress-alerts" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>🚨</span> Distress Alerts
            <span className="ml-auto bg-[#F4A6A6] text-[#1E293B] text-[10px] px-2 py-0.5 rounded-full font-bold">9</span>
          </Link>
        </div>
      </div>

      {/* SYSTEM Section */}
      <div className="mb-6">
        <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">System</p>
        <div className="space-y-1">
          <Link
            href="/admin/system-settings"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/system-settings" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>⚙️</span> Settings
          </Link>
          <Link
            href="/admin/audit-logs"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/audit-logs" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>📋</span> Audit Logs
          </Link>
        </div>
      </div>

      <div className="mt-auto">
        <div className="p-4 bg-white/5 rounded-xl border border-white/10 mb-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] rounded-full flex items-center justify-center text-[#1E293B] font-bold font-poppins">
              Ad
            </div>
            <div>
              <p className="text-sm font-poppins text-white">Admin</p>
              <p className="text-xs text-white/50 font-poppins">Super Admin</p>
            </div>
          </div>
        </div>
        <form action="/api/auth/signout" method="post">
          <Button variant="secondary" className="w-full flex items-center justify-center gap-2 bg-white/10 text-white border-white/20 hover:bg-white/20">
            <span className="text-xl">🚪</span>
            Log Out
          </Button>
        </form>
      </div>
    </aside>
  );
}
