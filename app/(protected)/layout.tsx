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

  const userName =
    profile?.first_name || profile?.username || user.email?.split("@")[0] || "Friend";

  return (
    <div className="min-h-screen bg-gradient-to-r from-primary-blue to-lavender">
      {/*
        ── MOBILE (< md) ───────────────────────────────────────────────────────
        MemberMobileNav renders a sticky top bar + slide-in drawer.
        It uses `md:hidden` internally so it vanishes on desktop.
        It is placed here — OUTSIDE the sidebar flex cell — so the top bar
        spans the full viewport width.

        ── DESKTOP (≥ md) ──────────────────────────────────────────────────────
        The inner flex row below handles desktop layout.
        MemberMobileNav renders nothing on desktop.
      */}
      <MemberMobileNav userName={userName} />

      {/*
        Desktop layout: fixed sidebar + scrollable main content side by side.
        On mobile this collapses — the sidebar's <aside> is `hidden md:flex`
        so it takes zero space on mobile, leaving the full width for <main>.
      */}
      <div className="md:flex">
        {/* Desktop sidebar — sticky, hidden on mobile via internal `hidden md:flex` */}
        <Sidebar userName={userName} />

        {/* Main content area — scrolls independently on desktop */}
        <main className="flex-1 p-4 md:p-8 min-w-0 overflow-x-hidden">
          <ProtectedContentWrapper userName={userName}>
            {children}
          </ProtectedContentWrapper>
        </main>
      </div>
    </div>
  );
}
