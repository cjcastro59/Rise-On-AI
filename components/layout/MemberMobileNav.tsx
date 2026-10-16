"use client";

/**
 * MemberMobileNav
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the mobile-only sticky top bar + slide-in drawer for the member
 * (protected) panel.
 *
 * This is intentionally a SEPARATE component from Sidebar so it can be placed
 * OUTSIDE the sidebar's flex cell in layout.tsx — that way the sticky header
 * always spans the full viewport width on mobile.
 *
 * On desktop (≥ md) this renders nothing; the desktop <aside> inside Sidebar
 * handles navigation.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import ProfileCard from "@/components/layout/ProfileCard";
import MobileNav from "@/components/layout/MobileNav";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type UserProfileSummary = { avatar_url: string | null; role: string | null };
type SenderSummary = {
  full_name: string | null;
  username: string | null;
  role: string | null;
};

interface MemberMobileNavProps {
  userName: string;
}

import NotificationBell from "@/components/notifications/NotificationBell";

export default function MemberMobileNav({ userName }: MemberMobileNavProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient() as any, []);
  const supportConversationIdsRef = useRef<Set<string>>(new Set());

  /* ── load avatar + role ─────────────────────────────────────────────────── */
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

  /* ── unread support badge ───────────────────────────────────────────────── */
  const loadSupportUnreadCount = useCallback(async () => {
    if (!user) { setSupportUnreadCount(0); return; }

    const { data: conversations } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id);

    const ids = (conversations || [])
      .map((c: { id: string }) => c.id)
      .filter(Boolean);

    supportConversationIdsRef.current = new Set(ids);

    if (ids.length === 0) { setSupportUnreadCount(0); return; }

    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", ids)
      .eq("is_read", false)
      .neq("sender_id", user.id);

    if (!error) setSupportUnreadCount(count || 0);
  }, [supabase, user]);

  useEffect(() => {
    if (!user) return;
    void loadSupportUnreadCount();
  }, [loadSupportUnreadCount, user]);

  /* ── realtime new-message listener ─────────────────────────────────────── */
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`member-mobile-nav-notifications:${user.id}`);

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations", filter: `user_id=eq.${user.id}` },
      () => void loadSupportUnreadCount()
    );

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      async (payload: any) => {
        const msg = payload.new as { conversation_id: string; sender_id: string; is_read: boolean };
        if (
          msg.sender_id === user.id ||
          msg.is_read ||
          !supportConversationIdsRef.current.has(msg.conversation_id)
        ) return;

        setSupportUnreadCount((c) => c + 1);
      }
    );

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadSupportUnreadCount, supabase, user]);

  const roleLabel = userRole
    ? (userRole.toLowerCase() === "user" ? "Member" : userRole.charAt(0).toUpperCase() + userRole.slice(1))
    : "Member";

  return (
    <MobileNav
      panelLabel="Member Panel"
      headerActions={user ? <NotificationBell userId={user.id} className="text-white" /> : null}
      sections={[
        {
          label: "Main",
          items: [
            { href: "/dashboard",        label: "Dashboard",    icon: "/icons/dashboard.svg",     iconAlt: "Dashboard" },
            { href: "/journal",          label: "New Entry",    icon: "/icons/new-entry.svg",      iconAlt: "New Entry" },
            { href: "/journal/history",  label: "My Journal",   icon: "/icons/journal.svg",        iconAlt: "My Journal" },
            { href: "/insights",         label: "Mood Insights",icon: "/icons/mood-insights.svg",  iconAlt: "Mood Insights" },
            { href: "/mood-trends",      label: "Mood Trends",  icon: "/icons/trends.svg",         iconAlt: "Mood Trends" },
            { href: "/analysis",         label: "AI Reports",   icon: "/icons/ai-reports.svg",     iconAlt: "AI Reports" },
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
          <form action="/api/auth/signout" method="post">
            <Button
              variant="secondary"
              className="w-full flex items-center justify-center gap-2 py-2 bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              <Image src="/icons/logout.svg" alt="Log Out" width={18} height={18} className="object-contain" />
              Log Out
            </Button>
          </form>
        </>
      }
    />
  );
}
