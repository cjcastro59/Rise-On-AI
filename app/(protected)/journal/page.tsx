"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { createDistressAlertForJournalEntry } from "@/lib/distress-alerts";
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
  const [content, setContent] = useState("");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const maxWords = 10000;
  const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient() as any;
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentPrompt(prompts[Math.floor(Math.random() * prompts.length)]);
  }, []);

  useEffect(() => {
    const moodParam = searchParams?.get("mood");
    if (moodParam) {
      setSelectedMood(moodParam);
    }
  }, [searchParams]);

  // Auto-save draft to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      if (title || content || selectedMood) {
        localStorage.setItem("journal_draft", JSON.stringify({
          title,
          content,
          selectedMood,
          timestamp: Date.now()
        }));
        setAutoSaveStatus("saved");
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [title, content, selectedMood]);

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

  const saveEntry = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("journal_entries")
        .insert({
          user_id: user.id,
          title: title || null,
          content: content || null,
          mood: selectedMood,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error saving entry:", error);
        return;
      }

      await createDistressAlertForJournalEntry(supabase, {
        userId: user.id,
        entryId: data?.id,
        title,
        content,
        mood: selectedMood,
      });

      localStorage.removeItem("journal_draft");
      router.push(`/analysis?entryId=${data.id}`);
    } catch (error) {
      console.error("Error saving entry:", error);
    } finally {
      setLoading(false);
    }
  };

  const discardDraft = () => {
    if (confirm("Discard this draft?")) {
      localStorage.removeItem("journal_draft");
      setTitle("");
      setContent("");
      setSelectedMood(null);
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
      <div className="flex items-center justify-between mb-6">
        <Link href="/journal/history">
          <Button variant="secondary" size="sm">
            ← Back to History
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-dark-text/70">
            <span>{autoSaveStatus === "saving" ? "⏳" : autoSaveStatus === "saved" ? "✅" : "🔵"}</span>
            <span>{autoSaveStatus === "saving" ? "Saving..." : autoSaveStatus === "saved" ? "Draft saved" : "Auto-save"}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-dark-text/70">
            <span>🔒</span>
            <span>Private</span>
          </div>
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
              <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 w-64 max-h-48 overflow-y-auto">
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
          <button className="px-2 py-1 rounded-full text-xs font-poppins bg-[#A8DADC]/30 text-dark-text flex items-center gap-1">
            <span className="text-base">🔤</span>
            Taglish Mode
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

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-inter text-dark-text/60">
          {wordCount} / {maxWords} words
        </span>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={discardDraft}>
            Discard Draft
          </Button>
          <Button size="sm" onClick={saveEntry} disabled={loading}>
            {loading ? "Saving..." : "Save Entry"}
          </Button>
        </div>
      </div>
    </>
  );
}
