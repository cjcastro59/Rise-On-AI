"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { createDistressAlertForJournalEntry } from "@/lib/distress-alerts";
import { getMoodScore } from "@/lib/mood";
import Link from "next/link";

const moods = [
  { emoji: "😊", label: "Happy" },
  { emoji: "😰", label: "Anxious" },
  { emoji: "😢", label: "Sad" },
  { emoji: "😤", label: "Frustrated" },
  { emoji: "😌", label: "Calm" },
  { emoji: "🎉", label: "Excited" },
  { emoji: "😕", label: "Confused" },
  { emoji: "😵", label: "Overwhelmed" },
];

const commonEmojis = [
  "😊", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇",
  "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝",
  "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬",
  "😮‍💨", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧",
  "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐", "😕", "😟",
  "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢",
  "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬",
  "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖", "🎃",
  "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾"
];

const prompts = [
  "Ano ang isang pangyayari ngayon na nakaapekto sa iyong mood? Paano mo ito mahahandle? (What's one thing today that affected your mood? How did you handle it?)",
  "What are three things you're grateful for today, and why?",
  "Describe a moment today that made you feel peaceful or happy.",
  "Is there something on your mind that you need to let go of? Write it down.",
  "What did you learn about yourself today?"
];

export default function JournalEntryPage() {
  const [title, setTitle] = useState("");
  const [userLanguage, setUserLanguage] = useState<string>("English");
  const [content, setContent] = useState("");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sentimentResult, setSentimentResult] = useState<{
    sentiment: string;
    confidence: number;
    positivePercentage: number;
    negativePercentage: number;
    distressPercentage: number;
  } | null>(null);
  const maxWords = 10000;
  const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient() as any;
  const editorRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    const fetchProfileLanguage = async () => {
      if (!user) return;
      try {
        const { data } = await supabase.from("user_profiles").select("language").eq("id", user.id).single();
        if (data?.language) setUserLanguage(data.language);
      } catch (err) {
        console.error("Failed to fetch user profile language:", err);
      }
    };

    void fetchProfileLanguage();
  }, [user, supabase]);

  useEffect(() => {
    setCurrentPrompt(prompts[Math.floor(Math.random() * prompts.length)]);
  }, []);

  useEffect(() => {
    const moodParam = searchParams?.get("mood");
    if (moodParam) {
      setSelectedMood(moodParam);
    }
  }, [searchParams]);

  const resetEntryForm = () => {
    setTitle("");
    setContent("");
    setSelectedMood(null);
    setSentimentResult(null);
    setShowEmojiPicker(false);
    setAutoSaveStatus("idle");
  };

  // Auto-save draft to localStorage
  useEffect(() => {
    if (isSubmitting) return;

    if (!title && !content && !selectedMood) {
      setAutoSaveStatus("idle");
      return;
    }

    setAutoSaveStatus("saving");
    const timer = setTimeout(() => {
      localStorage.setItem("journal_draft", JSON.stringify({
        title,
        content,
        selectedMood,
        timestamp: Date.now()
      }));
      setAutoSaveStatus("saved");
    }, 1000);

    return () => clearTimeout(timer);
  }, [title, content, selectedMood, isSubmitting]);

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem("journal_draft");
    if (savedDraft) {
      const draft = JSON.parse(savedDraft);
      const now = Date.now();
      const draftAge = now - draft.timestamp;
      if (draftAge < 1000 * 60 * 60 * 24) { // Only load if less than 24h old
        setTitle(draft.title);
        setContent(draft.content);
        setSelectedMood(draft.selectedMood);
      }
    }
  }, []);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.emoji-picker-wrapper')) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const saveEntry = async (e?: FormEvent) => {
    e?.preventDefault();
    if (isSubmittingRef.current) return;
    if (!user) return;

    const entryTitle = title.trim();
    const entryContent = content.trim();
    const entryMood = selectedMood;

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setLoading(true);
      setAutoSaveStatus("saving");

      // ---- 1. Save journal entry first ----
      const { data, error } = await supabase
        .from("journal_entries")
        .insert({
          user_id: user.id,
          title: entryTitle || null,
          content: entryContent || null,
          mood: entryMood,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error saving entry:", error);
        return;
      }
      const entryId = data?.id;

      // ---- 2. Call XLM-RoBERTa sentiment API (persists prediction to DB) ----
      try {
        const sentimentRes = await fetch("/api/sentiment/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: entryTitle,
            content: entryContent,
            mood: entryMood,
            entryId,
          }),
        });
        if (!sentimentRes.ok) {
          const errBody = await sentimentRes.json().catch(() => ({}));
          console.warn(
            "Sentiment API returned non-ok status, continuing with fallback distress check:",
            errBody
          );
        } else {
          const analysis = await sentimentRes.json();
          setSentimentResult({
            sentiment: analysis.sentiment,
            confidence: Number(analysis.confidence ?? 0),
            positivePercentage: Number(analysis.positivePercentage ?? 0),
            negativePercentage: Number(analysis.negativePercentage ?? 0),
            distressPercentage: Number(analysis.distressPercentage ?? 0),
          });

          // Ensure the client explicitly refreshes ACI after the persisted
          // sentiment is available, even when the server-side trigger is delayed.
          await fetch("/api/aci", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entryId }),
          });
        }
      } catch (sentErr) {
        console.error(
          "Failed to call sentiment API (continuing anyway):",
          sentErr
        );
      }

      // ---- 3. Write mood_log + activity_log (fire-and-forget, never block save) ----
      if (entryMood) {
        const moodScore = getMoodScore(entryMood);
        void Promise.all([
          // mood_logs: one row per journal save with the selected mood + numeric score
          supabase.from("mood_logs").insert({
            user_id: user.id,
            mood: entryMood,
            score: moodScore,
            notes: null,
          }),
          // activity_logs: record that the user created a journal entry
          supabase.from("activity_logs").insert({
            user_id: user.id,
            action: "journal_entry_created",
            details: `Entry saved - mood: ${entryMood}`,
          }),
        ]).catch((err: unknown) =>
          console.error("[journal/save] mood_logs/activity_logs write failed:", err)
        );
      } else {
        // Even without a mood, still log the activity
        void Promise.resolve(
          supabase.from("activity_logs").insert({
            user_id: user.id,
            action: "journal_entry_created",
            details: "Entry saved (no mood selected)",
          })
        ).catch((err: unknown) =>
          console.error("[journal/save] activity_logs write failed:", err)
        );
      }

      // ---- 4. Distress alert logic ----
      await createDistressAlertForJournalEntry(supabase, {
        userId: user.id,
        entryId,
        title: entryTitle,
        content: entryContent,
        mood: entryMood,
      });

      localStorage.removeItem("journal_draft");
      resetEntryForm();
      router.push("/journal/history");
    } catch (error) {
      console.error("Error saving entry:", error);
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const discardDraft = () => {
    if (confirm("Discard this draft?")) {
      localStorage.removeItem("journal_draft");
      resetEntryForm();
    }
  };

  const handleFormat = (command: string) => {
    document.execCommand(command, false);
  };

  const insertEmoji = (emoji: string) => {
    setContent(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between">
          <Link href="/journal/history">
            <Button variant="secondary" size="sm">
              ← Back to History
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-xs text-dark-text/70">
            <span>{autoSaveStatus === "saving" ? "⏳" : autoSaveStatus === "saved" ? "✅" : "🔵"}</span>
            <span>{autoSaveStatus === "saving" ? "Saving..." : autoSaveStatus === "saved" ? "Draft saved" : "Auto-save"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-dark-text/70">
          <span>🔒</span>
          <span>Private</span>
        </div>
      </div>

      {/* Date */}
      <div className="text-xs text-dark-text/70 mb-4">
        {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </div>

      {/* Title Input */}
      <div className="mb-6">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Give this entry a title... (optional)"
          className="w-full text-xl font-dm-serif text-dark-text bg-transparent border-0 focus:ring-0 placeholder-dark-text/40"
        />
      </div>

      {/* Mood Selector */}
      <div className="mb-6">
        <p className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-3">How are you feeling?</p>
        <div className="flex flex-wrap gap-2">
          {moods.map((mood) => (
            <button
              key={mood.label}
              onClick={() => setSelectedMood(selectedMood === mood.label ? null : mood.label)}
              className={`px-3 py-1.5 rounded-full text-xs font-poppins flex items-center gap-1.5 transition-all ${selectedMood === mood.label
                ? "bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] text-white shadow-md"
                : "bg-white text-dark-text border border-gray-100 hover:border-[#A8DADC]"
                }`}
            >
              <span className="text-base">{mood.emoji}</span>
              <span>{mood.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Writing Tip Card */}
      <Card className="mb-6 p-4 bg-gradient-to-r from-[#EAF7F8]/60 to-[#CDB4DB]/30 border-0">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-lg">
            💭
          </div>
          <div className="flex-1">
            <p className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-1">AI Reflection Prompt</p>
            <p className="text-sm font-inter text-dark-text leading-relaxed">
              {currentPrompt}
            </p>
          </div>
          <button
            className="text-xs font-poppins text-dark-text/70 hover:text-dark-text"
            onClick={() => setCurrentPrompt(prompts[Math.floor(Math.random() * prompts.length)])}
          >
            New prompt →
          </button>
        </div>
      </Card>

      {/* Editor */}
      <Card className="mb-6 p-0">
        {/* Editor Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 relative">
          <div className="relative emoji-picker-wrapper">
            <button
              className="p-1.5 rounded hover:bg-light-gray text-dark-text/70 flex items-center gap-1 text-xs font-poppins"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <span className="text-base">😊</span>
              Emoji
            </button>
            {showEmojiPicker && (
              <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 w-64 max-w-[calc(100vw-2rem)] max-h-48 overflow-y-auto">
                <div className="grid grid-cols-8 gap-1">
                  {commonEmojis.map((emoji, index) => (
                    <button
                      key={index}
                      className="w-7 h-7 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors"
                      onClick={() => insertEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            className="p-1.5 rounded hover:bg-light-gray text-dark-text/70 flex items-center gap-1 text-xs font-poppins"
            onClick={() => {
              if ("webkitSpeechRecognition" in window) {
                const recognition = new (window as any).webkitSpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = false;
                recognition.onresult = (event: any) => {
                  const transcript = event.results[0][0].transcript;
                  setContent(prev => prev + transcript);
                };
                recognition.start();
              } else {
                alert("Voice input not supported in this browser.");
              }
            }}
          >
            <span className="text-base">🎤</span>
            Voice
          </button>
          <div className="flex-1"></div>
          <button
            className="px-2 py-1 rounded-full text-xs font-poppins bg-[#A8DADC]/30 text-dark-text flex items-center gap-1 cursor-default"
            aria-disabled="true"
            title={`Language: ${userLanguage}`}
          >
            <span className="text-base">🔤</span>
            {userLanguage === "Taglish" ? "Taglish Mode" : "English Mode"}
          </button>
        </div>
        {/* Editor Content */}
        <div className="p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your thoughts here..."
            className="w-full min-h-[300px] text-sm font-inter text-dark-text bg-transparent border-0 focus:ring-0 outline-none resize-none whitespace-pre-wrap"
          />
        </div>
      </Card>

      {sentimentResult && (
        <Card className="mb-6 border border-primary-blue/20 bg-primary-blue/5 p-4">
          <p className="text-xs font-poppins font-semibold uppercase tracking-wide text-dark-text/60">
            XLM-RoBERTa analysis complete
          </p>
          <p className="mt-1 text-sm font-poppins text-dark-text">
            {sentimentResult.sentiment} · {Math.round(sentimentResult.confidence * 100)}% confidence
          </p>
          <p className="mt-1 text-xs font-inter text-dark-text/60">
            Positive {sentimentResult.positivePercentage}% · Negative {sentimentResult.negativePercentage}% · Distress {sentimentResult.distressPercentage}%
          </p>
        </Card>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-inter text-dark-text/60">
          {wordCount} / {maxWords} words
        </span>
        <form onSubmit={saveEntry} className="flex items-center gap-3">
          <Button variant="secondary" size="sm" type="button" onClick={discardDraft}>
            Discard Draft
          </Button>
          <Button size="sm" type="submit" disabled={isSubmitting || loading}>
            {isSubmitting || loading ? "Saving..." : "Save Entry"}
          </Button>
        </form>
      </div>
    </>
  );
}
