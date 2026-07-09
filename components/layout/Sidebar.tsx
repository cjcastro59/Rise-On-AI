"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  userName: string;
}

export default function Sidebar({ userName }: SidebarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const pathname = usePathname();
  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      supabase
        .from("user_profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setAvatarUrl(data.avatar_url);
          }
        });
    }
  }, [user, supabase]);

  const isActive = (page: "dashboard" | "journal" | "history" | "insights" | "analysis" | "profile" | "settings" | "support") => {
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
      case "profile":
        return pathname === "/profile";
      case "settings":
        return pathname === "/settings";
      case "support":
        return pathname === "/support";
      default:
        return false;
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-light-gray p-6 hidden md:block">
      <div className="flex items-center gap-2 mb-10">
        <img
          src="/logo/Without Text.png"
          alt="Rise On Logo"
          className="w-10 h-10 object-contain"
        />
        <span className="font-poppins font-bold text-dark-text text-xl">Rise On</span>
      </div>

      <nav className="space-y-2 mb-10">
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-poppins transition-all ${isActive("dashboard")
              ? "bg-primary-blue/10 text-primary-blue font-semibold"
              : "text-dark-text hover:bg-light-gray"
            }`}
        >
          <span className="text-xl">📊</span>
          Dashboard
        </Link>
        <Link
          href="/journal"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-poppins transition-all ${isActive("journal")
              ? "bg-primary-blue/10 text-primary-blue font-semibold"
              : "text-dark-text hover:bg-light-gray"
            }`}
        >
          <span className="text-xl">📝</span>
          New Entry
        </Link>
        <Link
          href="/journal/history"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-poppins transition-all ${isActive("history")
              ? "bg-primary-blue/10 text-primary-blue font-semibold"
              : "text-dark-text hover:bg-light-gray"
            }`}
        >
          <span className="text-xl">📖</span>
          My Journal
        </Link>
        <Link
          href="/insights"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-poppins transition-all ${isActive("insights")
              ? "bg-primary-blue/10 text-primary-blue font-semibold"
              : "text-dark-text hover:bg-light-gray"
            }`}
        >
          <span className="text-xl">📈</span>
          Mood Insights
        </Link>
        <Link
          href="/analysis"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-poppins transition-all ${isActive("analysis")
              ? "bg-primary-blue/10 text-primary-blue font-semibold"
              : "text-dark-text hover:bg-light-gray"
            }`}
        >
          <span className="text-xl">🤖</span>
          AI Reports
        </Link>
      </nav>

      <div className="pt-6 border-t border-light-gray space-y-2 mb-8">
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-poppins transition-all ${isActive("settings")
              ? "bg-primary-blue/10 text-primary-blue font-semibold"
              : "text-dark-text hover:bg-light-gray"
            }`}
        >
          <span className="text-xl">⚙️</span>
          Settings
        </Link>
        <Link
          href="/profile"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-poppins transition-all ${isActive("profile")
              ? "bg-primary-blue/10 text-primary-blue font-semibold"
              : "text-dark-text hover:bg-light-gray"
            }`}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <span className="text-xl">👤</span>
          )}
          Profile
        </Link>
      </div>

      <div className="space-y-3">
        <Link
          href="/support"
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-soft-red/10 text-soft-red text-sm font-poppins font-semibold hover:bg-soft-red/20 transition-all"
        >
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
