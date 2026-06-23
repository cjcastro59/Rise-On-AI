"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AIAnalysisPage() {
  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <p className="text-xs text-[#4F4F4F]/60 font-poppins mb-2">Analysis for • May 28, 2026</p>
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-dm-serif text-[#4F4F4F]">Emotional Analysis Complete</h1>
          <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-[#B7E4C7] to-[#A8DADC] rounded-full">
            <span className="text-xs font-poppins text-[#4F4F4F]">😊 Mostly Positive — 72%</span>
          </div>
        </div>
        
        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-2 px-3 py-1 bg-[#A8DADC]/30 rounded-full">
            <span className="text-xs">📝</span>
            <span className="text-xs font-poppins text-[#4F4F4F]">Wrote Entry</span>
          </div>
          <div className="text-xs text-[#4F4F4F]/40">→</div>
          <div className="flex items-center gap-2 px-3 py-1 bg-[#A8DADC]/30 rounded-full">
            <span className="text-xs">🧠</span>
            <span className="text-xs font-poppins text-[#4F4F4F]">AI Analyzed</span>
          </div>
          <div className="text-xs text-[#4F4F4F]/40">→</div>
          <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] rounded-full">
            <span className="text-xs">✨</span>
            <span className="text-xs font-poppins text-white">Insights Ready</span>
          </div>
          <div className="text-xs text-[#4F4F4F]/40">→</div>
          <div className="flex items-center gap-2 px-3 py-1 bg-[#F5F5F5] rounded-full">
            <span className="text-xs">📊</span>
            <span className="text-xs font-poppins text-[#4F4F4F]/60">Track Over Time</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Sentiment Breakdown Card */}
          <Card className="p-6">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-[#4F4F4F]/60 mb-4 flex items-center gap-2">
              <span>📊</span>
              Sentiment Breakdown
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-inter text-[#4F4F4F]">
                  <span>Positive</span>
                  <span>72%</span>
                </div>
                <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#A8DADC] to-[#B7E4C7] rounded-full" style={{ width: "72%" }}></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-inter text-[#4F4F4F]">
                  <span>Neutral</span>
                  <span>18%</span>
                </div>
                <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                  <div className="h-full bg-[#A8DADC]/60 rounded-full" style={{ width: "18%" }}></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-inter text-[#4F4F4F]">
                  <span>Negative</span>
                  <span>10%</span>
                </div>
                <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                  <div className="h-full bg-[#F4A6A6] rounded-full" style={{ width: "10%" }}></div>
                </div>
              </div>
            </div>
          </Card>

          {/* Detected Emotions Card */}
          <Card className="p-6">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-[#4F4F4F]/60 mb-4 flex items-center gap-2">
              <span>🌈</span>
              Detected Emotions
            </h3>
            <div className="flex flex-wrap gap-2">
              <div className="px-3 py-1.5 bg-[#B7E4C7]/40 rounded-full text-xs font-poppins text-[#4F4F4F] flex items-center gap-1.5">
                <span className="text-base">😊</span>
                <span>Joy — 65%</span>
              </div>
              <div className="px-3 py-1.5 bg-[#FFE8A1]/40 rounded-full text-xs font-poppins text-[#4F4F4F] flex items-center gap-1.5">
                <span className="text-base">😌</span>
                <span>Hope — 54%</span>
              </div>
              <div className="px-3 py-1.5 bg-[#CDB4DB]/40 rounded-full text-xs font-poppins text-[#4F4F4F] flex items-center gap-1.5">
                <span className="text-base">😰</span>
                <span>Uncertainty — 28%</span>
              </div>
              <div className="px-3 py-1.5 bg-[#F4A6A6]/30 rounded-full text-xs font-poppins text-[#4F4F4F] flex items-center gap-1.5">
                <span className="text-base">😔</span>
                <span>Mild Anxiety — 20%</span>
              </div>
            </div>
          </Card>

          {/* Key Phrases Card */}
          <Card className="p-6">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-[#4F4F4F]/60 mb-4 flex items-center gap-2">
              <span>🔑</span>
              Key Phrases Detected
            </h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 bg-[#EAF7F8] rounded-full text-xs font-inter text-[#4F4F4F]">
                "Ngayon, feeling ko parang overwhelmed sa school"
              </span>
              <span className="px-3 py-1.5 bg-[#CDB4DB]/20 rounded-full text-xs font-inter text-[#4F4F4F]">
                pero I know I can get through it
              </span>
              <span className="px-3 py-1.5 bg-[#B8E0D2]/30 rounded-full text-xs font-inter text-[#4F4F4F]">
                Kailangan ko lang ng pahinga at
              </span>
              <span className="px-3 py-1.5 bg-[#A8DADC]/30 rounded-full text-xs font-inter text-[#4F4F4F]">
                support ng mga mahal ko
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F5F5F5] flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-[#F5F5F5] rounded text-xs font-inter text-[#4F4F4F]/70 flex items-center gap-1">
                <span>📝</span>
                Stressor
              </span>
              <span className="px-2 py-1 bg-[#B7E4C7]/40 rounded text-xs font-inter text-[#4F4F4F] flex items-center gap-1">
                <span>💪</span>
                Resilience
              </span>
              <span className="px-2 py-1 bg-[#B8E0D2]/40 rounded text-xs font-inter text-[#4F4F4F] flex items-center gap-1">
                <span>❤️</span>
                Support Mood
              </span>
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* AI Reflection Card */}
          <Card className="p-6 bg-gradient-to-br from-[#EAF7F8]/60 to-[#CDB4DB]/30">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-[#4F4F4F]/60 mb-4 flex items-center gap-2">
              <span>🤖</span>
              AI Reflection
            </h3>
            <p className="text-sm font-inter text-[#4F4F4F] leading-relaxed mb-4">
              "Your entry shows a strong emotional core — you're aware of your stress (academic pressure is real!) but you're actively choosing hope and support-seeking. That's a significant sign of emotional maturity and resilience. 💪"
            </p>
            
            <h4 className="text-xs font-poppins uppercase tracking-wider text-[#4F4F4F]/70 mb-3">Personalized Suggestions</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-white/70 rounded-lg">
                <span>🧘</span>
                <span className="text-xs font-inter text-[#4F4F4F]">Try a 5-minute study break with deep breathing</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-white/70 rounded-lg">
                <span>👥</span>
                <span className="text-xs font-inter text-[#4F4F4F]">Reach out to a trusted friend or counselor today</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-white/70 rounded-lg">
                <span>📖</span>
                <span className="text-xs font-inter text-[#4F4F4F]">Journal again tomorrow to track your progress</span>
              </div>
            </div>
          </Card>

          {/* Emotional Complexity Score */}
          <Card className="p-8 text-center">
            <h3 className="text-sm font-poppins uppercase tracking-wider text-[#4F4F4F]/60 mb-8 flex items-center gap-2 justify-center">
              <span>🧠</span>
              Emotional Complexity Score
            </h3>
            <div className="relative w-48 h-48 mx-auto mb-8">
              {/* Progress Circle */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#F5F5F5" strokeWidth="10" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="url(#gradient)" strokeWidth="10" strokeDasharray="283" strokeDashoffset="74" strokeLinecap="round" />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#A8DADC" />
                    <stop offset="100%" stopColor="#CDB4DB" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-5xl font-dm-serif text-[#4F4F4F]">7.4</span>
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
          <button className="flex-1 max-w-xs py-4 rounded-full bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] text-[#4F4F4F] font-poppins font-medium text-base transition-opacity hover:opacity-90">
            View Mood Trends →
          </button>
          <button className="flex-1 max-w-xs py-4 rounded-full border border-[#A8DADC] text-[#4F4F4F] font-poppins font-medium text-base bg-white transition-colors hover:bg-[#F5F5F5]">
            Save & Return
          </button>
        </div>
        <p className="text-[#F4A6A6] font-inter text-sm mt-2 flex items-center gap-2">
          Feeling distressed? <span className="text-[#F4A6A6] font-semibold">🆘 Get immediate support</span>
        </p>
      </div>
    </>
  );
}