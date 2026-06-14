"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ProtectedLayout from "@/components/layout/ProtectedLayout";

export default function JournalEntryPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const maxWords = 10000;
  const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;

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

  return (
    <ProtectedLayout activePage="journal">
      {/* Main Content */}
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-[#4F4F4F]/70">
              <span>🔵</span>
              <span>Auto-saved just now</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#4F4F4F]/70">
              <span>🔒</span>
              <span>Private</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-3 py-1 rounded-full text-xs font-poppins text-[#4F4F4F] hover:bg-white">
              Discard
            </button>
            <button className="px-4 py-2 rounded-full text-xs font-poppins bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] text-white hover:opacity-90">
              Analyze with AI →
            </button>
          </div>
        </div>

        {/* Date */}
        <div className="text-xs text-[#4F4F4F]/70 mb-4">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>

        {/* Title Input */}
        <div className="mb-6">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give this entry a title... (optional)"
            className="w-full text-xl font-dm-serif text-[#4F4F4F] bg-transparent border-0 focus:ring-0 placeholder-[#4F4F4F]/40"
          />
        </div>

        {/* Mood Selector */}
        <div className="mb-6">
          <p className="text-xs font-poppins uppercase tracking-wider text-[#4F4F4F]/60 mb-3">How are you feeling?</p>
          <div className="flex flex-wrap gap-2">
            {moods.map((mood) => (
              <button
                key={mood.label}
                onClick={() => setSelectedMood(selectedMood === mood.label ? null : mood.label)}
                className={`px-3 py-1.5 rounded-full text-xs font-poppins flex items-center gap-1.5 transition-all ${
                  selectedMood === mood.label
                    ? "bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] text-white shadow-md"
                    : "bg-white text-[#4F4F4F] border border-gray-100 hover:border-[#A8DADC]"
                }`}
              >
                <span className="text-base">{mood.emoji}</span>
                <span>{mood.label}</span>
              </button>
            ))}
            <button className="px-3 py-1.5 rounded-full text-xs font-poppins bg-white text-[#A8DADC] border border-[#A8DADC] flex items-center gap-1.5 hover:bg-[#A8DADC]/10">
              + Add emotion
            </button>
          </div>
        </div>

        {/* Writing Tip Card */}
        <Card className="mb-6 p-4 bg-gradient-to-r from-[#EAF7F8]/60 to-[#CDB4DB]/30 border-0">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-lg">
              💭
            </div>
            <div className="flex-1">
              <p className="text-xs font-poppins uppercase tracking-wider text-[#4F4F4F]/60 mb-1">AI Reflection Prompt</p>
              <p className="text-sm font-inter text-[#4F4F4F] leading-relaxed">
                "Ano ang isang pangyayari ngayon na nakaapekto sa iyong mood? Paano mo ito kinabayaan? (What's one thing today that affected your mood? How did you handle it?)"
              </p>
            </div>
            <button className="text-xs font-poppins text-[#4F4F4F]/70 hover:text-[#4F4F4F]">
              New prompt →
            </button>
          </div>
        </Card>

        {/* Editor */}
        <Card className="mb-6 p-0">
          {/* Editor Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100">
            <button className="p-1.5 rounded hover:bg-[#F5F5F5] text-[#4F4F4F]/70">
              <span className="text-base">𝐁</span>
            </button>
            <button className="p-1.5 rounded hover:bg-[#F5F5F5] text-[#4F4F4F]/70">
              <span className="text-base">𝑰</span>
            </button>
            <button className="p-1.5 rounded hover:bg-[#F5F5F5] text-[#4F4F4F]/70">
              <span className="text-base">𝙐</span>
            </button>
            <div className="w-px h-4 bg-gray-200"></div>
            <button className="p-1.5 rounded hover:bg-[#F5F5F5] text-[#4F4F4F]/70 flex items-center gap-1 text-xs font-poppins">
              <span className="text-base">😊</span>
              Emoji
            </button>
            <button className="p-1.5 rounded hover:bg-[#F5F5F5] text-[#4F4F4F]/70 flex items-center gap-1 text-xs font-poppins">
              <span className="text-base">🎤</span>
              Voice
            </button>
            <div className="flex-1"></div>
            <button className="px-2 py-1 rounded-full text-xs font-poppins bg-[#A8DADC]/30 text-[#4F4F4F] flex items-center gap-1">
              <span className="text-base">🔤</span>
              Taglish Mode
            </button>
          </div>
          {/* Editor Textarea */}
          <div className="p-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Magpahinga ng sumulat dito... Write freely in English, Tagalog, or Taglish. There's no right or wrong — just you and your thoughts.

Example: 'Ngayon, feeling ko parang overwhelmed sa school pero I know I can get through it...'"
              className="w-full min-h-[300px] text-sm font-inter text-[#4F4F4F] bg-transparent border-0 focus:ring-0 placeholder-[#4F4F4F]/40 resize-vertical"
            />
          </div>
        </Card>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-inter text-[#4F4F4F]/60">
            {wordCount} / {maxWords} words
          </span>
          <div className="flex items-center gap-3">
            <Button variant="secondary" className="text-xs">
              <span className="mr-1.5">💾</span>
              Save Draft
            </Button>
            <Button className="text-xs">
              <span className="mr-1.5">🔍</span>
              Analyze Emotions →
            </Button>
          </div>
        </div>
    </ProtectedLayout>
  );
}