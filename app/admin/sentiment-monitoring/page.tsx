"use client";

import { Card } from "@/components/ui/card";
import { useState } from "react";

const mockQueueEntries = [
  {
    id: "E-0984",
    userId: "RAI-0021",
    timestamp: "May 28, 6:48 AM",
    language: "Tagalog",
    aiScore: "Negative",
    confidence: "54%",
  },
  {
    id: "E-0892",
    userId: "RAI-0134",
    timestamp: "May 27, 11:20 PM",
    language: "Tagalog",
    aiScore: "Mixed",
    confidence: "61%",
  },
  {
    id: "E-0756",
    userId: "RAI-0089",
    timestamp: "May 27, 9:04 PM",
    language: "Tagalog",
    aiScore: "Uncertain",
    confidence: "21%",
  },
];

export default function AdminSentimentMonitoringPage() {
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-dm-serif text-[#4F4F4F] mb-1">Sentiment Analysis Monitoring</h1>
          <p className="text-sm text-[#4F4F4F]/60 font-poppins">AI Model performance & platform-wide NLP metrics</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-poppins text-[#4F4F4F] hover:bg-gray-50">
            <span>📊</span> Export Data
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#52B788]/20 rounded-lg flex items-center justify-center text-2xl">✅</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">AI ACCURACY</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">97.3%</p>
              <p className="text-xs text-[#52B788] font-poppins">Model v2.1</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-300 rounded-full"></div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center text-2xl">⚡</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">AVG PROCESS TIME</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">142ms</p>
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">↑ Fast</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] rounded-full"></div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center text-2xl">🌐</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">TAGALOG ENTRIES</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">61%</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-300 rounded-full"></div>
        </Card>
        <Card className="p-5 border-l-4 border-l-[#F4A6A6]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#F4A6A6]/20 rounded-lg flex items-center justify-center text-2xl">⚠️</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">LOW CONFIDENCE</p>
              <p className="text-2xl font-dm-serif text-[#F4A6A6]">2.7%</p>
              <p className="text-xs text-[#F4A6A6] font-poppins">Needs review</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-red-400 to-pink-300 rounded-full"></div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confidence Distribution */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center">📊</div>
            <p className="text-xs font-poppins text-[#4F4F4F]/60">SENTIMENT CONFIDENCE DISTRIBUTION</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-poppins text-[#4F4F4F]">Very High (90-100%)</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-[#4F4F4F]/60">68%</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[68%] bg-gradient-to-r from-[#52B788] to-[#A8DADC]"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-poppins text-[#4F4F4F]">High (70-89%)</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-[#4F4F4F]/60">29%</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[29%] bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB]"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-poppins text-[#4F4F4F]">Medium (60-69%)</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-[#4F4F4F]/60">10.3%</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[10.3%] bg-gradient-to-r from-[#FFE8A1] to-[#FFB700]"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-poppins text-[#4F4F4F]">Low (&lt;60%)</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-[#4F4F4F]/60">2.7%</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[2.7%] bg-gradient-to-r from-[#F4A6A6] to-[#4F4F4F]/30"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs font-poppins text-[#4F4F4F]/60 mb-3">MODEL PERFORMANCE BY LANGUAGE</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-[#52B788]/20 rounded-full text-xs font-semibold font-poppins text-[#52B788]">English 98.5%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-[#A8DADC]/20 rounded-full text-xs font-semibold font-poppins text-[#4F4F4F]">Tagalog 96.1%</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Emotion Breakdown */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center">📈</div>
            <p className="text-xs font-poppins text-[#4F4F4F]/60">PLATFORM EMOTION BREAKDOWN (LAST 24 HOURS)</p>
          </div>
          <div className="relative w-full h-48 flex items-center justify-center">
            <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#EAEAEA" strokeWidth="10" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#52B788" strokeWidth="10" strokeDasharray="126 251" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#A8DADC" strokeWidth="10" strokeDasharray="63 251" strokeDashoffset="-126" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#CDB4DB" strokeWidth="10" strokeDasharray="38 251" strokeDashoffset="-189" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#FFE8A1" strokeWidth="10" strokeDasharray="24 251" strokeDashoffset="-227" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-lg font-dm-serif text-[#4F4F4F]">60%</p>
                <p className="text-xs text-[#4F4F4F]/60 font-poppins">Positive</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 px-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#52B788]"></div>
              <span className="text-xs font-poppins text-[#4F4F4F]">Joy 42%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#A8DADC]"></div>
              <span className="text-xs font-poppins text-[#4F4F4F]">Calm 18%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FFE8A1]"></div>
              <span className="text-xs font-poppins text-[#4F4F4F]">Anxiety 24%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#F4A6A6]"></div>
              <span className="text-xs font-poppins text-[#4F4F4F]">Distress 7%</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Review Queue */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs font-poppins text-[#4F4F4F]/60">LOW CONFIDENCE QUEUE - REQUIRES MANUAL REVIEW</p>
          <div className="text-xs text-[#F4A6A6] font-poppins">2.7% of entries</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#4F4F4F]/60 font-poppins uppercase tracking-wider">ENTRY ID</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#4F4F4F]/60 font-poppins uppercase tracking-wider">USER ID</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#4F4F4F]/60 font-poppins uppercase tracking-wider">TIMESTAMP</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#4F4F4F]/60 font-poppins uppercase tracking-wider">LANGUAGE</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#4F4F4F]/60 font-poppins uppercase tracking-wider">AI SCORE</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#4F4F4F]/60 font-poppins uppercase tracking-wider">CONFIDENCE</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#4F4F4F]/60 font-poppins uppercase tracking-wider">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {mockQueueEntries.map((entry) => (
                <tr
                  key={entry.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-all ${
                    selectedEntry === entry.id ? "bg-[#A8DADC]/10" : ""
                  }`}
                  onClick={() => setSelectedEntry(entry.id)}
                >
                  <td className="py-4 px-3">
                    <p className="font-poppins font-mono text-sm text-[#A8DADC] font-semibold">{entry.id}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-poppins text-[#4F4F4F]">{entry.userId}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-inter text-[#4F4F4F]/60">{entry.timestamp}</p>
                  </td>
                  <td className="py-4 px-3">
                    <span className="px-2 py-1 bg-[#A8DADC]/20 rounded-full text-xs font-semibold font-poppins text-[#4F4F4F]">{entry.language}</span>
                  </td>
                  <td className="py-4 px-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      entry.aiScore === "Positive" ? "bg-[#52B788]/20 text-[#52B788]" :
                      entry.aiScore === "Negative" ? "bg-[#F4A6A6]/20 text-[#F4A6A6]" :
                      "bg-[#FFE8A1]/30 text-[#FFB700]"
                    }`}>{entry.aiScore}</span>
                  </td>
                  <td className="py-4 px-3">
                    <span className="px-2 py-1 bg-[#FFE8A1]/30 rounded-full text-xs font-semibold font-poppins text-[#FFB700]">{entry.confidence}</span>
                  </td>
                  <td className="py-4 px-3">
                    <button className="px-3 py-1 bg-[#FFE8A1]/40 border border-[#FFB700]/30 rounded-full text-xs font-semibold font-poppins text-[#FFB700]">
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
