import AdminSidebar from "@/components/admin/AdminSidebar";
import StaffAnnouncementToast from "@/components/layout/StaffAnnouncementToast";
import { isMaintenanceModeActive } from "@/lib/maintenance";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const maintenanceActive = await isMaintenanceModeActive();
  if (maintenanceActive) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/maintenance");

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "owner") {
      redirect("/maintenance");
    }
  }
  return (
    <div className="h-screen bg-gradient-to-r from-primary-blue to-lavender flex overflow-hidden">
      <StaffAnnouncementToast />
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
