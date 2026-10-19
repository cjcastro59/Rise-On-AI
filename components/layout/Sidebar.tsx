"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import ProfileCard from "@/components/layout/ProfileCard";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useConfirmation } from "@/components/layout/ConfirmationModalProvider";
import {
  addNotification,
  checkDailyReminderAndNotify,
  checkEmotionalStatusAndNotify,
} from "@/lib/notifications";

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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useMemo(() => createClient() as any, []);
  const { openConfirmation } = useConfirmation();
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
      .select("avatar_url, role, mood_reminder_enabled, mood_reminder_time")
      .eq("id", user.id)
      .single()
      .then(({ data }: any) => {
        if (!data) return;
        setAvatarUrl(data.avatar_url);
        setUserRole(data.role);

        // Check daily reminder
        checkDailyReminderAndNotify(
          user.id,
          data.mood_reminder_enabled ?? true,
          data.mood_reminder_time || "20:00"
        );
      });

    // Check latest journal entry for emotional distress / negative trend
    supabase
      .from("journal_entries")
      .select("sentiment, mood, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }: any) => {
        if (data && data.length > 0) {
          checkEmotionalStatusAndNotify(user.id, data);
        }
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
        addNotification(user.id, {
          type: "message",
          title: `New message from ${role} ${name}`,
          message: "You received a new message in Support.",
          href: "/support",
        });
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
    ? (userRole.toLowerCase() === "user" ? "Member" : userRole.charAt(0).toUpperCase() + userRole.slice(1))
    : "Member";

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

  const desktopNavLink = (
    href: string,
    label: string,
    icon: string,
    active: boolean,
    badge?: number,
    iconClass = "",
    collapsed = false
  ) => (
    <Link
      href={href}
      prefetch={false}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 px-2 py-1 rounded-lg text-sm font-poppins transition-all ${
        collapsed ? "justify-center" : ""
      } ${
        active ? "bg-[#A8DADC]/20 text-[#A8DADC]" : "text-white/70 hover:text-white hover:bg-white/5"
      }`}
    >
      <Image src={icon} alt={label} width={18} height={18} className={`object-contain shrink-0 ${iconClass}`} />
      {!collapsed && <span className="flex-1">{label}</span>}
      {!collapsed && !!badge && badge > 0 && (
        <span className="rounded-full bg-[#F4A6A6] px-1.5 py-0.5 text-[10px] font-bold text-[#1E293B]">
          {badge}
        </span>
      )}
      {collapsed && !!badge && badge > 0 && (
        <span className="absolute top-0 right-0 w-2 h-2 bg-[#F4A6A6] rounded-full" />
      )}
    </Link>
  );

  return (
    <>
      {/* Support toast — shown on all pages when a new message arrives */}
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

      {/*
        Desktop sidebar only (hidden on mobile).
        sticky + h-screen keeps it fixed while the main content scrolls.
        MobileNav is rendered in layout.tsx OUTSIDE this flex cell so it
        spans the full viewport width on mobile.
      */}
      <aside
        className={`bg-[#1E293B] text-white hidden md:flex md:h-screen md:flex-col md:overflow-y-auto shrink-0 sticky top-0 transition-all duration-300 ${
          isCollapsed ? "w-16 p-2" : "w-64 p-4"
        }`}
      >
        {/* Header: logo + collapse toggle */}
        <div className={`mb-6 flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
          {!isCollapsed && (
            <div>
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
          )}
          {isCollapsed && (
            <Image
              src="/logo/Without Text.png"
              alt="Rise On Logo"
              width={32}
              height={32}
              className="rounded-lg object-contain"
            />
          )}
          <div className={`flex items-center gap-1 ${isCollapsed ? "flex-col mt-2" : ""}`}>
            {!isCollapsed && user && <NotificationBell userId={user.id} className="text-white hover:text-white" />}
            <button
              onClick={() => setIsCollapsed((c) => !c)}
              className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isCollapsed
                  ? <><polyline points="9 18 15 12 9 6" /></>
                  : <><polyline points="15 18 9 12 15 6" /></>
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Notification bell when collapsed (below logo) */}
        {isCollapsed && user && (
          <div className="flex justify-center mb-3">
            <NotificationBell userId={user.id} className="text-white hover:text-white" />
          </div>
        )}

        {/* Nav sections */}
        <div className="mb-6">
          {!isCollapsed && <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">Main</p>}
          <div className="space-y-1">
            {desktopNavLink("/dashboard",       "Dashboard",    "/icons/dashboard.svg",    isActive("dashboard"),  undefined, "", isCollapsed)}
            {desktopNavLink("/journal",         "New Entry",    "/icons/new-entry.svg",    isActive("journal"),    undefined, "", isCollapsed)}
            {desktopNavLink("/journal/history", "My Journal",   "/icons/journal.svg",      isActive("history"),    undefined, "", isCollapsed)}
            {desktopNavLink("/insights",        "Mood Insights","/icons/mood-insights.svg",isActive("insights"),   undefined, "", isCollapsed)}
            {desktopNavLink("/mood-trends",     "Mood Trends",  "/icons/trends.svg",       isActive("mood-trends"),undefined, "", isCollapsed)}
            {desktopNavLink("/analysis",        "AI Reports",   "/icons/ai-reports.svg",   isActive("analysis"),  undefined, "", isCollapsed)}
          </div>
        </div>

        <div className="mb-6">
          {!isCollapsed && <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">Support</p>}
          <div className="space-y-1">
            {desktopNavLink("/support", "Support Center", "/icons/crisis-support.svg", isActive("support"), supportUnreadCount, "", isCollapsed)}
          </div>
        </div>

        <div className="mb-6">
          {!isCollapsed && <p className="text-xs font-poppins text-white/50 uppercase tracking-wider mb-3">System</p>}
          <div className="space-y-1">
            {desktopNavLink("/settings", "Settings", "/icons/settings.svg", isActive("settings"), undefined, "filter invert brightness-200", isCollapsed)}
          </div>
        </div>

        <div className="mt-auto">
          {!isCollapsed && <ProfileCard href="/profile" avatarUrl={avatarUrl} name={userName} role={roleLabel} />}
          {isCollapsed && (
            <Link href="/profile" className="flex justify-center mb-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                {userName.charAt(0).toUpperCase()}
              </div>
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className={`w-full flex items-center justify-center gap-2 mt-2 py-2 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all text-sm font-poppins ${isCollapsed ? "px-0" : ""}`}
          >
            <Image src="/icons/logout.svg" alt="Log Out" width={18} height={18} className="object-contain" />
            {!isCollapsed && "Log Out"}
          </button>
        </div>
      </aside>
    </>
  );
}
