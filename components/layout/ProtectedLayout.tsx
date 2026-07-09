import Sidebar from "@/components/layout/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type UserProfileName = {
  first_name: string | null;
  username: string | null;
};

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

  const { data: profile } = (await supabase
    .from("user_profiles")
    .select("first_name, username")
    .eq("id", user.id)
    .single()) as { data: UserProfileName | null };

  const userName = profile?.first_name || profile?.username || user.email?.split("@")[0] || "Friend";

  return (
    <div className="min-h-screen bg-white flex">
      <Sidebar activePage={activePage} userName={userName} />
      {/* Main Content */}
      <main className="flex-1 bg-gradient-to-br from-header-bg to-white p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
