"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import ProfileCard from "@/components/layout/ProfileCard";
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

export default function CounselorSidebar() {
    const pathname = usePathname();
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [distressAlertCount, setDistressAlertCount] = useState(0);
    const [isMounted, setIsMounted] = useState(false);
    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        const fetchSidebarData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const [profileResult, alertsResult] = await Promise.all([
                    supabase
                        .from("user_profiles")
                        .select("id, first_name, last_name, full_name, username, role, avatar_url")
                        .eq("id", user.id)
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
                console.error("Error fetching counselor sidebar data:", err);
            }
        };

        fetchSidebarData();
        const interval = setInterval(fetchSidebarData, 30_000);
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

    // Don't render until mounted to prevent hydration mismatch
    if (!isMounted) {
        return (
            <aside className="w-64 bg-[#1E293B] text-white p-6 hidden md:flex md:flex-col md:h-full md:min-h-screen">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-9 h-9 bg-gray-600 rounded-lg animate-pulse" />
                    <div className="h-6 w-24 bg-gray-600 rounded animate-pulse" />
                </div>
            </aside>
        );
    }

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
                <p className="text-xs text-white/50 font-poppins mt-1">Counselor Panel</p>
            </div>

            {/* MAIN Section */}
            <div className="mb-6">
                <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">Main</p>
                <div className="space-y-1">
                    <Link
                      href="/counselor/dashboard"
                      className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${pathname === "/counselor/dashboard" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"}`}
                    >
                      <Image src="/icons/dashboard.svg" alt="Dashboard" width={18} height={18} className="object-contain" /> Dashboard
                    </Link>
                    <Link
                      href="/counselor/cases"
                      className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${pathname === "/counselor/cases" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"}`}
                    >
                      <Image src="/icons/crisis-report.svg" alt="Cases" width={18} height={18} className="object-contain" /> Cases
                    </Link>
                    <Link
                      href="/counselor/assigned-users"
                      className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${pathname === "/counselor/assigned-users" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"}`}
                    >
                      <Image src="/icons/account.svg" alt="Assigned Users" width={18} height={18} className="object-contain" /> Assigned Users
                    </Link>
                  </div>
            </div>

            {/* SUPPORT Section */}
            <div className="mb-6">
                <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">Support</p>
                <div className="space-y-1">
                    <Link
                        href="/counselor/messages"
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-poppins transition-all ${pathname === "/counselor/messages" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        <Image src="/icons/crisis-support.svg" alt="Messages" width={20} height={20} className="object-contain" /> Messages
                    </Link>
                    <Link
                        href="/counselor/notes"
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-poppins transition-all ${pathname === "/counselor/notes" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        <Image src="/icons/journal.svg" alt="Notes" width={20} height={20} className="object-contain" /> Notes
                    </Link>
                </div>
            </div>

            {/* SYSTEM Section */}
            <div className="mb-6">
                <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">System</p>
                <div className="space-y-1">
                    <Link
                        href="/counselor/settings"
                        className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${pathname === "/counselor/settings" ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        <Image src="/icons/settings.svg" alt="Settings" width={18} height={18} className="object-contain filter invert brightness-200" /> Settings
                    </Link>
                </div>
            </div>

            <div className="mt-auto">
                <ProfileCard
                    href="/counselor/profile"
                    avatarUrl={userProfile?.avatar_url}
                    name={getDisplayName()}
                    role={roleLabel}
                />
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
