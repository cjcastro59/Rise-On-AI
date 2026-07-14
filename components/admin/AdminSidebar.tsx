"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  username: string | null;
  role: string;
  avatar_url: string | null;
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user: currentUser } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [distressAlertCount, setDistressAlertCount] = useState(0);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchSidebarData = async () => {
      try {
        const [profileResult, alertsResult] = await Promise.all([
          supabase
            .from("user_profiles")
            .select("id, first_name, last_name, full_name, username, role, avatar_url")
            .eq("id", currentUser.id)
            .single(),
          supabase
            .from("distress_logs")
            .select("id", { count: "exact", head: true }),
        ]);
        
        if (!profileResult.error && profileResult.data) {
          setUserProfile(profileResult.data);
        }

        if (!alertsResult.error) {
          setDistressAlertCount(alertsResult.count || 0);
        }
      } catch (err) {
        console.error("Error fetching admin sidebar data:", err);
      }
    };

    fetchSidebarData();
    const interval = setInterval(fetchSidebarData, 30_000);
    return () => clearInterval(interval);
  }, [currentUser, supabase]);

  const getDisplayName = () => {
    if (!userProfile) return "User";
    if (userProfile.first_name && userProfile.last_name) {
      return `${userProfile.first_name} ${userProfile.last_name}`;
    }
    if (userProfile.full_name) return userProfile.full_name;
    if (userProfile.username) return userProfile.username;
    return "User";
  };

  const getInitials = () => {
    const name = getDisplayName();
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const roleLabel = userProfile?.role
    ? userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)
    : "User";

  return (
    <aside className="w-64 bg-[#1E293B] text-white p-4 hidden md:flex md:h-screen md:flex-col md:overflow-hidden">
      <div className="mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <Image 
            src="/logo/Without Text.png" 
            alt="Rise On AI Logo" 
            width={32} 
            height={32}
            className="rounded-lg"
          />
          <h2 className="text-base font-poppins font-semibold">Rise On</h2>
        </div>
        <p className="text-xs text-white/50 font-poppins mt-1">Admin Panel</p>
      </div>

      <nav className="min-h-0 flex-1">
        {/* MAIN Section */}
        <div className="mb-3">
          <p className="text-[11px] font-poppins text-white/50 uppercase tracking-wider mb-2">Main</p>
          <div className="space-y-1">
            <Link
              href="/admin/dashboard"
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-poppins transition-all ${
                pathname === "/admin/dashboard" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Image src="/icons/dashboard.svg" alt="Dashboard" width={16} height={16} className="object-contain" /> Dashboard
            </Link>
            <Link
              href="/admin/users"
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-poppins transition-all ${
                pathname === "/admin/users" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Image src="/icons/account.svg" alt="User Management" width={16} height={16} className="object-contain" /> User Management
            </Link>
          </div>
        </div>

        {/* ANALYTICS Section */}
        <div className="mb-3">
          <p className="text-[11px] font-poppins text-white/50 uppercase tracking-wider mb-2">Analytics</p>
          <div className="space-y-1">
            <Link
              href="/admin/journal-monitor"
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-poppins transition-all ${
                pathname === "/admin/journal-monitor" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Image src="/icons/journal.svg" alt="Journal Monitor" width={16} height={16} className="object-contain" /> Journal Monitor
            </Link>
            <Link
              href="/admin/mood-trends"
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-poppins transition-all ${
                pathname === "/admin/mood-trends" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Image src="/icons/trends.svg" alt="Mood Reports" width={16} height={16} className="object-contain" /> Mood Reports
            </Link>
            <Link
              href="/admin/sentiment-monitoring"
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-poppins transition-all ${
                pathname === "/admin/sentiment-monitoring" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Image src="/icons/ai-sentiment.svg" alt="Sentiment Monitor" width={16} height={16} className="object-contain" /> Sentiment Monitor
            </Link>
            <Link
              href="/admin/feedback"
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-poppins transition-all ${
                pathname === "/admin/feedback" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Image src="/icons/mood.svg" alt="Feedback" width={16} height={16} className="object-contain" /> Feedback
            </Link>
          </div>
        </div>

        {/* SUPPORT Section */}
        <div className="mb-3">
          <p className="text-[11px] font-poppins text-white/50 uppercase tracking-wider mb-2">Support</p>
          <div className="space-y-1">
            <Link
              href="/admin/support"
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-poppins transition-all ${
                pathname === "/admin/support" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Image src="/icons/crisis-support.svg" alt="Support Chat" width={16} height={16} className="object-contain" /> Support Chat
            </Link>
          </div>
        </div>

        {/* SAFETY Section */}
        <div className="mb-3">
          <p className="text-[11px] font-poppins text-white/50 uppercase tracking-wider mb-2">Safety</p>
          <div className="space-y-1">
            <Link
              href="/admin/distress-alerts"
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-poppins transition-all ${
                pathname === "/admin/distress-alerts" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Image src="/icons/crisis-support.svg" alt="Distress Alerts" width={16} height={16} className="object-contain" /> Distress Alerts
              {distressAlertCount > 0 && (
                <span className="ml-auto bg-[#F4A6A6] text-[#1E293B] text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {distressAlertCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* SYSTEM Section */}
        <div className="mb-3">
          <p className="text-[11px] font-poppins text-white/50 uppercase tracking-wider mb-2">System</p>
          <div className="space-y-1">
            <Link
              href="/admin/system-settings"
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-poppins transition-all ${
                pathname === "/admin/system-settings" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Image src="/icons/settings.svg" alt="Settings" width={16} height={16} className="object-contain filter invert brightness-200" /> Settings
            </Link>
            <Link
              href="/admin/audit-logs"
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-poppins transition-all ${
                pathname === "/admin/audit-logs" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Image src="/icons/data-export.svg" alt="Audit Logs" width={16} height={16} className="object-contain" /> Audit Logs
            </Link>
          </div>
        </div>
      </nav>

      <div className="shrink-0 pt-2">
        <Link href="/admin/profile">
          <div className="p-2 bg-white/5 rounded-xl border border-white/10 mb-2 hover:bg-white/10 transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
                {userProfile?.avatar_url ? (
                <Image
                  src={userProfile.avatar_url}
                  alt="Profile"
                  width={32}
                  height={32}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] rounded-full flex items-center justify-center text-[#1E293B] font-bold font-poppins text-xs">
                  {getInitials()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-poppins text-white leading-tight">{getDisplayName()}</p>
                <p className="text-[10px] text-white/50 font-poppins leading-snug">
                  {roleLabel}
                </p>
              </div>
            </div>
          </div>
        </Link>
        <form action="/api/auth/signout" method="post">
          <Button variant="secondary" size="sm" className="w-full flex items-center justify-center gap-2 bg-white/10 text-white border-white/20 hover:bg-white/20">
            <Image src="/icons/logout.svg" alt="Log Out" width={16} height={16} className="object-contain" />
            Log Out
          </Button>
        </form>
      </div>
    </aside>
  );
}
