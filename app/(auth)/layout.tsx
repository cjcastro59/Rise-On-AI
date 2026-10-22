import { redirect } from "next/navigation";
import { isMaintenanceModeActive } from "@/lib/maintenance";
import { createClient } from "@/lib/supabase/server";

// Force dynamic rendering so maintenance mode check always runs (no CDN caching)
export const dynamic = "force-dynamic";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const maintenanceActive = await isMaintenanceModeActive();

  if (maintenanceActive) {
    // During maintenance, check if a session already exists.
    // If the user is an owner, redirect them to their dashboard.
    // Otherwise, allow the login page to render so the owner can
    // authenticate. Non-owners who log in will be redirected to
    // /maintenance by their respective protected layouts.
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle() as { data: { role: string } | null };

      if (profile?.role === "owner") {
        redirect("/admin/dashboard");
      }
      // Non-owner already logged in — send to maintenance
      redirect("/maintenance");
    }
    // No session — allow login page to render (owner can log in here)
  }

  return <>{children}</>;
}
