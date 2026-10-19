"use client";

import { useEffect, useState } from "react";
import { Portal } from "@/components/ui/Portal";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  open: boolean;
  message: string;
  type?: ToastType;
  duration?: number; // ms, default 3500
  onClose: () => void;
}

export function Toast({
  open,
  message,
  type = "success",
  duration = 3500,
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [open, duration, onClose]);

  if (!open) return null;

  const styles: Record<ToastType, string> = {
    success: "bg-success-green/10 border-success-green/30 text-success-green",
    error:   "bg-red-50 border-red-200 text-red-700",
    info:    "bg-primary-blue/10 border-primary-blue/20 text-primary-blue",
  };

  const icons: Record<ToastType, React.ReactNode> = {
    success: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    error: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    info: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  };

  return (
    <Portal>
      <div className="fixed top-4 right-4 z-[9999] pointer-events-none">
        <div
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-poppins font-medium animate-in slide-in-from-top-2 fade-in duration-200 max-w-sm ${styles[type]}`}
        >
          <span className="shrink-0">{icons[type]}</span>
          <span className="flex-1">{message}</span>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-1"
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </Portal>
  );
}

/**
 * useToast — minimal hook to drive <Toast /> state.
 *
 * Usage:
 *   const { toast, showToast, closeToast } = useToast();
 *   <Toast {...toast} onClose={closeToast} />
 *   showToast("Saved!", "success");
 */
export function useToast() {
  const [toast, setToast] = useState<{ open: boolean; message: string; type: ToastType }>({
    open: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ open: true, message, type });
  };
  const closeToast = () => setToast((prev) => ({ ...prev, open: false }));

  return { toast, showToast, closeToast };
}
