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
        <p className="text-sm text-dark-text/70 font-poppins mb-2">Analysis for • May 28, 2026</p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
          <h1 className="text-3xl font-dm-serif text-dark-text">Emotional Analysis Complete</h1>
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-success-green to-primary-blue rounded-full shadow-sm">
            <span className="text-sm font-poppins text-dark-text">😊 Mostly Positive — 72%</span>
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
                  <span className="font-semibold">72%</span>
                </div>
                <div className="h-3 bg-light-gray rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-blue to-success-green rounded-full" style={{ width: "72%" }}></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm font-inter text-dark-text">
                  <span>Neutral</span>
                  <span className="font-semibold">18%</span>
                </div>
                <div className="h-3 bg-light-gray rounded-full overflow-hidden">
                  <div className="h-full bg-primary-blue/60 rounded-full" style={{ width: "18%" }}></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm font-inter text-dark-text">
                  <span>Negative</span>
                  <span className="font-semibold">10%</span>
                </div>
                <div className="h-3 bg-light-gray rounded-full overflow-hidden">
                  <div className="h-full bg-error-red rounded-full" style={{ width: "10%" }}></div>
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
              <div className="px-3 py-2 bg-success-green/40 rounded-full text-sm font-poppins text-dark-text flex items-center gap-2 border border-success-green/30">
                <span className="text-base">😊</span>
                <span>Joy — 65%</span>
              </div>
              <div className="px-3 py-2 bg-warning-yellow/40 rounded-full text-sm font-poppins text-dark-text flex items-center gap-2 border border-warning-yellow/30">
                <span className="text-base">😌</span>
                <span>Hope — 54%</span>
              </div>
              <div className="px-3 py-2 bg-lavender/40 rounded-full text-sm font-poppins text-dark-text flex items-center gap-2 border border-lavender/30">
                <span className="text-base">😰</span>
                <span>Uncertainty — 28%</span>
              </div>
              <div className="px-3 py-2 bg-error-red/35 rounded-full text-sm font-poppins text-dark-text flex items-center gap-2 border border-error-red/30">
                <span className="text-base">😔</span>
                <span>Mild Anxiety — 20%</span>
              </div>
            </div>
          </Card>

          {/* Key Phrases Card */}
          <Card className="p-6 bg-white shadow-sm">
            <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-4 flex items-center gap-2">
              <span>🔑</span>
              Key Phrases Detected
            </h3>
            <div className="flex flex-wrap gap-3">
              <span className="px-4 py-2 bg-[#EAF7F8] rounded-full text-sm font-inter text-dark-text border border-primary-blue/20">
                &quot;Ngayon, feeling ko parang overwhelmed sa school&quot;
              </span>
              <span className="px-4 py-2 bg-lavender/30 rounded-full text-sm font-inter text-dark-text border border-lavender/20">
                pero I know I can get through it
              </span>
              <span className="px-4 py-2 bg-teal/30 rounded-full text-sm font-inter text-dark-text border border-teal/20">
                Kailangan ko lang ng pahinga at
              </span>
              <span className="px-4 py-2 bg-primary-blue/30 rounded-full text-sm font-inter text-dark-text border border-primary-blue/20">
                support ng mga mahal ko
              </span>
            </div>
            <div className="mt-4 pt-4 border-t border-light-gray flex flex-wrap gap-2">
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
          <Card className="p-6 bg-white shadow-sm">
            <h3 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-4 flex items-center gap-2">
              <span>🤖</span>
              AI Reflection
            </h3>
            <p className="text-base font-inter text-dark-text leading-relaxed mb-4">
              {"\"Your entry shows a strong emotional core - you are aware of your stress (academic pressure is real!) and actively choosing hope and support-seeking. That is a significant sign of emotional maturity and resilience.\""}
            </p>
            
            <h4 className="text-sm font-poppins uppercase tracking-wider text-dark-text/70 mb-3">Personalized Suggestions</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-light-gray rounded-2xl">
                <span className="text-xl">🧘</span>
                <span className="text-sm font-inter text-dark-text">Try a 5-minute study break with deep breathing</span>
              </div>
              <div className="flex items-start gap-3 p-3 bg-[#F8FAFB] rounded-2xl border border-[#E5E7EB]">
                <span className="text-xl">👥</span>
                <span className="text-sm font-inter text-dark-text">Reach out to a trusted friend or counselor today</span>
              </div>
              <div className="flex items-start gap-3 p-3 bg-[#F8FAFB] rounded-2xl border border-[#E5E7EB]">
                <span className="text-xl">📖</span>
                <span className="text-sm font-inter text-dark-text">Journal again tomorrow to track your progress</span>
              </div>
            </div>
          </Card>

          {/* Emotional Complexity Score */}
          <Card className="p-8 text-center bg-white shadow-sm">
            <h3 className="text-base font-poppins uppercase tracking-wider text-dark-text/70 mb-8 flex items-center gap-2 justify-center">
              <span>🧠</span>
              Emotional Complexity Score
            </h3>
            <div className="relative w-52 h-52 mx-auto mb-8">
              {/* Progress Circle */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#E5E7EB" strokeWidth="10" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="url(#gradient)" strokeWidth="12" strokeDasharray="283" strokeDashoffset="74" strokeLinecap="round" />
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
          Feeling distressed? <span className="text-[#F4A6A6] font-semibold"> Get immediate support</span>
        </p>
      </div>
    </>
  );
}
