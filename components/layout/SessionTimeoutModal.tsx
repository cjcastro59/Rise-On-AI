"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { type SessionTimeoutPhase } from "@/hooks/useSessionTimeout";

interface SessionTimeoutModalProps {
  phase: SessionTimeoutPhase;
  secondsLeft: number;
  onStayLoggedIn: () => void;
  onSignOut: () => Promise<void>;
}

export default function SessionTimeoutModal({
  phase,
  secondsLeft,
  onStayLoggedIn,
  onSignOut,
}: SessionTimeoutModalProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [signingOut, setSigningOut]   = useState(false);
  const router = useRouter();

  if (phase === "active") return null;

  const handleSignOut = async () => {
    setSigningOut(true);
    await onSignOut();
    router.replace("/login");
  };

  // ── Signed-out modal (session already terminated) ─────────────────────────
  if (phase === "timedout") {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-dark-text/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 bg-warning-yellow/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⏱️</span>
          </div>
          <h2 className="text-xl font-dm-serif text-dark-text mb-2">Session Expired</h2>
          <p className="text-sm font-inter text-dark-text/70 mb-6 leading-relaxed">
            You were signed out due to inactivity. Please log in again to continue.
          </p>
          <Button
            className="w-full"
            onClick={() => router.replace("/login")}
          >
            Go to Login →
          </Button>
        </div>
      </div>
    );
  }

  // ── Warning modal (still signed in, timer running) ────────────────────────
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = mins > 0
    ? `${mins}:${String(secs).padStart(2, "0")}`
    : `${secs}s`;

  // Confirm sign-out sub-modal
  if (showConfirm) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-dark-text/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
          <h2 className="text-xl font-dm-serif text-dark-text mb-2">Sign Out Now?</h2>
          <p className="text-sm font-inter text-dark-text/70 mb-6 leading-relaxed">
            Are you sure you want to sign out? Any unsaved changes will be lost.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-poppins text-dark-text hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex-1 px-4 py-2.5 bg-error-red text-white rounded-lg text-sm font-poppins hover:bg-error-red/90 disabled:opacity-60 transition-colors"
            >
              {signingOut ? "Signing out…" : "Yes, Sign Out"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-dark-text/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Icon + countdown */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-warning-yellow/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-dm-serif text-dark-text mb-1">Still there?</h2>
          <p className="text-sm font-inter text-dark-text/70 leading-relaxed">
            Your session will expire due to inactivity in
          </p>
          {/* Countdown display */}
          <div className="mt-3 inline-flex items-center justify-center w-16 h-16 rounded-full border-4 border-warning-yellow bg-warning-yellow/10">
            <span className="text-lg font-poppins font-bold text-dark-text">{timeStr}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            className="w-full"
            onClick={onStayLoggedIn}
          >
            ✅ Stay Logged In
          </Button>
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-poppins text-dark-text/70 hover:bg-gray-50 transition-colors"
          >
            Sign Out Now
          </button>
        </div>

        <p className="text-[10px] font-inter text-dark-text/40 text-center mt-4">
          You will be automatically signed out when the timer reaches zero.
        </p>
      </div>
    </div>
  );
}
