import Sidebar from "@/components/layout/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({
  children,
  activePage,
}: {
  children: React.ReactNode;
  activePage?: "dashboard" | "journal" | "history" | "insights" | "analysis";
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
      <Sidebar activePage={activePage} userName={userName} />
      {/* Main Content */}
      <main className="flex-1 bg-[linear-gradient(135deg,_#dceffd_0%,_#e8d8f7_55%,_#e4c7f0_100%)] p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
