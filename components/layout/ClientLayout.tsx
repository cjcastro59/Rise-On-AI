"use client";

import { ConfirmationModalProvider } from "@/components/layout/ConfirmationModalProvider";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmationModalProvider>
      {children}
    </ConfirmationModalProvider>
  );
}
