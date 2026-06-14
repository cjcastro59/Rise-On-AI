import Sidebar from "@/components/layout/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const userName = profile?.first_name || profile?.username || user.email?.split("@")[0] || "Friend";

  return (
    <div className="min-h-screen bg-white flex">
      <Sidebar userName={userName} />
      <main className="flex-1 bg-gradient-to-br from-header-bg to-white p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
