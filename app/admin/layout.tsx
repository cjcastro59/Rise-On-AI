import AdminSidebar from "@/components/admin/AdminSidebar";
import StaffAnnouncementToast from "@/components/layout/StaffAnnouncementToast";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Role guard — only admin / owner / researcher may access /admin/*
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile as any)?.role ?? "user";

  if (role === "counselor") redirect("/counselor/dashboard");
  if (!["admin", "owner", "researcher"].includes(role)) redirect("/dashboard");

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
