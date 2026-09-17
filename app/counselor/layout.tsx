import CounselorSidebar from "@/components/counselor/CounselorSidebar";
import StaffAnnouncementToast from "@/components/layout/StaffAnnouncementToast";
import { isMaintenanceModeActive } from "@/lib/maintenance";
import { redirect } from "next/navigation";

export default async function CounselorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await isMaintenanceModeActive()) {
    redirect("/maintenance");
  }
  return (
    <div className="h-screen bg-gradient-to-r from-primary-blue to-lavender flex overflow-hidden">
      <StaffAnnouncementToast />
      <CounselorSidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
