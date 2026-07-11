import CounselorSidebar from "@/components/counselor/CounselorSidebar";

export default function CounselorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen bg-white flex overflow-hidden">
      <CounselorSidebar />
      <main className="flex-1 min-h-0 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
