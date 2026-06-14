import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import { createClient } from "@/lib/supabase/server";

// Mock journal entries data
const mockEntries = [
  {
    id: "1",
    date: "June 14, 2026",
    title: "Feeling overwhelmed",
    excerpt: "Today was a bit stressful with exams coming up, but I'm trying to stay positive...",
    mood: "😊",
    sentiment: "positive",
    wordCount: 156
  },
  {
    id: "2",
    date: "June 13, 2026",
    title: "Gratitude list",
    excerpt: "Feeling grateful for small things today. The sun was shining and I had a good talk with my friend...",
    mood: "😌",
    sentiment: "positive",
    wordCount: 89
  },
  {
    id: "3",
    date: "June 12, 2026",
    title: "Rough day",
    excerpt: "Feeling anxious about tomorrow's presentation. I need to take deep breaths and prepare well...",
    mood: "😰",
    sentiment: "neutral",
    wordCount: 123
  }
];

export default async function JournalHistoryPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Should never happen because of middleware
  if (!user) {
    return null;
  }

  return (
    <ProtectedLayout activePage="history">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-dm-serif text-dark-text mb-2">My Journal</h1>
        <p className="text-dark-text/70 text-sm font-inter">Your personal entries, organized</p>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-3 mb-6">
        {["All", "Positive", "Neutral", "Negative"].map((filter) => (
        <Button
          key={filter}
          variant={filter === "All" ? "default" : "secondary"}
          size="sm"
        >
          {filter}
        </Button>
      ))}
      </div>

      {/* Entries List */}
      <div className="space-y-4">
        {mockEntries.map((entry) => (
        <Link key={entry.id} href={`/journal/${entry.id}`}>
          <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{entry.mood}</span>
                  <div>
                    <h3 className="font-poppins font-semibold text-dark-text">{entry.title}</h3>
                    <p className="text-xs font-inter text-dark-text/60">{entry.date} • {entry.wordCount} words</p>
                  </div>
                </div>
                <p className="text-sm font-inter text-dark-text/70">{entry.excerpt}</p>
              </div>
              <div className="ml-4">
                <span className={`text-xs font-poppins px-3 py-1 rounded-full ${
                  entry.sentiment === "positive" ? "bg-success-green/20 text-success-green" :
                  entry.sentiment === "negative" ? "bg-error-red/20 text-error-red" :
                  "bg-primary-blue/20 text-primary-blue"
                }`}>
                  {entry.sentiment}
                </span>
              </div>
            </div>
          </Card>
        </Link>
      ))}
      </div>

      {/* No Entries State (hidden for now) */}
      {mockEntries.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 bg-light-gray rounded-full flex items-center justify-center">
            <span className="text-4xl">📝</span>
          </div>
          <h3 className="text-xl font-dm-serif text-dark-text mb-2">No entries yet</h3>
          <p className="text-sm font-inter text-dark-text/70 mb-6">Start your journaling journey today</p>
          <Link href="/journal">
            <Button>Write your first entry</Button>
          </Link>
        </div>
      )}
    </ProtectedLayout>
  );
}
