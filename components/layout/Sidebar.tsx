"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  userName: string;
}

export default function Sidebar({ userName }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (page: "dashboard" | "journal" | "history" | "insights" | "analysis") => {
    switch (page) {
      case "dashboard":
        return pathname === "/dashboard";
      case "journal":
        return pathname === "/journal";
      case "history":
        return pathname === "/journal/history";
      case "insights":
        return pathname === "/insights";
      case "analysis":
        return pathname === "/analysis";
      default:
        return false;
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-light-gray p-6 hidden md:block">
      <div className="flex items-center gap-2 mb-10">
        <div className="w-10 h-10 bg-gradient-to-r from-primary-blue to-lavender rounded-lg flex items-center justify-center">
          <span className="text-white text-xl">🌻</span>
        </div>
        <span className="font-poppins font-bold text-dark-text text-xl">Rise On</span>
      </div>

      <nav className="space-y-2 mb-10">
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-poppins transition-all ${
            isActive("dashboard")
              ? "bg-primary-blue/10 text-primary-blue font-semibold"
              : "text-dark-text hover:bg-light-gray"
          }`}
        >
          <span className="text-xl">📊</span>
          Dashboard
        </Link>
        <Link
          href="/journal"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-poppins transition-all ${
            isActive("journal")
              ? "bg-primary-blue/10 text-primary-blue font-semibold"
              : "text-dark-text hover:bg-light-gray"
          }`}
        >
          <span className="text-xl">📝</span>
          New Entry
        </Link>
        <Link
          href="/journal/history"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-poppins transition-all ${
            isActive("history")
              ? "bg-primary-blue/10 text-primary-blue font-semibold"
              : "text-dark-text hover:bg-light-gray"
          }`}
        >
          <span className="text-xl">📖</span>
          My Journal
        </Link>
        <Link
          href="/insights"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-poppins transition-all ${
            isActive("insights")
              ? "bg-primary-blue/10 text-primary-blue font-semibold"
              : "text-dark-text hover:bg-light-gray"
          }`}
        >
          <span className="text-xl">📈</span>
          Mood Insights
        </Link>
        <Link
          href="/analysis"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-poppins transition-all ${
            isActive("analysis")
              ? "bg-primary-blue/10 text-primary-blue font-semibold"
              : "text-dark-text hover:bg-light-gray"
          }`}
        >
          <span className="text-xl">🤖</span>
          AI Reports
        </Link>
      </nav>

      <div className="pt-6 border-t border-light-gray space-y-2 mb-8">
        <Link href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-dark-text text-sm font-poppins font-medium hover:bg-light-gray">
          <span className="text-xl">⚙️</span>
          Settings
        </Link>
        <Link href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-dark-text text-sm font-poppins font-medium hover:bg-light-gray">
          <span className="text-xl">👤</span>
          Profile
        </Link>
      </div>

      <div className="space-y-3">
        <Link href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-success-green/20 text-dark-text text-sm font-poppins font-semibold">
          <span className="text-xl">🆘</span>
          Get Help Now
        </Link>
        <form action="/api/auth/signout" method="post">
          <Button variant="secondary" className="w-full flex items-center justify-center gap-2">
            <span className="text-xl">🚪</span>
            Log Out
          </Button>
        </form>
      </div>
    </aside>
  );
}
