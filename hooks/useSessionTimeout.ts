"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type SessionTimeoutPhase =
  | "active"       // user is active — no modal shown
  | "warning"      // 1 minute remaining — warning modal shown
  | "timedout";    // time is up — signed-out modal shown

interface UseSessionTimeoutOptions {
  /** Total inactivity timeout in milliseconds. Default: 3 minutes */
  timeoutMs?: number;
  /** How many ms before timeout to show the warning modal. Default: 1 minute */
  warningMs?: number;
  /** Called after the session is signed out */
  onSignOut?: () => void;
}

const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000;  // 3 minutes
const DEFAULT_WARNING_MS = 1 * 60 * 1000;  // warn 1 minute before timeout

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
];

export function useSessionTimeout({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  warningMs = DEFAULT_WARNING_MS,
  onSignOut,
}: UseSessionTimeoutOptions = {}) {
  const [phase, setPhase] = useState<SessionTimeoutPhase>("active");
  const [secondsLeft, setSecondsLeft] = useState<number>(Math.floor(timeoutMs / 1000));

  const lastActivityRef  = useRef<number>(Date.now());
  const warningTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signoutTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef     = useRef(true);
  const supabaseRef      = useRef(createClient());

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current)  clearTimeout(warningTimerRef.current);
    if (signoutTimerRef.current)  clearTimeout(signoutTimerRef.current);
    if (countdownRef.current)     clearInterval(countdownRef.current);
    warningTimerRef.current = null;
    signoutTimerRef.current = null;
    countdownRef.current    = null;
  }, []);

  const performSignOut = useCallback(async () => {
    clearAllTimers();
    if (!isMountedRef.current) return;
    setPhase("timedout");
    try {
      await supabaseRef.current.auth.signOut();
    } catch {
      // ignore — session may already be gone
    }
    onSignOut?.();
  }, [clearAllTimers, onSignOut]);

  const startTimers = useCallback(() => {
    clearAllTimers();
    if (!isMountedRef.current) return;

    const now = Date.now();
    lastActivityRef.current = now;
    setPhase("active");
    setSecondsLeft(Math.floor(timeoutMs / 1000));

    const warnAt   = timeoutMs - warningMs;   // when to show warning
    const signOutAt = timeoutMs;               // when to sign out

    // Show warning modal
    warningTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      setPhase("warning");
      setSecondsLeft(Math.floor(warningMs / 1000));

      // Start countdown in warning phase
      countdownRef.current = setInterval(() => {
        if (!isMountedRef.current) return;
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, warnAt);

    // Sign out when time is up
    signoutTimerRef.current = setTimeout(() => {
      performSignOut();
    }, signOutAt);
  }, [clearAllTimers, performSignOut, timeoutMs, warningMs]);

  // Reset timers on user activity — but only if NOT already in warning/timedout phase
  const handleActivity = useCallback(() => {
    setPhase((current) => {
      if (current === "active") {
        startTimers();
      }
      return current;
    });
  }, [startTimers]);

  // "Stay logged in" — user dismissed the warning modal
  const stayLoggedIn = useCallback(() => {
    startTimers();
  }, [startTimers]);

  // Manual sign-out from modal
  const signOut = useCallback(async () => {
    await performSignOut();
  }, [performSignOut]);

  // Mount: attach listeners + start timers
  useEffect(() => {
    isMountedRef.current = true;
    startTimers();

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true })
    );

    return () => {
      isMountedRef.current = false;
      clearAllTimers();
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMs, warningMs]); // re-run only when timeout config changes

  return { phase, secondsLeft, stayLoggedIn, signOut };
}
