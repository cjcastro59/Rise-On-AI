import Sidebar from "@/components/layout/Sidebar";
import MemberMobileNav from "@/components/layout/MemberMobileNav";
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
    /*
      Outer wrapper: full-height flex ROW on desktop.
      On mobile it becomes a flex COLUMN so the mobile nav bar sits on top.
    */
    <div className="min-h-screen bg-gradient-to-r from-primary-blue to-lavender flex flex-col md:flex-row overflow-x-hidden">

      {/*
        Desktop sidebar — sticky, hidden on mobile (handled by Sidebar's own
        `hidden md:flex` on the <aside>). On mobile this renders nothing visible.
      */}
      <Sidebar userName={userName} />

      {/*
        Right column: flex column so MobileNav (top bar) stacks above <main>.
        flex-1 lets it fill the remaining horizontal space on desktop.
        min-h-0 is required for overflow to work correctly inside flex children.
        h-screen + overflow-y-auto makes THIS column scroll, not the whole page,
        which is what lets the sidebar stay sticky on desktop.
      */}
      <div className="flex-1 flex flex-col min-h-0 md:h-screen md:overflow-y-auto overflow-x-hidden">

        {/*
          Mobile-only sticky top bar + slide-in drawer.
          Rendered here (outside the sidebar flex cell) so it spans the FULL
          viewport width on mobile. MobileNav internally applies `md:hidden`
          so it vanishes on desktop.
        */}
        <MemberMobileNav userName={userName} />

        {/* Page content */}
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          <ProtectedContentWrapper userName={userName}>
            {children}
          </ProtectedContentWrapper>
        </main>
      </div>
    </div>
  );
}
