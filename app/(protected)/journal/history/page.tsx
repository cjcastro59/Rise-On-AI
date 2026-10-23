"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/layout/PageHeader";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getSentimentFromMood } from "@/lib/sentiment";
import { MOOD_OPTIONS } from "@/lib/mood";
import { useConfirmation } from "@/components/layout/ConfirmationModalProvider";

type JournalEntry = {
  id: string;
  user_id: string;
  title: string | null;
  content: string | null;
  mood: string | null;
  emotions: string[] | null;
  created_at: string;
  updated_at: string;
  sentiment?: string | null;
  sentiment_score?: number | null;
  positive_percentage?: number | null;
  negative_percentage?: number | null;
  distress_percentage?: number | null;
  confidence?: number | null;
  sentiment_model?: string | null;
};

type MonthGroup = {
  monthKey: string;
  monthName: string;
  entries: JournalEntry[];
};

export default function JournalHistoryPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState("All");
  const [moodFilter, setMoodFilter] = useState("All");
  const [showMoodFilter, setShowMoodFilter] = useState(false);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { openConfirmation } = useConfirmation();

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching entries:", error);
        return;
      }

      setEntries(data || []);
    } catch (error) {
      console.error("Error fetching entries:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  const deleteEntry = (id: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation to entry
    
    openConfirmation({
      title: "Delete Entry",
      message: "Are you sure you want to delete this entry? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      isDangerous: true,
      onConfirm: async () => {
        try {
          setDeletingId(id);
          const { error } = await supabase
            .from("journal_entries")
            .delete()
            .eq("id", id);

          if (error) {
            console.error("Error deleting entry:", error);
            return;
          }

          // Update local state to remove the deleted entry
          setEntries(prev => prev.filter(entry => entry.id !== id));

          // Trigger behavioral/wellness/DRI recomputation after deletion
          fetch("/api/behavioral/compute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lookbackDays: 30 }),
          }).catch(() => {});
        } catch (error) {
          console.error("Error deleting entry:", error);
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const getSentiment = useCallback((entry: JournalEntry): string => {
    // 1. Prefer ML-predicted sentiment stored directly in DB (post-save)
    if (entry.sentiment) {
      return entry.sentiment.charAt(0).toUpperCase() + entry.sentiment.slice(1);
    }

    // 2. Fallback: infer from selected mood name
    if (entry.mood) {
      const moodSentiment = getSentimentFromMood(entry.mood);
      return moodSentiment.charAt(0).toUpperCase() + moodSentiment.slice(1);
    }

    return "Positive";
  }, []);

  const applyFilters = useCallback(() => {
    let result = [...entries];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (entry) =>
          (entry.title?.toLowerCase().includes(query) || false) ||
          (entry.content?.toLowerCase().includes(query) || false)
      );
    }

    if (sentimentFilter !== "All") {
      result = result.filter((entry) => getSentiment(entry) === sentimentFilter);
    }

    if (moodFilter !== "All") {
      result = result.filter((entry) => entry.mood === moodFilter);
    }

    setFilteredEntries(result);
  }, [entries, getSentiment, searchQuery, sentimentFilter, moodFilter]);

  useEffect(() => {
    if (user) {
      fetchEntries();
    }
  }, [fetchEntries, user]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const getMoodEmoji = (mood: string | null): string => {
    if (!mood) return "😐";
    const found = MOOD_OPTIONS.find((m) => m.label === mood);
    return found?.emoji ?? "😐";
  };

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case "Positive":
        return "bg-[#52B788]/20 text-[#52B788]";
      case "Negative":
        return "bg-[#F4A6A6]/20 text-[#F4A6A6]";
      case "Distress":
        return "bg-error-red/15 text-error-red";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getWordCount = (content: string | null): number => {
    if (!content) return 0;
    return content.trim().split(/\s+/).filter((word) => word.length > 0).length;
  };

  const getExcerpt = (content: string | null): string => {
    if (!content) return "";
    const words = content.split(/\s+/).slice(0, 20);
    return words.join(" ") + (content.split(/\s+/).length > 20 ? "..." : "");
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const groupEntriesByMonth = (entriesToGroup: JournalEntry[]): MonthGroup[] => {
    const groups: Record<string, MonthGroup> = {};
    entriesToGroup.forEach((entry) => {
      const date = new Date(entry.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthName = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      if (!groups[monthKey]) {
        groups[monthKey] = { monthKey, monthName, entries: [] };
      }
      groups[monthKey].entries.push(entry);
    });
    return Object.values(groups);
  };

  const toggleMonth = (monthKey: string) => {
    const newCollapsed = new Set(collapsedMonths);
    if (newCollapsed.has(monthKey)) {
      newCollapsed.delete(monthKey);
    } else {
      newCollapsed.add(monthKey);
    }
    setCollapsedMonths(newCollapsed);
  };

  const monthGroups = groupEntriesByMonth(filteredEntries);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-slate-700">Loading entries...</p>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <PageHeader title="My Journal" subtitle="Your personal entries, organized" />

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">🔍</span>
          <input
            type="text"
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-sm font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/50 transition-shadow"
          />
        </div>

        {/* Sentiment filter pills */}
        <div>
          <p className="text-xs font-poppins uppercase tracking-wider text-slate-600 mb-2">Filter by sentiment</p>
          <div className="flex flex-wrap gap-2">
            {["All", "Positive", "Negative", "Distress"].map((filter) => (
              <button
                key={filter}
                onClick={() => setSentimentFilter(filter)}
                className={`px-3 py-1.5 rounded-full text-xs font-poppins font-medium transition-all duration-150 hover:scale-105 active:scale-95 ${
                  sentimentFilter === filter
                    ? filter === "Positive"
                      ? "bg-[#52B788] text-white shadow-sm"
                      : filter === "Negative"
                      ? "bg-[#F4A6A6] text-white shadow-sm"
                      : filter === "Distress"
                      ? "bg-error-red text-white shadow-sm"
                      : "bg-primary-blue text-white shadow-sm"
                    : "bg-white border border-gray-200 text-slate-700 hover:border-primary-blue/40 hover:text-dark-text"
                }`}
              >
                {filter === "Positive" ? "😊 " : filter === "Negative" ? "😔 " : filter === "Distress" ? "⚠️ " : ""}
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Mood filter — collapsible */}
        <div>
          <button
            type="button"
            onClick={() => setShowMoodFilter((v) => !v)}
            className="flex items-center gap-2 text-xs font-poppins uppercase tracking-wider text-slate-600 hover:text-dark-text/80 transition-colors mb-2"
          >
            <span>Filter by mood</span>
            <span className="text-xs normal-case tracking-normal font-normal">
              {moodFilter !== "All" && (
                <span className="ml-1 px-2 py-0.5 bg-primary-blue/15 text-primary-blue rounded-full">
                  {MOOD_OPTIONS.find(m => m.label === moodFilter)?.emoji} {moodFilter}
                </span>
              )}
              {showMoodFilter ? " ↑" : " ↓"}
            </span>
          </button>
          {showMoodFilter && (
            <div className="flex flex-wrap gap-2 p-3 bg-light-gray/30 rounded-xl border border-light-gray animate-in fade-in duration-150">
              <button
                onClick={() => setMoodFilter("All")}
                className={`px-3 py-1.5 rounded-full text-xs font-poppins font-medium transition-all duration-150 hover:scale-105 active:scale-95 ${
                  moodFilter === "All"
                    ? "bg-primary-blue text-white shadow-sm"
                    : "bg-white border border-gray-200 text-slate-700 hover:border-primary-blue/40"
                }`}
              >
                All moods
              </button>
              {MOOD_OPTIONS.map((mood) => (
                <button
                  key={mood.label}
                  onClick={() => setMoodFilter(mood.label)}
                  className={`px-3 py-1.5 rounded-full text-xs font-poppins font-medium transition-all duration-150 hover:scale-105 active:scale-95 flex items-center gap-1 ${
                    moodFilter === mood.label
                      ? "bg-primary-blue text-white shadow-sm"
                      : "bg-white border border-gray-200 text-slate-700 hover:border-primary-blue/40"
                  }`}
                >
                  <span>{mood.emoji}</span>
                  {mood.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active filter summary + clear */}
        {(sentimentFilter !== "All" || moodFilter !== "All" || searchQuery) && (
          <div className="flex items-center justify-between text-xs font-inter text-slate-600 bg-primary-blue/5 px-3 py-2 rounded-lg">
            <span>
              Showing {filteredEntries.length} of {entries.length} entries
              {sentimentFilter !== "All" && ` · Sentiment: ${sentimentFilter}`}
              {moodFilter !== "All" && ` · Mood: ${moodFilter}`}
              {searchQuery && ` · Search: "${searchQuery}"`}
            </span>
            <button
              type="button"
              onClick={() => { setSentimentFilter("All"); setMoodFilter("All"); setSearchQuery(""); }}
              className="text-primary-blue hover:underline font-poppins ml-3 shrink-0"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Entries List */}
      {filteredEntries.length > 0 ? (
        <div className="space-y-6">
          {monthGroups.map((group) => (
            <div key={group.monthKey} className="space-y-3">
              <button
                onClick={() => toggleMonth(group.monthKey)}
                className="flex items-center gap-2 text-lg font-poppins font-semibold text-dark-text hover:text-dark-text/80 w-full text-left transition-colors"
              >
                <span className="text-sm leading-none">
                  {collapsedMonths.has(group.monthKey) ? "▶" : "▼"}
                </span>
                {group.monthName}
                <span className="text-sm font-normal text-slate-600">
                  ({group.entries.length} {group.entries.length === 1 ? "entry" : "entries"})
                </span>
              </button>
              {!collapsedMonths.has(group.monthKey) && (
                <div className="space-y-3 pl-6">
                  {group.entries.map((entry) => (
                    <Card key={entry.id} className="p-4 sm:p-6 bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <Link href={`/journal/${entry.id}`} className="flex-1 min-w-0 cursor-pointer">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">{getMoodEmoji(entry.mood)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-poppins font-semibold text-dark-text truncate">
                                  {entry.title || "Untitled Entry"}
                                </h3>
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-semibold shrink-0 ${getSentimentColor(
                                    getSentiment(entry)
                                  )}`}
                                >
                                  {getSentiment(entry)}
                                </span>
                              </div>
                              <p className="text-xs font-inter text-slate-600">
                                {formatDate(entry.created_at)} • {getWordCount(entry.content)} words
                              </p>
                            </div>
                          </div>
                          <p className="text-sm font-inter text-slate-700">
                            {getExcerpt(entry.content)}
                          </p>
                        </Link>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link href={`/analysis?entryId=${entry.id}`}>
                            <Button variant="secondary" size="sm">
                              Analysis
                            </Button>
                          </Link>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => deleteEntry(entry.id, e)}
                            disabled={deletingId === entry.id}
                            className="text-soft-red border-soft-red hover:bg-soft-red/10"
                          >
                            {deletingId === entry.id ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 bg-light-gray rounded-full flex items-center justify-center">
            <span className="text-4xl">📝</span>
          </div>
          <h3 className="text-xl font-dm-serif text-dark-text mb-2">
            {searchQuery ? "No entries found" : "No entries yet"}
          </h3>
          <p className="text-sm font-inter text-slate-700 mb-6">
            {searchQuery ? "Try a different search term" : "Start your journaling journey today"}
          </p>
          {!searchQuery && (
            <Link href="/journal">
              <Button>Write your first entry</Button>
            </Link>
          )}
        </div>
      )}
    </>
  );
}
