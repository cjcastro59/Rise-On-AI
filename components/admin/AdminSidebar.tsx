"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import ProfileCard from "@/components/layout/ProfileCard";
import MobileNav from "@/components/layout/MobileNav";
import { useAuth } from "@/hooks/useAuth";
import NotificationBell from "@/components/notifications/NotificationBell";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useConfirmation } from "@/components/layout/ConfirmationModalProvider";

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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { openConfirmation } = useConfirmation();

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
    const interval = setInterval(fetchSidebarData, 120_000);
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

  const roleLabel = userProfile?.role
    ? userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)
    : "User";

  const handleLogout = async () => {
    const confirmed = await openConfirmation({
      title: "Sign Out",
      message: "Are you sure you want to sign out?",
      confirmText: "Sign Out",
      cancelText: "Stay",
      isDangerous: false,
    });
    if (!confirmed) return;
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <>
      {/* ── Mobile navigation drawer ────────────────────────────────────── */}
      <MobileNav
        panelLabel="Admin Panel"
        headerActions={currentUser ? <NotificationBell userId={currentUser.id} className="text-white" /> : null}
        sections={[
          {
            label: "Main",
            items: [
              { href: "/admin/dashboard", label: "Dashboard",        icon: "/icons/dashboard.svg",   iconAlt: "Dashboard" },
              { href: "/admin/users",     label: "User Management",  icon: "/icons/account.svg",     iconAlt: "Users" },
            ],
          },
          {
            label: "Analytics",
            items: [
              { href: "/admin/journal-monitor",      label: "Journal Monitor",   icon: "/icons/journal.svg",       iconAlt: "Journal Monitor" },
              { href: "/admin/mood-trends",          label: "Mood Reports",      icon: "/icons/trends.svg",        iconAlt: "Mood Reports" },
              { href: "/admin/sentiment-monitoring", label: "Sentiment Monitor", icon: "/icons/ai-sentiment.svg",  iconAlt: "Sentiment Monitor" },
            ],
          },
          {
            label: "Support",
            items: [
              { href: "/admin/support", label: "Support Chat", icon: "/icons/crisis-support.svg", iconAlt: "Support Chat" },
            ],
          },
          {
            label: "Safety",
            items: [
              { href: "/admin/distress-alerts", label: "Distress Alerts", icon: "/icons/crisis-support.svg", iconAlt: "Distress Alerts", badge: distressAlertCount },
            ],
          },
          {
            label: "System",
            items: [
              { href: "/admin/system-settings", label: "Settings",   icon: "/icons/settings.svg",     iconAlt: "Settings",   iconClass: "filter invert brightness-200" },
              { href: "/admin/audit-logs",       label: "Audit Logs", icon: "/icons/data-export.svg",  iconAlt: "Audit Logs" },
            ],
          },
        ]}
        bottomItems={
          <>
            <ProfileCard
              href="/admin/profile"
              avatarUrl={userProfile?.avatar_url}
              name={getDisplayName()}
              role={roleLabel}
            />
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all text-sm font-poppins font-semibold"
            >
              <Image src="/icons/logout.svg" alt="Log Out" width={16} height={16} className="object-contain" />
              Log Out
            </button>
          </>
        }
      />

      {/* ── Desktop sidebar (hidden on mobile) ──────────────────────────── */}
      <aside className={`bg-[#1E293B] text-white hidden md:flex md:h-screen md:flex-col md:overflow-y-auto shrink-0 transition-all duration-300 ${isCollapsed ? "w-16 p-2" : "w-64 p-4"}`}>
      <div className={`mb-4 flex items-center ${isCollapsed ? "justify-center flex-col gap-2" : "justify-between"}`}>
        {!isCollapsed && (
          <div>
            <div className="flex items-center gap-3">
              <Image src="/logo/Without Text.png" alt="Rise On AI Logo" width={32} height={32} className="rounded-lg" />
              <h2 className="text-base font-poppins font-semibold">Rise On</h2>
            </div>
            <p className="text-xs text-white/50 font-poppins mt-1">Admin Panel</p>
          </div>
        )}
        {isCollapsed && (
          <Image src="/logo/Without Text.png" alt="Rise On AI Logo" width={28} height={28} className="rounded-lg" />
        )}
        <div className="flex items-center gap-1">
          {!isCollapsed && currentUser && <NotificationBell userId={currentUser.id} className="text-white hover:text-white" />}
          <button
            onClick={() => setIsCollapsed((c) => !c)}
            className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isCollapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
            </svg>
          </button>
        </div>
      </div>

      {isCollapsed && currentUser && (
        <div className="flex justify-center mb-3">
          <NotificationBell userId={currentUser.id} className="text-white hover:text-white" />
        </div>
      )}

      <nav className="min-h-0 flex-1">
        {/* MAIN Section */}
        <div className="mb-3">
          {!isCollapsed && <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-2">Main</p>}
          <div className="space-y-1">
            {[
              { href: "/admin/dashboard", label: "Dashboard",       icon: "/icons/dashboard.svg" },
              { href: "/admin/users",     label: "User Management", icon: "/icons/account.svg" },
            ].map(({ href, label, icon }) => (
              <Link key={href} href={href} title={isCollapsed ? label : undefined}
                className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-poppins transition-all ${isCollapsed ? "justify-center" : ""} ${pathname === href ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"}`}>
                <Image src={icon} alt={label} width={16} height={16} className="object-contain shrink-0" />
                {!isCollapsed && label}
              </Link>
            ))}
          </div>
        </div>

        {/* ANALYTICS Section */}
        <div className="mb-3">
          {!isCollapsed && <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-2">Analytics</p>}
          <div className="space-y-1">
            {[
              { href: "/admin/journal-monitor",      label: "Journal Monitor",   icon: "/icons/journal.svg" },
              { href: "/admin/mood-trends",          label: "Mood Reports",      icon: "/icons/trends.svg" },
              { href: "/admin/sentiment-monitoring", label: "Sentiment Monitor", icon: "/icons/ai-sentiment.svg" },
            ].map(({ href, label, icon }) => (
              <Link key={href} href={href} title={isCollapsed ? label : undefined}
                className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-poppins transition-all ${isCollapsed ? "justify-center" : ""} ${pathname === href ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"}`}>
                <Image src={icon} alt={label} width={16} height={16} className="object-contain shrink-0" />
                {!isCollapsed && label}
              </Link>
            ))}
          </div>
        </div>

        {/* SUPPORT Section */}
        <div className="mb-3">
          {!isCollapsed && <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-2">Support</p>}
          <div className="space-y-1">
            <Link href="/admin/support" title={isCollapsed ? "Support Chat" : undefined}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-poppins transition-all ${isCollapsed ? "justify-center" : ""} ${pathname === "/admin/support" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"}`}>
              <Image src="/icons/crisis-support.svg" alt="Support Chat" width={16} height={16} className="object-contain shrink-0" />
              {!isCollapsed && "Support Chat"}
            </Link>
          </div>
        </div>

        {/* SAFETY Section */}
        <div className="mb-3">
          {!isCollapsed && <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-2">Safety</p>}
          <div className="space-y-1">
            <Link href="/admin/distress-alerts" title={isCollapsed ? "Distress Alerts" : undefined}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-poppins transition-all ${isCollapsed ? "justify-center" : ""} ${pathname === "/admin/distress-alerts" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"}`}>
              <Image src="/icons/crisis-support.svg" alt="Distress Alerts" width={16} height={16} className="object-contain shrink-0" />
              {!isCollapsed && "Distress Alerts"}
              {!isCollapsed && distressAlertCount > 0 && (
                <span className="ml-auto bg-[#F4A6A6] text-[#1E293B] text-xs px-1.5 py-0.5 rounded-full font-bold">{distressAlertCount}</span>
              )}
            </Link>
          </div>
        </div>

        {/* SYSTEM Section */}
        <div className="mb-3">
          {!isCollapsed && <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-2">System</p>}
          <div className="space-y-1">
            {[
              { href: "/admin/system-settings", label: "Settings",   icon: "/icons/settings.svg",    iconClass: "filter invert brightness-200" },
              { href: "/admin/audit-logs",       label: "Audit Logs", icon: "/icons/data-export.svg", iconClass: "" },
            ].map(({ href, label, icon, iconClass }) => (
              <Link key={href} href={href} title={isCollapsed ? label : undefined}
                className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-poppins transition-all ${isCollapsed ? "justify-center" : ""} ${pathname === href ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"}`}>
                <Image src={icon} alt={label} width={16} height={16} className={`object-contain shrink-0 ${iconClass}`} />
                {!isCollapsed && label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="shrink-0 pt-2">
        {!isCollapsed && (
          <ProfileCard href="/admin/profile" avatarUrl={userProfile?.avatar_url} name={getDisplayName()} role={roleLabel} />
        )}
        {isCollapsed && (
          <Link href="/admin/profile" className="flex justify-center mb-2" title={getDisplayName()}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              {getDisplayName().charAt(0).toUpperCase()}
            </div>
          </Link>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all text-sm font-poppins font-semibold ${isCollapsed ? "px-0" : ""}`}
        >
          <Image src="/icons/logout.svg" alt="Log Out" width={16} height={16} className="object-contain" />
          {!isCollapsed && "Log Out"}
        </button>
      </div>
    </aside>
    </>
  );
}
