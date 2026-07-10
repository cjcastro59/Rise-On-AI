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
    <aside className="w-64 bg-[#1E293B] text-white p-6 hidden md:flex md:flex-col md:h-full md:min-h-screen">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Image 
            src="/logo/Without Text.png" 
            alt="Rise On AI Logo" 
            width={36} 
            height={36}
            className="rounded-lg"
          />
          <h2 className="text-lg font-poppins font-semibold">Rise On</h2>
        </div>
        <p className="text-xs text-white/50 font-poppins mt-1">Admin Panel</p>
      </div>

      {/* MAIN Section */}
      <div className="mb-6">
        <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">Main</p>
        <div className="space-y-1">
          <Link
            href="/admin/dashboard"
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/dashboard" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Image src="/icons/dashboard.svg" alt="Dashboard" width={18} height={18} className="object-contain" /> Dashboard
          </Link>
          <Link
            href="/admin/users"
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/users" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Image src="/icons/account.svg" alt="User Management" width={18} height={18} className="object-contain" /> User Management
          </Link>
        </div>
      </div>

      {/* ANALYTICS Section */}
      <div className="mb-6">
        <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">Analytics</p>
        <div className="space-y-1">
          <Link
            href="/admin/journal-monitor"
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/journal-monitor" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Image src="/icons/journal.svg" alt="Journal Monitor" width={18} height={18} className="object-contain" /> Journal Monitor
          </Link>
          <Link
            href="/admin/mood-trends"
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/mood-trends" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Image src="/icons/trends.svg" alt="Mood Reports" width={18} height={18} className="object-contain" /> Mood Reports
          </Link>
          <Link
            href="/admin/sentiment-monitoring"
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/sentiment-monitoring" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Image src="/icons/ai-sentiment.svg" alt="Sentiment Monitor" width={18} height={18} className="object-contain" /> Sentiment Monitor
          </Link>
          <Link
            href="/admin/feedback"
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/feedback" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Image src="/icons/mood.svg" alt="Feedback" width={18} height={18} className="object-contain" /> Feedback
          </Link>
        </div>
      </div>

      {/* SUPPORT Section */}
      <div className="mb-6">
        <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">Support</p>
        <div className="space-y-1">
          <Link
            href="/admin/support"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/support" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Image src="/icons/crisis-support.svg" alt="Support Chat" width={20} height={20} className="object-contain" /> Support Chat
          </Link>
        </div>
      </div>

      {/* SAFETY Section */}
      <div className="mb-6">
        <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">Safety</p>
        <div className="space-y-1">
          <Link
            href="/admin/distress-alerts"
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/distress-alerts" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Image src="/icons/crisis-support.svg" alt="Distress Alerts" width={18} height={18} className="object-contain" /> Distress Alerts
            {distressAlertCount > 0 && (
              <span className="ml-auto bg-[#F4A6A6] text-[#1E293B] text-[10px] px-2 py-0.5 rounded-full font-bold">
                {distressAlertCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* SYSTEM Section */}
      <div className="mb-6">
        <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">System</p>
        <div className="space-y-1">
          <Link
            href="/admin/system-settings"
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/system-settings" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Image src="/icons/settings.svg" alt="Settings" width={18} height={18} className="object-contain filter invert brightness-200" /> Settings
          </Link>
          <Link
            href="/admin/audit-logs"
            className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
              pathname === "/admin/audit-logs" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Image src="/icons/data-export.svg" alt="Audit Logs" width={18} height={18} className="object-contain" /> Audit Logs
          </Link>
        </div>
      </div>

      <div className="mt-auto">
        <div className="p-4 bg-white/5 rounded-xl border border-white/10 mb-3">
          <div className="flex items-center gap-3 mb-2">
              {userProfile?.avatar_url ? (
              <Image
                src={userProfile.avatar_url}
                alt="Profile"
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] rounded-full flex items-center justify-center text-[#1E293B] font-bold font-poppins text-sm">
                {getInitials()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-poppins text-white leading-tight">{getDisplayName()}</p>
              <p className="text-[11px] text-white/50 font-poppins leading-snug">
                {roleLabel}
              </p>
            </div>
          </div>
        </div>
        <form action="/api/auth/signout" method="post">
          <Button variant="secondary" className="w-full flex items-center justify-center gap-2 bg-white/10 text-white border-white/20 hover:bg-white/20">
            <Image src="/icons/logout.svg" alt="Log Out" width={20} height={20} className="object-contain" />
            Log Out
          </Button>
        </form>
      </div>
    </aside>
  );
}
