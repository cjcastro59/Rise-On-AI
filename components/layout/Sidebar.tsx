"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
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
    <aside className="w-64 bg-white border-r border-light-gray p-6 hidden md:flex md:flex-col md:h-full md:min-h-screen">
      <div className="flex items-center gap-2 mb-10">
        <Image
          src="/logo/Without Text.png"
          alt="Rise On Logo"
          width={40}
          height={40}
          className="object-contain"
        />
        <span className="font-poppins font-bold text-dark-text text-xl">Rise On</span>
      </div>

      <nav className="flex-1 space-y-2 mb-10">
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-poppins transition-all ${
            isActive("dashboard")
              ? "bg-primary-blue/10 text-primary-blue font-semibold"
              : "text-dark-text hover:bg-light-gray"
          }`}
        >
          <Image src="/icons/dashboard.svg" alt="Dashboard" width={20} height={20} className="object-contain" />
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
          <Image src="/icons/new-entry.svg" alt="New Entry" width={20} height={20} className="object-contain" />
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
          <Image src="/icons/journal.svg" alt="My Journal" width={20} height={20} className="object-contain" />
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
          <Image src="/icons/mood-insights.svg" alt="Mood Insights" width={20} height={20} className="object-contain" />
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
          <Image src="/icons/ai-reports.svg" alt="AI Reports" width={20} height={20} className="object-contain" />
          AI Reports
        </Link>
      </nav>

      <div className="pt-6 border-t border-light-gray space-y-2 mb-8">
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-poppins transition-all ${
            isActive("settings")
              ? "bg-primary-blue/10 text-primary-blue font-semibold"
              : "text-dark-text hover:bg-light-gray"
          }`}
        >
          <Image src="/icons/settings.svg" alt="Settings" width={20} height={20} className="object-contain" />
          Settings
        </Link>
      </div>

      <div className="mt-auto">
        <Link
          href="/profile"
          className="block p-4 mb-4 bg-slate-100 rounded-xl border border-slate-200 transition-all hover:border-primary-blue/20 hover:bg-white"
        >
          <div className="flex items-center gap-3 mb-2">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Profile" width={48} height={48} className="rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary-blue/10 flex items-center justify-center text-primary-blue font-bold text-sm">
                {userName
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-dark-text">{userName}</p>
              <p className="text-xs text-dark-text/60">{userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : "User"}</p>
            </div>
          </div>
          <p className="text-xs text-dark-text/60">Manage your profile, settings, and support access.</p>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>Edit profile</span>
            <span className="font-semibold">→</span>
          </div>
        </Link>
        <Link
          href="/support"
          className="flex items-center gap-3 px-3 py-2 rounded-xl bg-soft-red/10 text-soft-red text-sm font-poppins font-semibold hover:bg-soft-red/20 transition-all"
        >
          <Image src="/icons/crisis-report.svg" alt="Get Help Now" width={16} height={16} className="object-contain" />
          Get Help Now
        </Link>
        <form action="/api/auth/signout" method="post">
          <Button variant="secondary" className="w-full flex items-center justify-center gap-2 mt-3">
            <Image src="/icons/logout.svg" alt="Log Out" width={20} height={20} className="object-contain" />
            Log Out
          </Button>
        </form>
      </div>
    </aside>
  );
}
