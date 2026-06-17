"use client";

import { Card } from "@/components/ui/card";
import { useState } from "react";

export default function AdminMoodTrendsPage() {
  const [timeFrame, setTimeFrame] = useState("Month");
  const [moodView, setMoodView] = useState("Sentiment");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-dm-serif text-[#4F4F4F] mb-1">Mood Trend Reports</h1>
          <p className="text-sm text-[#4F4F4F]/60 font-poppins">Platform-wide emotional analytics; Aggregated & anonymized</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
            <button
              onClick={() => setTimeFrame("Week")}
              className={`px-3 py-1 rounded-md text-xs font-poppins transition-all ${timeFrame === "Week" ? "bg-[#A8DADC]/30 text-[#4F4F4F]" : "text-[#4F4F4F]/60 hover:text-[#4F4F4F]"}`}
            >
              Weeks
            </button>
            <button
              onClick={() => setTimeFrame("Month")}
              className={`px-3 py-1 rounded-md text-xs font-poppins transition-all ${timeFrame === "Month" ? "bg-[#A8DADC]/30 text-[#4F4F4F]" : "text-[#4F4F4F]/60 hover:text-[#4F4F4F]"}`}
            >
              Months
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center text-xl">📊</div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-poppins text-[#4F4F4F] hover:bg-gray-50">
            <span>📄</span> Export PDF
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#52B788]/20 rounded-lg flex items-center justify-center text-2xl">😊</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">POSITIVE ENTRIES</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">60%</p>
              <p className="text-xs text-[#52B788] font-poppins">↑ 4% vs last mo</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-300 rounded-full"></div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center text-2xl">😐</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">NEUTRAL ENTRIES</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">20%</p>
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">→ Stable</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] rounded-full"></div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center text-2xl">😕</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">MIXED / UNCERTAIN</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">14%</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-300 rounded-full"></div>
        </Card>
        <Card className="p-5 border-l-4 border-l-[#F4A6A6]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#F4A6A6]/20 rounded-lg flex items-center justify-center text-2xl">😢</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">DISTRESS SIGNALS</p>
              <p className="text-2xl font-dm-serif text-[#F4A6A6]">6%</p>
              <p className="text-xs text-[#F4A6A6] font-poppins">↑ 1% monitored</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-red-400 to-pink-300 rounded-full"></div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mood Trend Chart */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center">📈</div>
            <p className="text-xs font-poppins text-[#4F4F4F]/60">PLATFORM MOOD SCORE TREND - MAY 2026</p>
          </div>
          <div className="relative h-56">
            <div className="absolute inset-0 flex flex-col justify-between py-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#4F4F4F]/60 font-poppins">100</span>
                <div className="flex-1 h-px bg-gray-100"></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#4F4F4F]/60 font-poppins">75</span>
                <div className="flex-1 h-px bg-gray-100"></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#4F4F4F]/60 font-poppins">50</span>
                <div className="flex-1 h-px bg-gray-100"></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#4F4F4F]/60 font-poppins">25</span>
                <div className="flex-1 h-px bg-gray-100"></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#4F4F4F]/60 font-poppins">0</span>
                <div className="flex-1 h-px bg-gray-100"></div>
              </div>
            </div>

            {/* Positive Area */}
            <div className="absolute bottom-0 left-0 right-0 h-[75%] bg-gradient-to-t from-[#52B788]/20 to-transparent rounded-t-lg"></div>

            {/* Distress Area */}
            <div className="absolute bottom-0 left-0 right-0 h-[25%] bg-gradient-to-t from-[#F4A6A6]/10 to-transparent rounded-t-lg"></div>

            <svg className="absolute bottom-0 left-0 right-0 w-full h-56" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path
                d="M0 70 L15 60 L30 65 L45 50 L60 45 L75 38 L90 40 L100 35"
                fill="none"
                stroke="#52B788"
                strokeWidth="2"
              />
              <circle cx="0" cy="70" r="3" fill="#52B788" />
              <circle cx="15" cy="60" r="3" fill="#52B788" />
              <circle cx="30" cy="65" r="3" fill="#52B788" />
              <circle cx="45" cy="50" r="3" fill="#A8DADC" />
              <circle cx="60" cy="45" r="3" fill="#52B788" />
              <circle cx="75" cy="38" r="3" fill="#52B788" />
              <circle cx="90" cy="40" r="3" fill="#52B788" />
              <circle cx="100" cy="35" r="3" fill="#52B788" />
            </svg>

            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-4 pb-2">
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">May 1</span>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">May 7</span>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">May 14</span>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">May 21</span>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">May 28</span>
            </div>
          </div>
          <div className="flex items-center gap-6 mt-4 px-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#52B788]"></div>
              <span className="text-xs font-poppins text-[#4F4F4F]">Positive rate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#F4A6A6]"></div>
              <span className="text-xs font-poppins text-[#4F4F4F]">Distress rate</span>
            </div>
          </div>
        </Card>

        {/* Top Emotions & Yearly Mood */}
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center">🎭</div>
              <p className="text-xs font-poppins text-[#4F4F4F]/60">TOP EMOTIONS PLATFORM-WIDE</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-poppins text-[#4F4F4F]">Joy / Happiness</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-inter text-[#4F4F4F]/60">42%</p>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-[42%] bg-gradient-to-r from-[#52B788] to-[#A8DADC]"></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-poppins text-[#4F4F4F]">Anxiety / Stress</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-inter text-[#4F4F4F]/60">24%</p>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-[24%] bg-gradient-to-r from-[#FFE8A1] to-[#FFB700]"></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-poppins text-[#4F4F4F]">Hope / Optimism</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-inter text-[#4F4F4F]/60">18%</p>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-[18%] bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB]"></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-poppins text-[#4F4F4F]">Sadness</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-inter text-[#4F4F4F]/60">11%</p>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-[11%] bg-gradient-to-r from-[#CDB4DB] to-[#F4A6A6]"></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-poppins text-[#4F4F4F]">Frustration</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-inter text-[#4F4F4F]/60">5%</p>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-[5%] bg-gradient-to-r from-[#F4A6A6] to-[#4F4F4F]/30"></div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-[#FFE8A1]/30 rounded-lg flex items-center justify-center">📅</div>
              <p className="text-xs font-poppins text-[#4F4F4F]/60">MOOD SCORE BY YEAR LEVEL</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col-reverse items-center gap-1 w-1/5">
                <span className="text-sm font-dm-serif text-[#4F4F4F]">6.2/10</span>
                <div className="w-full bg-[#A8DADC] rounded-t-lg" style={{ height: "120px" }}></div>
                <span className="text-xs font-poppins text-[#4F4F4F]/60">1st Year</span>
              </div>
              <div className="flex flex-col-reverse items-center gap-1 w-1/5">
                <span className="text-sm font-dm-serif text-[#4F4F4F]">6.8/10</span>
                <div className="w-full bg-[#4F4F4F]/40 rounded-t-lg" style={{ height: "140px" }}></div>
                <span className="text-xs font-poppins text-[#4F4F4F]/60">2nd Year</span>
              </div>
              <div className="flex flex-col-reverse items-center gap-1 w-1/5">
                <span className="text-sm font-dm-serif text-[#4F4F4F]">7.1/10</span>
                <div className="w-full bg-[#A8DADC] rounded-t-lg" style={{ height: "150px" }}></div>
                <span className="text-xs font-poppins text-[#4F4F4F]/60">3rd Year</span>
              </div>
              <div className="flex flex-col-reverse items-center gap-1 w-1/5">
                <span className="text-sm font-dm-serif text-[#4F4F4F]">6.9/10</span>
                <div className="w-full bg-[#A8DADC] rounded-t-lg" style={{ height: "145px" }}></div>
                <span className="text-xs font-poppins text-[#4F4F4F]/60">4th Year</span>
              </div>
              <div className="flex flex-col-reverse items-center gap-1 w-1/5">
                <span className="text-sm font-dm-serif text-[#4F4F4F]">7.4/10</span>
                <div className="w-full bg-[#52B788] rounded-t-lg" style={{ height: "160px" }}></div>
                <span className="text-xs font-poppins text-[#4F4F4F]/60">Graduate</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
