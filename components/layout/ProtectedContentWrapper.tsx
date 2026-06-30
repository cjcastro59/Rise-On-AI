"use client";

import { usePathname } from "next/navigation";
import CrisisNotification from "./CrisisNotification";

export default function ProtectedContentWrapper({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  const pathname = usePathname();
  const isSupportPage = pathname === "/support";
  
  return (
    <>
      {!isSupportPage && <CrisisNotification />}
      {children}
    </>
  );
}
