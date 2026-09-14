"use client";

import { useEffect } from "react";
import { ConfirmationModalProvider } from "@/components/layout/ConfirmationModalProvider";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const wake = () => {
      void fetch("/api/sentiment/warmup").catch(() => undefined);
    };
    wake();
    const id = window.setInterval(wake, 4 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <ConfirmationModalProvider>
      {children}
    </ConfirmationModalProvider>
  );
}
