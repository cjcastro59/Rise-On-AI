"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import ProfileCard from "@/components/layout/ProfileCard";
import MobileNav from "@/components/layout/MobileNav";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import NotificationBell from "@/components/notifications/NotificationBell";
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

export default function CounselorSidebar() {
    const pathname = usePathname();
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [distressAlertCount, setDistressAlertCount] = useState(0);
    const [isMounted, setIsMounted] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    const { openConfirmation } = useConfirmation();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        const fetchSidebarData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Get counselor's assigned user IDs first
                const { data: assignedIds } = await supabase
                    .from("user_profiles")
                    .select("id")
                    .eq("assigned_counselor_id", user.id)
                    .eq("role", "user");

                const assignedUserIds = (assignedIds || []).map((u: any) => u.id);

                const [profileResult, alertsResult] = await Promise.all([
                    supabase
                        .from("user_profiles")
                        .select("id, first_name, last_name, full_name, username, role, avatar_url")
                        .eq("id", user.id)
                        .single(),
                    assignedUserIds.length > 0
                        ? supabase
                            .from("distress_logs")
                            .select("id", { count: "exact", head: true })
                            .in("user_id", assignedUserIds)
                        : Promise.resolve({ count: 0, error: null }),
                ]);

                if (!profileResult.error && profileResult.data) {
                    setUserProfile(profileResult.data);
                }

                if (!alertsResult.error) {
                    setDistressAlertCount(alertsResult.count || 0);
                }
            } catch (err) {
                console.error("Error fetching counselor sidebar data:", err);
            }
        };

        fetchSidebarData();
        const interval = setInterval(fetchSidebarData, 120_000);
        return () => clearInterval(interval);
    }, [supabase, isMounted]);

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

    // Don't render until mounted to prevent hydration mismatch
    if (!isMounted) {
        return (
            <>
              {/* Mobile top bar skeleton */}
              <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-[#1E293B] text-white shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-gray-600 rounded-lg animate-pulse" />
                  <div className="h-4 w-20 bg-gray-600 rounded animate-pulse" />
                </div>
              </header>
              {/* Desktop sidebar skeleton */}
              <aside className="w-64 bg-[#1E293B] text-white p-6 hidden md:flex md:flex-col md:h-full md:min-h-screen">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-9 h-9 bg-gray-600 rounded-lg animate-pulse" />
                    <div className="h-6 w-24 bg-gray-600 rounded animate-pulse" />
                </div>
              </aside>
            </>
        );
    }

    return (
        <>
          {/* ── Mobile navigation drawer ──────────────────────────────────── */}
          <MobileNav
            panelLabel="Counselor Panel"
            headerActions={userProfile ? <NotificationBell userId={userProfile.id} className="text-white" /> : null}
            sections={[
              {
                label: "Main",
                items: [
                  { href: "/counselor/dashboard",       label: "Dashboard",      icon: "/icons/dashboard.svg",    iconAlt: "Dashboard" },
                  { href: "/counselor/cases",            label: "Cases",          icon: "/icons/crisis-report.svg",iconAlt: "Cases", badge: distressAlertCount },
                  { href: "/counselor/assigned-users",   label: "Assigned Users", icon: "/icons/account.svg",      iconAlt: "Assigned Users" },
                ],
              },
              {
                label: "Support",
                items: [
                  { href: "/counselor/messages", label: "Messages", icon: "/icons/crisis-support.svg", iconAlt: "Messages" },
                  { href: "/counselor/notes",    label: "Notes",    icon: "/icons/journal.svg",        iconAlt: "Notes" },
                ],
              },
              {
                label: "System",
                items: [
                  { href: "/counselor/settings", label: "Settings", icon: "/icons/settings.svg", iconAlt: "Settings", iconClass: "filter invert brightness-200" },
                ],
              },
            ]}
            bottomItems={
              <>
                <ProfileCard
                  href="/counselor/profile"
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

          {/* ── Desktop sidebar (hidden on mobile) ────────────────────────── */}
          <aside className={`bg-[#1E293B] text-white hidden md:flex md:h-screen md:flex-col md:overflow-y-auto shrink-0 transition-all duration-300 ${isCollapsed ? "w-16 p-2" : "w-64 p-4"}`}>
            <div className={`mb-6 flex items-center ${isCollapsed ? "justify-center flex-col gap-2" : "justify-between"}`}>
                {!isCollapsed && (
                  <div>
                    <div className="flex items-center gap-3">
                        <Image src="/logo/Without Text.png" alt="Rise On AI Logo" width={36} height={36} className="rounded-lg" />
                        <h2 className="text-lg font-poppins font-semibold">Rise On</h2>
                    </div>
                    <p className="text-xs text-white/50 font-poppins mt-1">Counselor Panel</p>
                  </div>
                )}
                {isCollapsed && (
                  <Image src="/logo/Without Text.png" alt="Rise On AI Logo" width={28} height={28} className="rounded-lg" />
                )}
                <div className="flex items-center gap-1">
                  {!isCollapsed && userProfile && <NotificationBell userId={userProfile.id} className="text-white hover:text-white" />}
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

            {isCollapsed && userProfile && (
              <div className="flex justify-center mb-3">
                <NotificationBell userId={userProfile.id} className="text-white hover:text-white" />
              </div>
            )}

            {/* MAIN Section */}
            <div className="mb-6">
                {!isCollapsed && <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">Main</p>}
                <div className="space-y-1">
                    {[
                      { href: "/counselor/dashboard",     label: "Dashboard",      icon: "/icons/dashboard.svg",     badge: 0 },
                      { href: "/counselor/cases",          label: "Cases",          icon: "/icons/crisis-report.svg", badge: distressAlertCount },
                      { href: "/counselor/assigned-users", label: "Assigned Users", icon: "/icons/account.svg",       badge: 0 },
                    ].map(({ href, label, icon, badge }) => (
                      <Link key={href} href={href} title={isCollapsed ? label : undefined}
                        className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${isCollapsed ? "justify-center" : ""} ${pathname === href ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"}`}>
                        <Image src={icon} alt={label} width={18} height={18} className="object-contain shrink-0" />
                        {!isCollapsed && label}
                        {!isCollapsed && badge > 0 && (
                          <span className="ml-auto bg-[#F4A6A6] text-[#1E293B] text-xs px-1.5 py-0.5 rounded-full font-bold">{badge}</span>
                        )}
                      </Link>
                    ))}
                  </div>
            </div>

            {/* SUPPORT Section */}
            <div className="mb-6">
                {!isCollapsed && <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">Support</p>}
                <div className="space-y-1">
                    {[
                      { href: "/counselor/messages", label: "Messages", icon: "/icons/crisis-support.svg" },
                      { href: "/counselor/notes",    label: "Notes",    icon: "/icons/journal.svg" },
                    ].map(({ href, label, icon }) => (
                      <Link key={href} href={href} title={isCollapsed ? label : undefined}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-poppins transition-all ${isCollapsed ? "justify-center px-0" : ""} ${pathname === href ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"}`}>
                        <Image src={icon} alt={label} width={20} height={20} className="object-contain shrink-0" />
                        {!isCollapsed && label}
                      </Link>
                    ))}
                </div>
            </div>

            {/* SYSTEM Section */}
            <div className="mb-6">
                {!isCollapsed && <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">System</p>}
                <div className="space-y-1">
                    <Link href="/counselor/settings" title={isCollapsed ? "Settings" : undefined}
                        className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${isCollapsed ? "justify-center" : ""} ${pathname === "/counselor/settings" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"}`}>
                        <Image src="/icons/settings.svg" alt="Settings" width={18} height={18} className="object-contain shrink-0 filter invert brightness-200" />
                        {!isCollapsed && "Settings"}
                    </Link>
                </div>
            </div>

            <div className="mt-auto">
                {!isCollapsed && (
                  <ProfileCard href="/counselor/profile" avatarUrl={userProfile?.avatar_url} name={getDisplayName()} role={roleLabel} />
                )}
                {isCollapsed && (
                  <Link href="/counselor/profile" className="flex justify-center mb-2" title={getDisplayName()}>
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
                    <Image src="/icons/logout.svg" alt="Log Out" width={20} height={20} className="object-contain" />
                    {!isCollapsed && "Log Out"}
                </button>
            </div>
        </aside>
    </>
    );
}
