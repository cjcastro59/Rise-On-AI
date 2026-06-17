sa"use client";

import { Card } from "@/components/ui/card";

const mockEntries = [
  {
    id: "ENTRY-001",
    userId: "RAI-0001",
    timestamp: "May 28, 9:24 AM",
    wordCount: 342,
    language: "Taglish",
    moodTag: "Calm",
    sentimentScore: "78% Positive",
    aiProcessed: "Done",
  },
  {
    id: "ENTRY-002",
    userId: "RAI-0089",
    timestamp: "May 28, 8:48 AM",
    wordCount: 189,
    language: "Tagalog",
    moodTag: "Sad",
    sentimentScore: "91% Negative",
    aiProcessed: "Done",
  },
  {
    id: "ENTRY-003",
    userId: "RAI-0052",
    timestamp: "May 28, 8:00 AM",
    wordCount: 214,
    language: "English",
    moodTag: "Anxious",
    sentimentScore: "76% Negative",
    aiProcessed: "Done",
  },
  {
    id: "ENTRY-004",
    userId: "RAI-0064",
    timestamp: "May 27, 11:30 PM",
    wordCount: 518,
    language: "Taglish",
    moodTag: "Happy",
    sentimentScore: "89% Positive",
    aiProcessed: "Done",
  },
];

export default function AdminJournalMonitorPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-dm-serif text-[#4F4F4F] mb-1">Journal Monitoring</h1>
          <p className="text-sm text-[#4F4F4F]/60 font-poppins">Anonymized entry analytics; No content displayed</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-poppins text-[#4F4F4F] hover:bg-gray-50">
            <span>📊</span> Export
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      <div className="p-4 bg-gradient-to-r from-[#A8DADC]/20 to-[#CDB4DB]/20 rounded-xl border-l-4 border-l-[#A8DADC]">
        <p className="text-sm font-poppins text-[#4F4F4F] flex items-center gap-2">
          <span>🔒</span> Privacy Protected: Journal entry content is never accessible to admins. Only metadata (entry count, timestamp, sentiment score, word count) is visible.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center text-2xl">📝</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">TOTAL ENTRIES</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">12,304</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-400 to-cyan-300 rounded-full"></div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center text-2xl">📊</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">ENTRIES TODAY</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">847</p>
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">Peak: 9-10 AM</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-300 rounded-full"></div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#52B788]/20 rounded-lg flex items-center justify-center text-2xl">📄</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">AVG WORDS/ENTRY</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">284</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-300 rounded-full"></div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#FFE8A1]/30 rounded-lg flex items-center justify-center text-2xl">🔥</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">7-DAY STREAK</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">68%</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-yellow-400 to-orange-300 rounded-full"></div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center">📈</div>
            <p className="text-xs font-poppins text-[#4F4F4F]/60">ENTRY VOLUME - LAST 7 DAYS</p>
          </div>
          <div className="h-40 flex items-end justify-between gap-2 px-4">
            <div className="w-1/7 flex flex-col items-center gap-1">
              <div className="w-full bg-[#A8DADC] rounded-t-lg" style={{ height: "70%" }}></div>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">Mon</span>
            </div>
            <div className="w-1/7 flex flex-col items-center gap-1">
              <div className="w-full bg-[#4F4F4F]/40 rounded-t-lg" style={{ height: "90%" }}></div>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">Tue</span>
            </div>
            <div className="w-1/7 flex flex-col items-center gap-1">
              <div className="w-full bg-[#A8DADC] rounded-t-lg" style={{ height: "60%" }}></div>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">Wed</span>
            </div>
            <div className="w-1/7 flex flex-col items-center gap-1">
              <div className="w-full bg-[#CDB4DB] rounded-t-lg" style={{ height: "80%" }}></div>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">Thu</span>
            </div>
            <div className="w-1/7 flex flex-col items-center gap-1">
              <div className="w-full bg-[#4F4F4F]/40 rounded-t-lg" style={{ height: "100%" }}></div>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">Fri</span>
            </div>
            <div className="w-1/7 flex flex-col items-center gap-1">
              <div className="w-full bg-[#52B788] rounded-t-lg" style={{ height: "50%" }}></div>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">Sat</span>
            </div>
            <div className="w-1/7 flex flex-col items-center gap-1">
              <div className="w-full bg-[#52B788]/70 rounded-t-lg" style={{ height: "40%" }}></div>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">Sun</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center">🕒</div>
            <p className="text-xs font-poppins text-[#4F4F4F]/60">PEAK WRITING HOURS</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-poppins text-[#4F4F4F]">Morning (6-12 AM)</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-[#4F4F4F]/60">34%</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[34%] bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB]"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-poppins text-[#4F4F4F]">Afternoon (12-6 PM)</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-[#4F4F4F]/60">28%</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[28%] bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB]"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-poppins text-[#4F4F4F]">Evening (6-10 PM)</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-[#4F4F4F]/60">29%</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[29%] bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB]"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-poppins text-[#4F4F4F]">Night (10 PM-6 AM)</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-[#4F4F4F]/60">9%</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[9%] bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB]"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs font-poppins text-[#4F4F4F]/60 mb-3">LANGUAGE USED</p>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-[#A8DADC]/30 rounded-full text-xs font-poppins text-[#4F4F4F]">Taglish 61%</span>
              <span className="px-3 py-1 bg-[#CDB4DB]/20 rounded-full text-xs font-poppins text-[#4F4F4F]">English 29%</span>
              <span className="px-3 py-1 bg-[#A8DADC]/20 rounded-full text-xs font-poppins text-[#4F4F4F]">Tagalog 10%</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Entries Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs font-poppins text-[#4F4F4F]/60">RECENT ENTRY METADATA (ANONYMIZED)</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-[#A8DADC]/10 rounded-full border border-[#A8DADC]/30">
              <span className="text-xs">🤐</span>
              <span className="text-xs font-poppins text-[#4F4F4F]">Content Hidden</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#4F4F4F]/60 font-poppins uppercase tracking-wider">ENTRY ID</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#4F4F4F]/60 font-poppins uppercase tracking-wider">TIMESTAMP</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#4F4F4F]/60 font-poppins uppercase tracking-wider">WORD COUNT</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#4F4F4F]/60 font-poppins uppercase tracking-wider">LANGUAGE</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#4F4F4F]/60 font-poppins uppercase tracking-wider">MOOD TAG</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#4F4F4F]/60 font-poppins uppercase tracking-wider">SENTIMENT SCORE</th>
                <th className="text-left py-4 px-3 text-xs font-semibold text-[#4F4F4F]/60 font-poppins uppercase tracking-wider">AI PROCESSED</th>
              </tr>
            </thead>
            <tbody>
              {mockEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-3">
                    <p className="font-poppins font-mono text-sm text-[#A8DADC] font-semibold">{entry.id}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-inter text-[#4F4F4F]/60">{entry.timestamp}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-poppins text-[#4F4F4F]">{entry.wordCount}</p>
                  </td>
                  <td className="py-4 px-3">
                    <span className="px-2 py-1 bg-[#A8DADC]/20 rounded-full text-xs font-semibold font-poppins text-[#4F4F4F]">{entry.language}</span>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-poppins text-[#4F4F4F]">{entry.moodTag}</p>
                  </td>
                  <td className="py-4 px-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      entry.sentimentScore.includes("Positive") ? "bg-[#52B788]/20 text-[#52B788]" : "bg-[#F4A6A6]/20 text-[#F4A6A6]"
                    }`}>
                      {entry.sentimentScore}
                    </span>
                  </td>
                  <td className="py-4 px-3">
                    <span className="px-2 py-1 bg-[#A8DADC]/20 rounded-full text-xs font-semibold font-poppins text-[#4F4F4F]">
                      {entry.aiProcessed}
                    </span>
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
