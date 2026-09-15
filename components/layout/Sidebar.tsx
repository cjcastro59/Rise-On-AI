"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import ProfileCard from "@/components/layout/ProfileCard";
import MobileNav from "@/components/layout/MobileNav";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  userName: string;
  activePage?: "dashboard" | "journal" | "history" | "insights" | "analysis";
}

type UserProfileSummary = {
  avatar_url: string | null;
  role: string | null;
};

type SenderSummary = {
  full_name: string | null;
  username: string | null;
  role: string | null;
};

export default function Sidebar({ userName }: SidebarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const [supportToast, setSupportToast] = useState<string | null>(null);
  const pathname = usePathname();
  const { user } = useAuth();
  const supabase = useMemo(() => createClient() as any, []);
  const supportConversationIdsRef = useRef<Set<string>>(new Set());
  const supportToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive = (
    page:
      | "dashboard"
      | "journal"
      | "history"
      | "insights"
      | "analysis"
      | "profile"
      | "settings"
      | "support"
      | "mood-trends"
  ) => {
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
      case "mood-trends":
        return pathname === "/mood-trends";
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

  const showSupportToast = useCallback((message: string) => {
    if (pathname === "/support") return;
    if (supportToastTimerRef.current) clearTimeout(supportToastTimerRef.current);
    setSupportToast(message);
    supportToastTimerRef.current = setTimeout(() => setSupportToast(null), 5000);
  }, [pathname]);

  const loadSupportUnreadCount = useCallback(async () => {
    if (!user) {
      supportConversationIdsRef.current = new Set();
      setSupportUnreadCount(0);
      return;
    }

    const { data: conversations } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id);

    const conversationIds = (conversations || [])
      .map((conversation: { id: string }) => conversation.id)
      .filter(Boolean);

    supportConversationIdsRef.current = new Set(conversationIds);

    if (conversationIds.length === 0) {
      setSupportUnreadCount(0);
      return;
    }

    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
      .eq("is_read", false)
      .neq("sender_id", user.id);

    if (!error) {
      setSupportUnreadCount(count || 0);
    }
  }, [supabase, user]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("user_profiles")
      .select("avatar_url, role")
      .eq("id", user.id)
      .single()
      .then(({ data }: { data: UserProfileSummary | null }) => {
        if (!data) return;
        setAvatarUrl(data.avatar_url);
        setUserRole(data.role);
      });
  }, [supabase, user]);

  useEffect(() => {
    if (!user) return;
    void loadSupportUnreadCount();
  }, [loadSupportUnreadCount, pathname, user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`member-sidebar-notifications:${user.id}`);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "conversations",
        filter: `user_id=eq.${user.id}`,
      },
      () => void loadSupportUnreadCount()
    );

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
      },
      async (payload: any) => {
        const message = payload.new as {
          conversation_id: string;
          sender_id: string;
          is_read: boolean;
        };

        if (
          message.sender_id === user.id ||
          message.is_read ||
          !supportConversationIdsRef.current.has(message.conversation_id)
        ) {
          return;
        }

        setSupportUnreadCount((count) => count + 1);

        const { data: sender } = await supabase
          .from("user_profiles")
          .select("full_name,username,role")
          .eq("id", message.sender_id)
          .maybeSingle();

        const senderProfile = sender as SenderSummary | null;
        const role =
          senderProfile?.role === "owner"
            ? "Owner"
            : senderProfile?.role === "admin"
              ? "Admin"
              : senderProfile?.role === "counselor"
                ? "Counselor"
                : "Support";
        const name = senderProfile?.full_name || senderProfile?.username || "Support";
        showSupportToast(`${role} ${name} sent you a message.`);
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSupportUnreadCount, showSupportToast, supabase, user]);

  useEffect(() => {
    return () => {
      if (supportToastTimerRef.current) clearTimeout(supportToastTimerRef.current);
    };
  }, []);

  const roleLabel = userRole
    ? userRole.charAt(0).toUpperCase() + userRole.slice(1)
    : "User";

  const desktopNavLink = (
    href: string,
    label: string,
    icon: string,
    active: boolean,
    badge?: number,
    iconClass = ""
  ) => (
    <Link
      href={href}
      className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
        active ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
      }`}
    >
      <Image src={icon} alt={label} width={18} height={18} className={`object-contain ${iconClass}`} />
      <span className="flex-1">{label}</span>
      {!!badge && badge > 0 && (
        <span className="rounded-full bg-[#F4A6A6] px-1.5 py-0.5 text-[10px] font-bold text-[#1E293B]">
          {badge}
        </span>
      )}
    </Link>
  );

  return (
    <>
      {supportToast && (
        <div className="fixed right-4 top-4 z-50 w-[min(340px,calc(100vw-2rem))] rounded-xl border border-success-green/30 bg-white p-4 text-dark-text shadow-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-success-green/15 text-sm font-bold text-success-green">
              !
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold font-poppins">New support message</p>
              <p className="mt-1 text-xs font-inter text-dark-text/70">{supportToast}</p>
            </div>
            <button
              type="button"
              className="text-sm text-dark-text/40 hover:text-dark-text"
              onClick={() => setSupportToast(null)}
            >
              x
            </button>
          </div>
        </div>
      )}

      <MobileNav
        panelLabel="Member Panel"
        sections={[
          {
            label: "Main",
            items: [
              { href: "/dashboard", label: "Dashboard", icon: "/icons/dashboard.svg", iconAlt: "Dashboard" },
              { href: "/journal", label: "New Entry", icon: "/icons/new-entry.svg", iconAlt: "New Entry" },
              { href: "/journal/history", label: "My Journal", icon: "/icons/journal.svg", iconAlt: "My Journal" },
              { href: "/insights", label: "Mood Insights", icon: "/icons/mood-insights.svg", iconAlt: "Mood Insights" },
              { href: "/mood-trends", label: "Mood Trends", icon: "/icons/trends.svg", iconAlt: "Mood Trends" },
              { href: "/analysis", label: "AI Reports", icon: "/icons/ai-reports.svg", iconAlt: "AI Reports" },
            ],
          },
          {
            label: "Support",
            items: [
              {
                href: "/support",
                label: "Support Center",
                icon: "/icons/crisis-support.svg",
                iconAlt: "Support",
                badge: supportUnreadCount,
              },
            ],
          },
          {
            label: "System",
            items: [
              {
                href: "/settings",
                label: "Settings",
                icon: "/icons/settings.svg",
                iconAlt: "Settings",
                iconClass: "filter invert brightness-200",
              },
            ],
          },
        ]}
        bottomItems={
          <>
            <ProfileCard href="/profile" avatarUrl={avatarUrl} name={userName} role={roleLabel} />
            <Link
              href="/support"
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F4A6A6]/15 text-[#F4A6A6] text-sm font-poppins font-semibold border border-[#F4A6A6]/20 hover:bg-[#F4A6A6]/25 transition-all"
            >
              <Image src="/icons/crisis-report.svg" alt="Get Help Now" width={16} height={16} className="object-contain" />
              <span className="flex-1">Get Help Now</span>
              {supportUnreadCount > 0 && (
                <span className="rounded-full bg-[#F4A6A6] px-1.5 py-0.5 text-[10px] font-bold text-[#1E293B]">
                  {supportUnreadCount}
                </span>
              )}
            </Link>
            <form action="/api/auth/signout" method="post">
              <Button variant="secondary" className="w-full flex items-center justify-center gap-2 py-2 bg-white/10 text-white border-white/20 hover:bg-white/20">
                <Image src="/icons/logout.svg" alt="Log Out" width={18} height={18} className="object-contain" />
                Log Out
              </Button>
            </form>
          </>
        }
      />

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
            {desktopNavLink("/dashboard", "Dashboard", "/icons/dashboard.svg", isActive("dashboard"))}
            {desktopNavLink("/journal", "New Entry", "/icons/new-entry.svg", isActive("journal"))}
            {desktopNavLink("/journal/history", "My Journal", "/icons/journal.svg", isActive("history"))}
            {desktopNavLink("/insights", "Mood Insights", "/icons/mood-insights.svg", isActive("insights"))}
            {desktopNavLink("/mood-trends", "Mood Trends", "/icons/trends.svg", isActive("mood-trends"))}
            {desktopNavLink("/analysis", "AI Reports", "/icons/ai-reports.svg", isActive("analysis"))}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">Support</p>
          <div className="space-y-1">
            {desktopNavLink(
              "/support",
              "Support Center",
              "/icons/crisis-support.svg",
              isActive("support"),
              supportUnreadCount
            )}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">System</p>
          <div className="space-y-1">
            {desktopNavLink(
              "/settings",
              "Settings",
              "/icons/settings.svg",
              isActive("settings"),
              undefined,
              "filter invert brightness-200"
            )}
          </div>
        </div>

        <div className="mt-auto">
          <ProfileCard href="/profile" avatarUrl={avatarUrl} name={userName} role={roleLabel} />
          <Link
            href="/support"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F4A6A6]/15 text-[#F4A6A6] text-sm font-poppins font-semibold border border-[#F4A6A6]/20 hover:bg-[#F4A6A6]/25 transition-all duration-200"
          >
            <Image src="/icons/crisis-report.svg" alt="Get Help Now" width={16} height={16} className="object-contain" />
            <span className="flex-1">Get Help Now</span>
            {supportUnreadCount > 0 && (
              <span className="rounded-full bg-[#F4A6A6] px-1.5 py-0.5 text-[10px] font-bold text-[#1E293B]">
                {supportUnreadCount}
              </span>
            )}
          </Link>
          <form action="/api/auth/signout" method="post">
            <Button variant="secondary" className="w-full flex items-center justify-center gap-2 mt-2 py-2 bg-white/10 text-white border-white/20 hover:bg-white/20">
              <Image src="/icons/logout.svg" alt="Log Out" width={18} height={18} className="object-contain" />
              Log Out
            </Button>
          </form>
        </div>
      </aside>
    </>
  );
}
