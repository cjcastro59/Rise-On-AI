"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import ProfileCard from "@/components/layout/ProfileCard";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  userName: string;
  activePage?: "dashboard" | "journal" | "history" | "insights" | "analysis";
}

export default function Sidebar({ userName }: SidebarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const pathname = usePathname();
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  
  useEffect(() => {
    if (user) {
      supabase
        .from("user_profiles")
        .select("avatar_url, role")
        .eq("id", user.id)
        .single()
        .then(({ data }: { data: { avatar_url: string | null; role: string | null } | null }) => {
          if (data) {
            setAvatarUrl(data.avatar_url);
            setUserRole(data.role);
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
    <aside className="w-64 bg-[#1E293B] text-white p-6 hidden md:flex md:flex-col md:h-full md:min-h-screen">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Image
            src="/logo/Without Text.png"
            alt="Rise On Logo"
            width={36}
            height={36}
            className="rounded-lg object-contain"
          />
          <h2 className="text-lg font-poppins font-semibold">Rise On</h2>
        </div>
        <p className="text-xs text-white/50 font-poppins mt-1">Member Panel</p>
      </div>

      <div className="mb-6">
        <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">Main</p>
        <div className="space-y-1">
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
              isActive("dashboard")
                ? "bg-[#A8DADC]/20 text-[#A8DADC]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Image src="/icons/dashboard.svg" alt="Dashboard" width={18} height={18} className="object-contain" />
            Dashboard
          </Link>
          <Link
            href="/journal"
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
              isActive("journal")
                ? "bg-[#A8DADC]/20 text-[#A8DADC]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Image src="/icons/new-entry.svg" alt="New Entry" width={18} height={18} className="object-contain" />
            New Entry
          </Link>
          <Link
            href="/journal/history"
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
              isActive("history")
                ? "bg-[#A8DADC]/20 text-[#A8DADC]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Image src="/icons/journal.svg" alt="My Journal" width={18} height={18} className="object-contain" />
            My Journal
          </Link>
          <Link
            href="/insights"
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
              isActive("insights")
                ? "bg-[#A8DADC]/20 text-[#A8DADC]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Image src="/icons/mood-insights.svg" alt="Mood Insights" width={18} height={18} className="object-contain" />
            Mood Insights
          </Link>
          <Link
            href="/analysis"
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
              isActive("analysis")
                ? "bg-[#A8DADC]/20 text-[#A8DADC]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Image src="/icons/ai-reports.svg" alt="AI Reports" width={18} height={18} className="object-contain" />
            AI Reports
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">System</p>
        <div className="space-y-1">
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
              isActive("settings")
                ? "bg-[#A8DADC]/20 text-[#A8DADC]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Image src="/icons/settings.svg" alt="Settings" width={18} height={18} className="object-contain filter invert brightness-200" />
            Settings
          </Link>
        </div>
      </div>

      <div className="mt-auto">
        <ProfileCard
          href="/profile"
          avatarUrl={avatarUrl}
          name={userName}
          role={userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : "User"}
        />
        <Link
          href="/support"
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F4A6A6]/15 text-[#F4A6A6] text-sm font-poppins font-semibold border border-[#F4A6A6]/20 hover:bg-[#F4A6A6]/25 transition-all duration-200"
        >
          <Image src="/icons/crisis-report.svg" alt="Get Help Now" width={16} height={16} className="object-contain" />
          Get Help Now
        </Link>
        <form action="/api/auth/signout" method="post">
          <Button variant="secondary" className="w-full flex items-center justify-center gap-2 mt-2 py-2 bg-white/10 text-white border-white/20 hover:bg-white/20">
            <Image src="/icons/logout.svg" alt="Log Out" width={18} height={18} className="object-contain" />
            Log Out
          </Button>
        </form>
      </div>
    </aside>
  );
}
