"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function MoodInsightsPage() {
  const [timeRange, setTimeRange] = useState("Week");

  const moodColors = {
    "Joy & Hope": "#A8DADC",
    "Calm & Neutral": "#B8E0D2",
    "Uncertainty": "#CDB4DB",
    "Anxiety / Stress": "#F4A6A6"
  };

  const topKeywords = [
    { word: "hope", color: "#B7E4C7" },
    { word: "school", color: "#A8DADC" },
    { word: "grateful", color: "#CDB4DB" },
    { word: "pagod", color: "#B8E0D2" },
    { word: "friends", color: "#A8DADC" },
    { word: "stress", color: "#F4A6A6" },
    { word: "family", color: "#B7E4C7" },
    { word: "tired", color: "#CDB4DB" },
    { word: "kaya ko", color: "#A8DADC" },
    { word: "rest", color: "#B7E4C7" },
    { word: "overwhelmed", color: "#CDB4DB" },
    { word: "growth", color: "#A8DADC" },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-dm-serif text-[#4F4F4F] mb-2">Mood Insights</h1>
          <p className="text-sm font-inter text-[#4F4F4F]/70">Your emotional journey over time</p>
        </div>
        <div className="flex items-center gap-2">
          {["Week", "Month", "3 Months", "All Time"].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-full text-xs font-poppins transition-all ${
                timeRange === range
                  ? "bg-[#A8DADC] text-white shadow-md"
                  : "bg-white text-[#4F4F4F] hover:bg-[#F5F5F5]"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#4F4F4F]/60 text-xs font-poppins mb-1">Total Entries</p>
              <p className="text-2xl font-bold text-[#4F4F4F]">47</p>
            </div>
            <div className="w-10 h-10 bg-[#A8DADC]/30 rounded-full flex items-center justify-center">
              <span className="text-lg">📝</span>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#4F4F4F]/60 text-xs font-poppins mb-1">Positive Entries</p>
              <p className="text-2xl font-bold text-[#4F4F4F]">62%</p>
            </div>
            <div className="w-10 h-10 bg-[#B7E4C7]/40 rounded-full flex items-center justify-center">
              <span className="text-lg">😊</span>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#4F4F4F]/60 text-xs font-poppins mb-1">Current Streak</p>
              <p className="text-2xl font-bold text-[#4F4F4F]">12</p>
            </div>
            <div className="w-10 h-10 bg-[#FFE8A1]/40 rounded-full flex items-center justify-center">
              <span className="text-lg">🔥</span>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#4F4F4F]/60 text-xs font-poppins mb-1">Mood Growth</p>
              <p className="text-2xl font-bold text-[#4F4F4F]">+18%</p>
            </div>
            <div className="w-10 h-10 bg-[#CDB4DB]/30 rounded-full flex items-center justify-center">
              <span className="text-lg">📈</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Mood Trajectory Chart */}
          <Card className="p-6">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-[#4F4F4F]/60 mb-6">
              Mood Trajectory — This Month
            </h3>
            <div className="relative h-48 w-full">
              {/* Chart Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between py-2">
                <div className="h-px bg-[#F5F5F5] w-full"></div>
                <div className="h-px bg-[#F5F5F5] w-full"></div>
                <div className="h-px bg-[#F5F5F5] w-full"></div>
                <div className="h-px bg-[#F5F5F5] w-full"></div>
              </div>
              {/* X-Axis Labels */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] font-inter text-[#4F4F4F]/60 px-2 pb-1">
                <span>May 1</span>
                <span>May 7</span>
                <span>May 14</span>
                <span>May 21</span>
                <span>May 28</span>
              </div>
              {/* Area Chart */}
              <svg className="w-full h-full" viewBox="0 0 400 150" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#A8DADC" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#CDB4DB" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                <path d="M0,110 Q50,80 100,90 T200,70 T300,50 T400,40 L400,150 L0,150 Z" fill="url(#areaGradient)" />
                <path d="M0,110 Q50,80 100,90 T200,70 T300,50 T400,40" fill="none" stroke="#A8DADC" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M0,115 Q50,90 100,100 T200,80 T300,60 T400,50" fill="none" stroke="#CDB4DB" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 3" />
              </svg>
              {/* Legend */}
              <div className="absolute bottom-6 left-2 flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[10px] font-inter text-[#4F4F4F]">
                  <div className="w-3 h-1 bg-[#A8DADC] rounded-full"></div>
                  <span>Positive</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-inter text-[#4F4F4F]/70">
                  <div className="w-3 h-1 bg-[#CDB4DB] rounded-full"></div>
                  <span>Negative</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Journaling Calendar */}
          <Card className="p-6">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-[#4F4F4F]/60 mb-4 flex items-center gap-2">
              <span>🗓️</span>
              Journaling Calendar — May 2026
            </h3>
            <div className="mb-4 grid grid-cols-7 gap-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                <div key={i} className="text-center text-[10px] font-poppins text-[#4F4F4F]/60 py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => {
                let date = i - 3;
                let color;
                if (date < 1 || date > 31) {
                  color = "bg-transparent";
                } else if ([1, 2, 5, 8, 9, 12, 13, 17, 18, 22, 23, 24, 25, 27, 28].includes(date)) {
                  color = "bg-[#A8DADC]";
                } else if ([3, 10, 19, 20, 26].includes(date)) {
                  color = "bg-[#CDB4DB]";
                } else if ([11].includes(date)) {
                  color = "bg-[#F4A6A6]";
                } else if ([4, 7, 14, 15, 16, 21, 29, 30, 31].includes(date)) {
                  color = "bg-[#F5F5F5]";
                } else {
                  color = "bg-white border border-[#F5F5F5]";
                }
                
                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-sm flex items-center justify-center text-[10px] font-inter text-[#4F4F4F] ${color}`}
                  >
                    {date >= 1 && date <= 31 ? date : ""}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-3 text-[10px] font-inter text-[#4F4F4F]/60">
              <span>Less</span>
              <div className="w-3 h-3 bg-[#CDB4DB] rounded-sm"></div>
              <div className="w-3 h-3 bg-[#A8DADC] rounded-sm"></div>
              <div className="w-3 h-3 bg-[#B8E0D2] rounded-sm"></div>
              <span>More positive</span>
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Emotion Distribution */}
          <Card className="p-6">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-[#4F4F4F]/60 mb-6 flex items-center gap-2">
              <span>🎨</span>
              Emotion Distribution
            </h3>
            <div className="flex items-center gap-6">
              {/* Pie Chart */}
              <div className="relative w-32 h-32">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke={moodColors["Joy & Hope"]} strokeWidth="12" strokeDasharray="201 251" transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke={moodColors["Calm & Neutral"]} strokeWidth="12" strokeDasharray="63 251" strokeDashoffset="-201" transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke={moodColors["Uncertainty"]} strokeWidth="12" strokeDasharray="50 251" strokeDashoffset="-264" transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke={moodColors["Anxiety / Stress"]} strokeWidth="12" strokeDasharray="38 251" strokeDashoffset="-314" transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="25" fill="white" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xl font-dm-serif text-[#4F4F4F]">62%</p>
                    <p className="text-[10px] font-inter text-[#4F4F4F]/60">Positive</p>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-2">
                {Object.entries(moodColors).map(([label, color], i) => {
                  let percentage;
                  if (i === 0) percentage = "62%";
                  else if (i === 1) percentage = "18%";
                  else if (i === 2) percentage = "14%";
                  else percentage = "8%";

                  return (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                        <span className="text-xs font-inter text-[#4F4F4F]">{label}</span>
                      </div>
                      <span className="text-xs font-poppins text-[#4F4F4F]/70">{percentage}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Top Emotional Keywords */}
          <Card className="p-6">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-[#4F4F4F]/60 mb-4 flex items-center gap-2">
              <span>🔤</span>
              Top Emotional Keywords
            </h3>
            <div className="flex flex-wrap gap-2">
              {topKeywords.map((keyword, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-full text-xs font-inter text-[#4F4F4F]"
                  style={{ backgroundColor: `${keyword.color}40` }}
                >
                  {keyword.word}
                </span>
              ))}
            </div>

            {/* Emotional Trend */}
            <div className="mt-6 pt-4 border-t border-[#F5F5F5]">
              <h4 className="text-xs font-poppins uppercase tracking-wider text-[#4F4F4F]/60 mb-4 flex items-center gap-2">
                <span>📉</span>
                Emotional Trend
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-inter text-[#4F4F4F] mb-1">
                    <span>Positivity trend</span>
                    <span className="text-[#A8DADC]">↑ Growing</span>
                  </div>
                  <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#A8DADC] to-[#B7E4C7] rounded-full" style={{ width: "78%" }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-inter text-[#4F4F4F] mb-1">
                    <span>Stress levels</span>
                    <span className="text-[#F4A6A6]">↓ Decreasing</span>
                  </div>
                  <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#F4A6A6] to-[#FFE8A1] rounded-full" style={{ width: "35%" }}></div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}