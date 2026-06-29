"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchEntries();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [entries, searchQuery, sentimentFilter]);

  const fetchEntries = async () => {
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
  };

  const applyFilters = () => {
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
      result = result.filter((entry) => getSentiment(entry.mood) === sentimentFilter);
    }

    setFilteredEntries(result);
  };

  const getSentiment = (mood: string | null): string => {
    const positiveMoods = ["Happy", "Calm", "Excited"];
    const negativeMoods = ["Anxious", "Sad", "Frustrated", "Overwhelmed"];
    if (!mood) return "Neutral";
    if (positiveMoods.includes(mood)) return "Positive";
    if (negativeMoods.includes(mood)) return "Negative";
    return "Neutral";
  };

  const getMoodEmoji = (mood: string | null) => {
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

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "Positive":
        return "bg-green-100 text-green-800";
      case "Negative":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getWordCount = (content: string | null) => {
    if (!content) return 0;
    return content.trim().split(/\s+/).filter((word) => word.length > 0).length;
  };

  const getExcerpt = (content: string | null) => {
    if (!content) return "";
    const words = content.split(/\s+/).slice(0, 20);
    return words.join(" ") + (content.split(/\s+/).length > 20 ? "..." : "");
  };

  const formatDate = (dateString: string) => {
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
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

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
      <div className="mb-8">
        <h1 className="text-3xl font-dm-serif text-dark-text mb-2">My Journal</h1>
        <p className="text-dark-text/70 text-sm font-inter">Your personal entries, organized</p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <Input
          type="text"
          placeholder="Search entries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <div className="flex gap-2">
          {["All", "Positive", "Neutral", "Negative"].map((filter) => (
            <Button
              key={filter}
              variant={sentimentFilter === filter ? "default" : "secondary"}
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
                    <Link key={entry.id} href={`/journal/${entry.id}`}>
                      <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-2xl">{getMoodEmoji(entry.mood)}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-poppins font-semibold text-dark-text">
                                    {entry.title || "Untitled Entry"}
                                  </h3>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(
                                      getSentiment(entry.mood)
                                    )}`}
                                  >
                                    {getSentiment(entry.mood)}
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
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm font-inter text-dark-text/70">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
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