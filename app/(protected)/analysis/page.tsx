"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { analyzeEntry, type AnalysisResult } from "@/lib/sentiment";
import Link from "next/link";

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

export default function AIAnalysisPage() {
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entryId = searchParams?.get("entryId");
  const supabase = useMemo(() => createClient(), []);

  const fetchEntry = useCallback(async () => {
    if (!user || !entryId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("id", entryId)
        .single();

      if (error) {
        console.error("Error fetching entry:", error);
        router.push("/journal/history");
        return;
      }

      if (data) {
        setEntry(data);
        setAnalysis(analyzeEntry(data.content, data.mood));
      }
    } catch (error) {
      console.error("Error fetching entry:", error);
    } finally {
      setLoading(false);
    }
  }, [user, entryId, router, supabase]);

  useEffect(() => {
    if (user) {
      fetchEntry();
    }
  }, [fetchEntry, user]);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  };

  const getSentimentLabel = (sentiment: string): string => {
    switch (sentiment) {
      case "positive":
        return "Mostly Positive";
      case "negative":
        return "Mostly Negative";
      case "distress":
        return "Distress Detected";
      default:
        return "Neutral";
    }
  };

  const getSentimentEmoji = (sentiment: string): string => {
    switch (sentiment) {
      case "positive":
        return "😊";
      case "negative":
        return "😔";
      case "distress":
        return "⚠️";
      default:
        return "😐";
    }
  };

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case "positive":
        return "from-success-green to-primary-blue";
      case "negative":
        return "from-warning-yellow to-error-red";
      case "distress":
        return "from-orange-400 to-red-400";
      default:
        return "from-primary-blue to-lavender";
    }
  };

  const getEmotionColor = (emotion: string): string => {
    switch (emotion) {
      case "Joy":
      case "Hope":
        return "bg-success-green/40 border-success-green/30";
      case "Calm":
        return "bg-[#A8DADC]/40 border-[#A8DADC]/30";
      case "Anxiety":
      case "Sadness":
      case "Stress":
        return "bg-error-red/35 border-error-red/30";
      default:
        return "bg-lavender/40 border-lavender/30";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-dark-text/70">Loading analysis...</p>
      </div>
    );
  }

  if (!entry || !analysis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-dark-text/70">No entry found. Please select an entry from your journal history.</p>
        <Link href="/journal/history">
          <Button>Go to Journal History</Button>
        </Link>
      </div>
    );
  }

  const sentimentLabel = getSentimentLabel(analysis.sentiment);
  const sentimentEmoji = getSentimentEmoji(analysis.sentiment);
  const sentimentColor = getSentimentColor(analysis.sentiment);
  const wellnessScore = Math.round(analysis.sentimentScore / 10);

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <p className="text-sm text-dark-text/70 font-poppins mb-2">
          Analysis for • {formatDate(entry.created_at)}
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
          <h1 className="text-3xl font-dm-serif text-dark-text">Emotional Analysis Complete</h1>
          <div className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${sentimentColor} rounded-full shadow-sm`}>
            <span className="text-sm font-poppins text-dark-text">
              {sentimentEmoji} {sentimentLabel} — {analysis.sentimentScore}%
            </span>
          </div>
        </div>
        
        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-2 px-3 py-1 bg-[#A8DADC]/40 rounded-full">
            <span className="text-sm">📝</span>
            <span className="text-sm font-poppins text-dark-text">Wrote Entry</span>
          </div>
          <div className="text-sm text-dark-text/40">→</div>
          <div className="flex items-center gap-2 px-3 py-1 bg-[#A8DADC]/40 rounded-full">
            <span className="text-sm">🧠</span>
            <span className="text-sm font-poppins text-dark-text">AI Analyzed</span>
          </div>
          <div className="text-sm text-dark-text/50">→</div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-primary-blue to-lavender rounded-full shadow-sm">
            <span className="text-sm">✨</span>
            <span className="text-sm font-poppins text-white">Insights Ready</span>
          </div>
          <div className="text-sm text-dark-text/50">→</div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#E5E7EB] rounded-full">
            <span className="text-sm">📊</span>
            <span className="text-sm font-poppins text-dark-text">Track Over Time</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Sentiment Breakdown Card */}
          <Card className="p-6 bg-white shadow-sm">
            <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-4 flex items-center gap-2">
              <span>📊</span>
              Sentiment Breakdown
            </h3>
            <div className="space-y-5">
              <div className="space-y-1">
                <div className="flex justify-between text-sm font-inter text-dark-text">
                  <span>Positive</span>
                  <span className="font-semibold">{analysis.positivePercentage}%</span>
                </div>
                <div className="h-3 bg-light-gray rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-blue to-success-green rounded-full" style={{ width: `${analysis.positivePercentage}%` }}></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm font-inter text-dark-text">
                  <span>Negative</span>
                  <span className="font-semibold">{analysis.negativePercentage}%</span>
                </div>
                <div className="h-3 bg-light-gray rounded-full overflow-hidden">
                  <div className="h-full bg-error-red rounded-full" style={{ width: `${analysis.negativePercentage}%` }}></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm font-inter text-dark-text">
                  <span>Distress</span>
                  <span className="font-semibold">{analysis.distressPercentage}%</span>
                </div>
                <div className="h-3 bg-light-gray rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-400 to-red-400 rounded-full" style={{ width: `${analysis.distressPercentage}%` }}></div>
                </div>
              </div>
            </div>
          </Card>

          {/* Detected Emotions Card */}
          <Card className="p-6 bg-white shadow-sm">
            <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-4 flex items-center gap-2">
              <span>🌈</span>
              Detected Emotions
            </h3>
            <div className="flex flex-wrap gap-3">
              {analysis.emotions.map((emotion, index) => (
                <div key={index} className={`px-3 py-2 ${getEmotionColor(emotion)} rounded-full text-sm font-poppins text-dark-text flex items-center gap-2 border`}>
                  <span className="text-base">{emotion === "Joy" ? "😊" : emotion === "Hope" ? "✨" : emotion === "Calm" ? "😌" : emotion === "Anxiety" ? "😰" : emotion === "Sadness" ? "😢" : emotion === "Stress" ? "😵" : "😐"}</span>
                  <span>{emotion} — {Math.round(analysis.sentimentScore / 2)}%</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Key Phrases Card */}
          {analysis.keyPhrases.length > 0 && (
            <Card className="p-6 bg-white shadow-sm">
              <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-4 flex items-center gap-2">
                <span>🔑</span>
                Key Phrases Detected
              </h3>
              <div className="flex flex-wrap gap-3">
                {analysis.keyPhrases.map((phrase, index) => (
                  <span key={index} className="px-4 py-2 bg-[#EAF7F8] rounded-full text-sm font-inter text-dark-text border border-primary-blue/20">
                    {phrase}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* AI Reflection Card */}
          <Card className="p-6 bg-white shadow-sm">
            <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-4 flex items-center gap-2">
              <span>🤖</span>
              AI Reflection
            </h3>
            <p className="text-base font-inter text-dark-text leading-relaxed mb-4">
              {analysis.feedback}
            </p>
            <p className="text-base font-inter text-dark-text/80 leading-relaxed mb-4">
              {analysis.reflection}
            </p>
            
            <h4 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-3">Personalized Suggestions</h4>
            <div className="space-y-3">
              {analysis.suggestions.map((suggestion, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-light-gray rounded-2xl">
                  <span className="text-xl">{index === 0 ? "🧘" : index === 1 ? "👥" : "📖"}</span>
                  <span className="text-sm font-inter text-dark-text">{suggestion}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Emotional Wellness Score */}
          <Card className="p-8 text-center bg-white shadow-sm">
            <h3 className="text-base font-poppins uppercase tracking-wider text-dark-text/70 mb-8 flex items-center gap-2 justify-center">
              <span>🧠</span>
              Emotional Wellness Score
            </h3>
            <div className="relative w-52 h-52 mx-auto mb-8">
              {/* Progress Circle */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#E5E7EB" strokeWidth="10" />
                <circle 
                  cx="50" cy="50" r="45" 
                  fill="none" 
                  stroke="url(#gradient)" 
                  strokeWidth="12" 
                  strokeDasharray="283" 
                  strokeDashoffset={283 - (analysis.sentimentScore / 100) * 283} 
                  strokeLinecap="round" 
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#A8DADC" />
                    <stop offset="100%" stopColor="#CDB4DB" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-5xl font-dm-serif text-[#4F4F4F]">{wellnessScore}.0</span>
                <span className="text-base font-inter text-[#A8DADC]">out of 10</span>
              </div>
            </div>
            <p className="text-base font-inter text-[#4F4F4F]/70">Emotional Wellness Score</p>
          </Card>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="mt-8 flex flex-col items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-3xl">
          <Button 
            className="flex-1 max-w-xs py-4 rounded-full bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] text-[#4F4F4F] font-poppins font-medium text-base transition-opacity hover:opacity-90"
            onClick={() => router.push("/insights")}
          >
            View Mood Trends →
          </Button>
          <Button 
            variant="secondary"
            className="flex-1 max-w-xs py-4 rounded-full border border-[#A8DADC] text-[#4F4F4F] font-poppins font-medium text-base bg-white transition-colors hover:bg-[#F5F5F5]"
            onClick={() => router.push("/journal/history")}
          >
            Save & Return
          </Button>
        </div>
        <button 
          className="text-[#F4A6A6] font-inter text-sm mt-2 flex items-center gap-2 hover:underline"
          onClick={() => router.push("/support")}
        >
          Feeling distressed? <span className="font-semibold"> Get immediate support</span>
        </button>
      </div>
    </>
  );
}
