"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type StaffRole = "admin" | "owner" | "counselor";

type AnnouncementPayload = {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
};

const STAFF_ROLES = new Set<StaffRole>(["admin", "owner", "counselor"]);

export default function StaffAnnouncementToast() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient() as any, []);
  const [role, setRole] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<AnnouncementPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showAnnouncement = useCallback((nextAnnouncement: AnnouncementPayload) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setAnnouncement(nextAnnouncement);
    timerRef.current = setTimeout(() => setAnnouncement(null), 6500);
  }, []);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }: { data: { role: string | null } | null }) => {
        setRole(data?.role || null);
      });
  }, [supabase, user]);

  useEffect(() => {
    if (!user || !role || !STAFF_ROLES.has(role as StaffRole)) return;

    const channel = supabase.channel(`staff-announcements:${user.id}`);
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "announcements" },
      (payload: any) => {
        const nextAnnouncement = payload.new as AnnouncementPayload;
        if (!nextAnnouncement.is_active) return;
        showAnnouncement(nextAnnouncement);
      }
    );

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, showAnnouncement, supabase, user]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!announcement) return null;

  return (
    <div className="fixed right-4 top-4 z-50 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-primary-blue/20 bg-white p-4 text-dark-text shadow-xl">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary-blue/15 text-sm font-bold text-primary-blue">
          !
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold font-poppins">New announcement</p>
          <p className="mt-1 text-xs font-semibold font-poppins text-dark-text">{announcement.title}</p>
          <p className="mt-1 line-clamp-2 text-xs font-inter text-dark-text/70">{announcement.content}</p>
        </div>
        <button
          type="button"
          className="text-sm text-dark-text/40 hover:text-dark-text"
          onClick={() => setAnnouncement(null)}
        >
          x
        </button>
      </div>
    </div>
  );
}
