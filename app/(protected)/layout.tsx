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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = (await supabase
    .from("user_profiles")
    .select("first_name, username")
    .eq("id", user.id)
    .single()) as { data: UserProfileName | null };

  const userName =
    profile?.first_name ||
    profile?.username ||
    user.email?.split("@")[0] ||
    "Friend";

  return (
    <div className="min-h-screen bg-gradient-to-r from-primary-blue to-lavender">
      {/*
        ─────────────────────────────────────────────────────────────────
        MOBILE  (< 768 px)
        ─────────────────────────────────────────────────────────────────
        • MemberMobileNav renders a sticky top bar + slide‑in drawer.
        • It carries `md:hidden` so it produces ZERO output on desktop.
        • The <Sidebar> below is `hidden md:flex` so it is truly
          display:none on mobile — no flex cell, no width, nothing.
        ─────────────────────────────────────────────────────────────────
        DESKTOP (≥ 768 px)
        ─────────────────────────────────────────────────────────────────
        • MemberMobileNav renders nothing.
        • Sidebar renders a sticky 256‑px aside.
        • The main content sits in flex-1 next to it.
        ─────────────────────────────────────────────────────────────────
      */}
      <MemberMobileNav userName={userName} />

      {/* ── Desktop layout wrapper (flex row, ignored on mobile) ── */}
      <div className="md:flex md:min-h-screen">
        {/*
          Sidebar — the <aside> inside uses `hidden md:flex`
          so it is display:none on mobile. Because `md:flex` on the
          parent div above is also inactive on mobile, this whole section
          collapses to nothing on small screens.
        */}
        <Sidebar userName={userName} />

        {/*
          Content — on mobile this is the ONLY thing visible below the
          MemberMobileNav top bar, so it correctly fills 100 % width.
          On desktop flex-1 + min-w-0 fills the remaining space.
        */}
        <main className="flex-1 min-w-0 p-4 md:p-8 overflow-x-hidden">
          <ProtectedContentWrapper userName={userName}>
            {children}
          </ProtectedContentWrapper>
        </main>
      </div>
    </div>
  );
}
