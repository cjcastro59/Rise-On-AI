"use client";

import { Card } from "@/components/ui/card";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-dm-serif text-[#4F4F4F] mb-1">Dashboard Overview</h1>
          <p className="text-sm text-[#4F4F4F]/60 font-poppins">Thursday, May 28, 2026 - Last updated 2 mins ago</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-poppins text-[#4F4F4F] hover:bg-gray-50">
            <span>📊</span> Export Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] rounded-lg text-sm font-poppins text-[#4F4F4F] font-medium">
            <span>📢</span> New Announcement
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      <div className="p-4 bg-gradient-to-r from-[#A8DADC]/20 to-[#CDB4DB]/20 rounded-xl border-l-4 border-l-[#A8DADC]">
        <p className="text-sm font-poppins text-[#4F4F4F] flex items-center gap-2">
          <span>🔒</span> All data displayed uses anonymized IDs (RAI-###). No personal journal content is accessible from this panel.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center text-2xl">👥</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">TOTAL USERS</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">2,418</p>
              <p className="text-xs text-[#52B788] font-poppins">↑ 8% last week</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-400 to-cyan-300 rounded-full"></div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#52B788]/20 rounded-lg flex items-center justify-center text-2xl">📝</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">TOTAL ENTRIES</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">12,304</p>
              <p className="text-xs text-[#52B788] font-poppins">↑ 15% today</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-300 rounded-full"></div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#FFE8A1]/30 rounded-lg flex items-center justify-center text-2xl">💖</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">AVG POSITIVE RATE</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">68%</p>
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">↑ 4% vs last mo</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-yellow-400 to-orange-300 rounded-full"></div>
        </Card>

        <Card className="p-5 border-l-4 border-l-[#F4A6A6]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#F4A6A6]/20 rounded-lg flex items-center justify-center text-2xl">⚠️</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">ACTIVE ALERTS</p>
              <p className="text-2xl font-dm-serif text-[#F4A6A6]">14</p>
              <p className="text-xs text-[#F4A6A6] font-poppins">↑ 3 today</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-red-400 to-pink-300 rounded-full"></div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center text-2xl">✅</div>
            <div className="text-right">
              <p className="text-xs text-[#4F4F4F]/60 font-poppins">SYSTEM UPTIME</p>
              <p className="text-2xl font-dm-serif text-[#4F4F4F]">99.7%</p>
              <p className="text-xs text-[#52B788] font-poppins">🟢 Healthy</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-green-300 rounded-full"></div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center">📈</div>
              <div>
                <p className="text-xs font-poppins text-[#4F4F4F]/60">DAILY ACTIVE USERS — MAY 2026</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-poppins text-[#4F4F4F]/60">Weeks</button>
              <button className="px-3 py-1 bg-[#A8DADC]/30 rounded-lg text-xs font-poppins text-[#4F4F4F]">Month</button>
            </div>
          </div>
          <div className="h-48 flex items-end justify-between gap-2 px-4 pb-4">
            <div className="w-1/7 flex flex-col items-center gap-2">
              <div className="w-full bg-gradient-to-t from-[#A8DADC] to-[#4F4F4F]/10 rounded-t-lg" style={{height: '45%'}}></div>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">Mon</span>
            </div>
            <div className="w-1/7 flex flex-col items-center gap-2">
              <div className="w-full bg-gradient-to-t from-[#A8DADC] to-[#4F4F4F]/10 rounded-t-lg" style={{height: '65%'}}></div>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">Tue</span>
            </div>
            <div className="w-1/7 flex flex-col items-center gap-2">
              <div className="w-full bg-gradient-to-t from-[#A8DADC] to-[#4F4F4F]/10 rounded-t-lg" style={{height: '50%'}}></div>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">Wed</span>
            </div>
            <div className="w-1/7 flex flex-col items-center gap-2">
              <div className="w-full bg-gradient-to-t from-[#CDB4DB] to-[#4F4F4F]/10 rounded-t-lg" style={{height: '70%'}}></div>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">Thu</span>
            </div>
            <div className="w-1/7 flex flex-col items-center gap-2">
              <div className="w-full bg-gradient-to-t from-[#A8DADC] to-[#4F4F4F]/10 rounded-t-lg" style={{height: '85%'}}></div>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">Fri</span>
            </div>
            <div className="w-1/7 flex flex-col items-center gap-2">
              <div className="w-full bg-gradient-to-t from-[#52B788] to-[#4F4F4F]/10 rounded-t-lg" style={{height: '60%'}}></div>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">Sat</span>
            </div>
            <div className="w-1/7 flex flex-col items-center gap-2">
              <div className="w-full bg-gradient-to-t from-[#52B788]/70 to-[#4F4F4F]/10 rounded-t-lg" style={{height: '40%'}}></div>
              <span className="text-xs text-[#4F4F4F]/60 font-poppins">Sun</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#CDB4DB]/20 rounded-lg flex items-center justify-center">📊</div>
            <p className="text-xs font-poppins text-[#4F4F4F]/60">PLATFORM MOOD DISTRIBUTION</p>
          </div>
          <div className="flex items-center gap-8">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#EAEAEA" strokeWidth="10"></circle>
                <circle cx="50" cy="50" r="40" fill="none" stroke="#52B788" strokeWidth="10" strokeDasharray="126 251"></circle>
                <circle cx="50" cy="50" r="40" fill="none" stroke="#A8DADC" strokeWidth="10" strokeDasharray="63 251" strokeDashoffset="-126"></circle>
                <circle cx="50" cy="50" r="40" fill="none" stroke="#CDB4DB" strokeWidth="10" strokeDasharray="38 251" strokeDashoffset="-189"></circle>
                <circle cx="50" cy="50" r="40" fill="none" stroke="#F4A6A6" strokeWidth="10" strokeDasharray="24 251" strokeDashoffset="-227"></circle>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-lg font-dm-serif text-[#4F4F4F]">60%</p>
                  <p className="text-xs text-[#4F4F4F]/60 font-poppins">Positive</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#52B788]"></div>
                <span className="text-xs font-poppins text-[#4F4F4F]">Positive 60%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#A8DADC]"></div>
                <span className="text-xs font-poppins text-[#4F4F4F]">Neutral 20%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#CDB4DB]"></div>
                <span className="text-xs font-poppins text-[#4F4F4F]">Mixed 14%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#F4A6A6]"></div>
                <span className="text-xs font-poppins text-[#4F4F4F]">Distress 6%</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Distress Alerts */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#F4A6A6]/20 rounded-lg flex items-center justify-center">🚨</div>
              <p className="text-xs font-poppins text-[#4F4F4F]/60">RECENT DISTRESS ALERTS</p>
            </div>
            <button className="text-xs font-poppins text-[#A8DADC] hover:underline">View All →</button>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-[#F4A6A6]/10 rounded-xl border border-[#F4A6A6]/30 flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold font-poppins text-[#4F4F4F]">High-distress entry detected — RAI-0247</p>
                <p className="text-xs text-[#4F4F4F]/60 font-inter">Keyword: "hopeless"; "taking pills"; Score: 9/10 negative, 12 mins ago</p>
              </div>
              <button className="px-3 py-1 bg-[#F4A6A6]/30 text-[#F4A6A6] rounded-full text-xs font-semibold font-poppins">Review</button>
            </div>
            <div className="p-3 bg-[#FFE8A1]/20 rounded-xl border border-[#FFE8A1]/50 flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold font-poppins text-[#4F4F4F]">Repeated negative entries — RAI-0082</p>
                <p className="text-xs text-[#4F4F4F]/60 font-inter">4 consecutive negative entries in 48hrs; 1 hr ago</p>
              </div>
              <button className="px-3 py-1 bg-[#FFE8A1]/40 text-[#FFB700] rounded-full text-xs font-semibold font-poppins">Review</button>
            </div>
            <div className="p-3 bg-[#CDB4DB]/10 rounded-xl border border-[#CDB4DB]/30 flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold font-poppins text-[#4F4F4F]">Mood drop pattern — RAI-0089</p>
                <p className="text-xs text-[#4F4F4F]/60 font-inter">Mood score dropped 40% in 7 days; 3 hrs ago</p>
              </div>
              <button className="px-3 py-1 bg-[#CDB4DB]/40 text-[#8B5CF6] rounded-full text-xs font-semibold font-poppins">Review</button>
            </div>
          </div>
        </Card>

        {/* System Health & Admin Activity */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-[#52B788]/20 rounded-lg flex items-center justify-center">⚙️</div>
              <p className="text-xs font-poppins text-[#4F4F4F]/60">SYSTEM HEALTH</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#52B788]"></span>
                  <span className="text-sm font-poppins text-[#4F4F4F]">AI Module</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#4F4F4F]/60 font-inter">Online</span>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-gradient-to-r from-[#52B788] to-[#A8DADC]"></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#52B788]"></span>
                  <span className="text-sm font-poppins text-[#4F4F4F]">Database</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#4F4F4F]/60 font-inter">Healthy</span>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-[95%] bg-gradient-to-r from-[#A8DADC] to-[#52B788]"></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#A8DADC]"></span>
                  <span className="text-sm font-poppins text-[#4F4F4F]">API Response</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#4F4F4F]/60 font-inter">142ms</span>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-[80%] bg-gradient-to-r from-[#A8DADC] to-[#FFB700]"></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#FFB700]"></span>
                  <span className="text-sm font-poppins text-[#4F4F4F]">Storage Usage</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#4F4F4F]/60 font-inter">74%</span>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-[74%] bg-gradient-to-r from-[#FFE8A1] to-[#FFB700]"></div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-poppins text-[#4F4F4F]/60 mb-3">RECENT ADMIN ACTIVITY</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <p className="font-poppins text-[#4F4F4F]">admin@rise.ai exported mood report</p>
                <p className="text-[#4F4F4F]/60 font-inter">8m ago</p>
              </div>
              <div className="flex justify-between items-center text-xs">
                <p className="font-poppins text-[#4F4F4F]">guidance@cpu.edu.ph reviewed alert RAI-0207</p>
                <p className="text-[#4F4F4F]/60 font-inter">1hr ago</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
