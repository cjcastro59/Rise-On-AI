import CounselorSidebar from "@/components/counselor/CounselorSidebar";
import StaffAnnouncementToast from "@/components/layout/StaffAnnouncementToast";

// Role guard is handled by the CounselorSidebar component (client-side check)
// and by middleware (auth check). A server-side DB call here causes slow
// page loads because it runs on every counselor page navigation.
export default function CounselorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
