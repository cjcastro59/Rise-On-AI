import Link from "next/link";
import { Button } from "@/components/ui/button";
import LandingHeader from "@/components/landing/LandingHeader";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isMaintenanceModeActive } from "@/lib/maintenance";

export default async function LandingPage() {
  // Redirect to maintenance page if active (non-logged-in visitors)
  if (await isMaintenanceModeActive()) {
    redirect("/maintenance");
  }

  // Redirect logged-in users straight to their dashboard
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: { role: string } | null };

    const role = profile?.role;
    if (role === "counselor") redirect("/counselor/dashboard");
    if (role === "admin" || role === "owner") redirect("/admin/dashboard");
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <LandingHeader />

      {/* Hero Section */}
      <section className="max-w-3xl mx-auto px-6 py-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="inline-flex items-center gap-2 bg-light-gray rounded-full px-4 py-2 mb-6">
          <span className="text-sm font-poppins font-medium text-dark-text">
            For Students and Young Adults
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-dm-serif text-dark-text mb-5 leading-tight">
          Your{" "}
          <span className="text-lavender italic">mind</span>{" "}
          deserves
          <br />
          a safe space to grow.
        </h1>
        <p className="text-lg text-dark-text/80 max-w-xl mx-auto mb-8 font-inter">
          Rise On AI listens to your journal entries, understands your emotions, and helps you stay aware of your mental wellness — in English and Taglish.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <Link href="/register">
            <Button size="lg">Start Journaling Free</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="lg">
              Log In →
            </Button>
          </Link>
        </div>

        {/* 4 feature pills — single row on desktop, wraps on mobile */}
        <div className="flex flex-wrap justify-center gap-3 text-sm font-inter text-dark-text/70">
          <span className="flex items-center gap-1.5 bg-light-gray rounded-full px-4 py-2">🇵🇭 Taglish & English</span>
          <span className="flex items-center gap-1.5 bg-light-gray rounded-full px-4 py-2">💡 AI Sentiment Analysis</span>
          <span className="flex items-center gap-1.5 bg-light-gray rounded-full px-4 py-2">🔒 Private & Secure</span>
          <span className="flex items-center gap-1.5 bg-light-gray rounded-full px-4 py-2">📊 Mood Trend Tracking</span>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-light-gray py-12 scroll-mt-6">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-dm-serif text-dark-text mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-white rounded-2xl p-6">
              <div className="w-10 h-10 bg-light-gray rounded-full flex items-center justify-center mx-auto mb-3 border border-teal">
                <span className="text-sm font-poppins font-bold text-dark-text">1</span>
              </div>
              <h3 className="font-poppins font-semibold text-dark-text mb-2 text-sm">Write Today</h3>
              <p className="text-xs font-inter text-dark-text/70">
                Express your thoughts freely in English, Filipino, or Taglish.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6">
              <div className="w-10 h-10 bg-light-gray rounded-full flex items-center justify-center mx-auto mb-3 border border-primary-blue">
                <span className="text-sm font-poppins font-bold text-dark-text">2</span>
              </div>
              <h3 className="font-poppins font-semibold text-dark-text mb-2 text-sm">AI Analyzes</h3>
              <p className="text-xs font-inter text-dark-text/70">
                Our AI reads your entry and detects your emotional tone.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6">
              <div className="w-10 h-10 bg-light-gray rounded-full flex items-center justify-center mx-auto mb-3 border border-lavender">
                <span className="text-sm font-poppins font-bold text-dark-text">3</span>
              </div>
              <h3 className="font-poppins font-semibold text-dark-text mb-2 text-sm">Gain Insights</h3>
              <p className="text-xs font-inter text-dark-text/70">
                Receive supportive reflections and track your wellness over time.
              </p>
            </div>
          </div>
          <Link href="/register">
            <Button size="lg">Create Free Account →</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}