"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import SessionTimeoutModal from "@/components/layout/SessionTimeoutModal";

const DEFAULT_TIMEOUT_MINUTES = 3;
const DEFAULT_WARNING_MINUTES = 1;

function parseTimeoutSetting(value: unknown): { timeoutMs: number; warningMs: number } | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    const mins     = Number(parsed?.timeout_minutes);
    const warnMins = Number(parsed?.warning_minutes ?? DEFAULT_WARNING_MINUTES);
    if (!Number.isFinite(mins) || mins <= 0) return null;
    const safeWarn =
      Number.isFinite(warnMins) && warnMins > 0 && warnMins < mins
        ? warnMins
        : Math.max(1, Math.floor(mins / 3));
    return {
      timeoutMs: mins     * 60 * 1000,
      warningMs: safeWarn * 60 * 1000,
    };
  } catch {
    return null;
  }
}

export default function SessionTimeoutWrapper() {
  const [timeoutMs, setTimeoutMs] = useState<number | null>(null);
  const [warningMs, setWarningMs] = useState<number>(DEFAULT_WARNING_MINUTES * 60 * 1000);
  const supabase = useMemo(() => createClient(), []);

  const applyValue = useCallback((value: unknown) => {
    const result = parseTimeoutSetting(value);
    if (result) {
      setTimeoutMs(result.timeoutMs);
      setWarningMs(result.warningMs);
    } else {
      setTimeoutMs(DEFAULT_TIMEOUT_MINUTES * 60 * 1000);
      setWarningMs(DEFAULT_WARNING_MINUTES * 60 * 1000);
    }
  }, []);

  useEffect(() => {
    // 1. Initial fetch
    const load = async () => {
      try {
        const { data } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "session_timeout")
          .maybeSingle() as { data: { value: unknown } | null };
        applyValue(data?.value ?? null);
      } catch {
        applyValue(null);
      }
    };
    load();

    // 2. Realtime subscription — picks up changes the owner saves instantly
    //    across ALL open browser sessions for every role.
    const channel = supabase
      .channel("session-timeout-settings")
      .on(
        "postgres_changes",
        {
          event:  "*",          // INSERT, UPDATE, DELETE
          schema: "public",
          table:  "system_settings",
          filter: "key=eq.session_timeout",
        },
        (payload: { new?: { value?: unknown } | null; old?: unknown }) => {
          // payload.new contains the updated row on INSERT/UPDATE
          // payload.old on DELETE → revert to defaults
          const newValue = (payload.new as { value?: unknown } | null)?.value ?? null;
          applyValue(newValue);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, applyValue]);

  const { phase, secondsLeft, stayLoggedIn, signOut } = useSessionTimeout({
    timeoutMs:  timeoutMs ?? DEFAULT_TIMEOUT_MINUTES * 60 * 1000,
    warningMs,
    // No onSignOut callback here — the redirect is handled by the modal
    // "Go to Login" button, so the user always sees the "Session Expired"
    // screen before being sent to /login.
  });

  // Don't render until setting is loaded for the first time
  if (timeoutMs === null) return null;

  return (
    <SessionTimeoutModal
      phase={phase}
      secondsLeft={secondsLeft}
      onStayLoggedIn={stayLoggedIn}
      onSignOut={signOut}
    />
  );
}
