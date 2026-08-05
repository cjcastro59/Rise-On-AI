import Sidebar from "@/components/layout/Sidebar";
import ProtectedContentWrapper from "@/components/layout/ProtectedContentWrapper";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type UserProfileName = {
  first_name: string | null;
  username: string | null;
};

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

  const { data: profile } = (await supabase
    .from("user_profiles")
    .select("first_name, username")
    .eq("id", user.id)
    .single()) as { data: UserProfileName | null };

  const userName = profile?.first_name || profile?.username || user.email?.split("@")[0] || "Friend";

  return (
    <div className="h-screen bg-gradient-to-r from-primary-blue to-lavender flex overflow-hidden">
      <Sidebar userName={userName} />
      <main className="flex-1 min-h-0 p-8 overflow-y-auto">
        <ProtectedContentWrapper userName={userName}>
          {children}
        </ProtectedContentWrapper>
      </main>
    </div>
  );
}
