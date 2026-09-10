import CounselorSidebar from "@/components/counselor/CounselorSidebar";

export default function CounselorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen bg-gradient-to-r from-primary-blue to-lavender flex overflow-hidden">
      <CounselorSidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
