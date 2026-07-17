"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/layout/PageHeader";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { analyzeSentiment, getSentimentFromMood } from "@/lib/sentiment";
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
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { openConfirmation } = useConfirmation();

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
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
  }, [supabase]);

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
          setEntries(entries.filter(entry => entry.id !== id));
        } catch (error) {
          console.error("Error deleting entry:", error);
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const getSentiment = useCallback((mood: string | null, content: string | null): string => {
    if (mood) {
      const moodSentiment = getSentimentFromMood(mood);
      return moodSentiment.charAt(0).toUpperCase() + moodSentiment.slice(1);
    }

    const textSentiment = analyzeSentiment(content);
    return textSentiment.charAt(0).toUpperCase() + textSentiment.slice(1);
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
      result = result.filter((entry) => getSentiment(entry.mood, entry.content) === sentimentFilter);
    }

    setFilteredEntries(result);
  }, [entries, getSentiment, searchQuery, sentimentFilter]);

  useEffect(() => {
    if (user) {
      fetchEntries();
    }
  }, [fetchEntries, user]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const getMoodEmoji = (mood: string | null): string => {
    const moodMap: Record<string, string> = {
      "Happy": "😊",
      "Calm": "😌",
      "Excited": "🎉",
      "Confused": "😕",
      "Anxious": "😰",
      "Sad": "😢",
      "Frustrated": "😤",
      "Overwhelmed": "😵"
    };
    return mood ? (moodMap[mood] || "😐") : "😐";
  };

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case "Positive":
        return "bg-[#52B788]/20 text-[#52B788]";
      case "Negative":
        return "bg-[#F4A6A6]/20 text-[#F4A6A6]";
      case "Distress":
        return "bg-red-100 text-red-600";
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
        <p className="text-dark-text/70">Loading entries...</p>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <PageHeader title="My Journal" subtitle="Your personal entries, organized" />

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-text/60">🔍</span>
          <input
            type="text"
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-sm font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/50"
          />
        </div>
        <div className="flex gap-2">
          {["All", "Positive", "Negative", "Distress"].map((filter) => (
            <Button
              key={filter}
              variant={sentimentFilter === filter ? "primary" : "secondary"}
              size="sm"
              onClick={() => setSentimentFilter(filter)}
            >
              {filter}
            </Button>
          ))}
        </div>
      </div>

      {/* Entries List */}
      {filteredEntries.length > 0 ? (
        <div className="space-y-6">
          {monthGroups.map((group) => (
            <div key={group.monthKey} className="space-y-3">
              <button
                onClick={() => toggleMonth(group.monthKey)}
                className="flex items-center gap-2 text-lg font-semibold text-dark-text hover:text-dark-text/80 w-full text-left"
              >
                <span className="text-lg">
                  {collapsedMonths.has(group.monthKey) ? "▶" : "▼"}
                </span>
                {group.monthName}
                <span className="text-sm font-normal text-dark-text/50">
                  ({group.entries.length} entries)
                </span>
              </button>
              {!collapsedMonths.has(group.monthKey) && (
                <div className="space-y-3 pl-6">
                  {group.entries.map((entry) => (
                    <Card key={entry.id} className="p-6 bg-white hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between gap-4">
                        <Link href={`/journal/${entry.id}`} className="flex-1 min-w-0 cursor-pointer">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">{getMoodEmoji(entry.mood)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-poppins font-semibold text-dark-text">
                                  {entry.title || "Untitled Entry"}
                                </h3>
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-semibold ${getSentimentColor(
                                    getSentiment(entry.mood, entry.content)
                                  )}`}
                                >
                                  {getSentiment(entry.mood, entry.content)}
                                </span>
                              </div>
                              <p className="text-xs font-inter text-dark-text/60">
                                {formatDate(entry.created_at)} • {getWordCount(entry.content)} words
                              </p>
                            </div>
                          </div>
                          <p className="text-sm font-inter text-dark-text/70">
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
          <p className="text-sm font-inter text-dark-text/70 mb-6">
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
