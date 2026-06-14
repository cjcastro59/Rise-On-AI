import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoodCard } from "@/components/dashboard/mood-card";
import { InsightCard } from "@/components/dashboard/insight-card";
import { JournalEditor } from "@/components/journal/journal-editor";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Should never happen because of middleware
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const userName = profile?.first_name || profile?.username || user.email?.split("@")[0] || "Friend";

  return (
    <ProtectedLayout activePage="dashboard">
      {/* Top Header */}
      <header className="flex items-center justify-between mb-8 bg-white rounded-2xl px-6 py-4 shadow-sm border border-light-gray">
        <nav className="flex items-center gap-4">
          <Link href="/dashboard" className="text-dark-text text-sm font-poppins font-semibold">Home</Link>
          <Link href="/journal" className="text-dark-text/60 text-sm font-poppins font-medium hover:text-primary-blue">Journal</Link>
          <Link href="/insights" className="text-dark-text/60 text-sm font-poppins font-medium hover:text-primary-blue">Insights</Link>
          <Link href="/journal/history" className="text-dark-text/60 text-sm font-poppins font-medium hover:text-primary-blue">History</Link>
        </nav>
        <div className="flex items-center gap-4">
          <button className="px-4 py-2 bg-pink-100 text-pink-600 rounded-full text-xs font-poppins font-semibold flex items-center gap-2">
            <span className="text-lg">🎉</span>
            Crisis Support
          </button>
          <div className="w-10 h-10 bg-gradient-to-r from-primary-blue to-lavender rounded-full flex items-center justify-center text-white font-poppins font-semibold">
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-dm-serif text-dark-text mb-2">
          Good morning, {userName.split(" ")[0]}!
        </h1>
        <p className="text-dark-text/70 text-sm font-inter flex items-center gap-2">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          <span className="mx-2">•</span>
          How are you feeling today?
        </p>
        <div className="flex items-center gap-4 mt-3">
          {["Happy", "Calm", "Anxious", "Sad"].map((mood) => (
            <MoodCard key={mood} mood={mood} icon={mood === "Happy" ? "😊" : mood === "Calm" ? "😌" : mood === "Anxious" ? "😰" : "😢"} />
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-text/60 text-xs font-poppins mb-1">Streak</p>
              <p className="text-2xl font-dm-serif text-dark-text">12</p>
            </div>
            <div className="w-12 h-12 bg-warning-yellow/30 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🔥</span>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-text/60 text-xs font-poppins mb-1">Total Entries</p>
              <p className="text-2xl font-dm-serif text-dark-text">47</p>
            </div>
            <div className="w-12 h-12 bg-primary-blue/30 rounded-xl flex items-center justify-center">
              <span className="text-2xl">📝</span>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-text/60 text-xs font-poppins mb-1">Avg. Mood Score</p>
              <p className="text-2xl font-dm-serif text-dark-text">7.5</p>
            </div>
            <div className="w-12 h-12 bg-lavender/30 rounded-xl flex items-center justify-center">
              <span className="text-2xl">❤️</span>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-text/60 text-xs font-poppins mb-1">Positivity This Week</p>
              <p className="text-2xl font-dm-serif text-dark-text">89%</p>
            </div>
            <div className="w-12 h-12 bg-success-green/30 rounded-xl flex items-center justify-center">
              <span className="text-2xl">📈</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Journal Editor */}
        <JournalEditor />

        {/* Mood Chart Placeholder */}
        <Card className="p-6 bg-white">
          <h3 className="font-poppins font-semibold text-dark-text mb-4">Your Mood Over Time</h3>
          <div className="h-48 bg-gradient-to-r from-header-bg to-lavender/20 rounded-xl flex items-end justify-around px-4 pb-4">
            <div className="w-8 h-1/3 bg-primary-blue/50 rounded-t-lg" />
            <div className="w-8 h-2/5 bg-primary-blue/70 rounded-t-lg" />
            <div className="w-8 h-3/5 bg-lavender/50 rounded-t-lg" />
            <div className="w-8 h-1/2 bg-lavender/70 rounded-t-lg" />
            <div className="w-8 h-4/5 bg-lavender rounded-t-lg" />
            <div className="w-8 h-full bg-gradient-to-t from-primary-blue to-lavender rounded-t-lg" />
          </div>
        </Card>

        {/* Quick Check In */}
        <Card className="p-6 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-poppins font-semibold text-dark-text">Today's Journal</h3>
            <span className="text-xs font-poppins text-dark-text/60">What's on your mind?</span>
          </div>
          <p className="text-sm font-inter text-dark-text/70 mb-6">
            I hope lang naman okay na everything, especially with school work!
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm">
                😔 Coping
              </Button>
              <Button variant="secondary" size="sm">
                😌 Okay
              </Button>
            </div>
            <Button size="sm">
              Analyze with AI →
            </Button>
          </div>
        </Card>

        {/* Daily Insight */}
        <InsightCard
          title="Daily Insight"
          content="You've been writing more about gratitude and connection this week. Keep focusing on the little things that make you smile!"
          icon="💡"
        />
      </div>
    </ProtectedLayout>
  );
}
