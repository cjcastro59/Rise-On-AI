import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen bg-gradient-to-r from-primary-blue to-lavender flex overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 min-h-0 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
