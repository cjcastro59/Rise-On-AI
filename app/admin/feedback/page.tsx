"use client";

import { Card } from "@/components/ui/card";

const mockFeedback = [
  {
    id: "F-0045",
    type: "Positive",
    text: "The AI insights are surprisingly accurate. Nakatulong talaga sa akin na mawaran ng anxiety ko. Highly recommend sa mga kapwa college students.",
    date: "May 28",
  },
  {
    id: "F-0044",
    type: "Suggestion",
    text: "Sana may group journalling option para sa mga org members. Would love to track collective mood as a team.",
    date: "May 28",
  },
  {
    id: "F-0043",
    type: "Concern",
    text: "Sometimes the AI misreads sarcasm in Taglish. Would be great to have a 'correct this analysis' button.",
    date: "May 27",
  },
];

export default function AdminFeedbackPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-1">Feedback & Survey Results</h1>
          <p className="text-sm text-[#374151] font-poppins">Anonymous user satisfaction and platform feedback</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary flex items-center gap-2">
            <span>📊</span> Export Report
          </button>
          <button className="btn-primary flex items-center gap-2">
            <span>📢</span> New Survey
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="stat-card border-l-4 border-l-[#FFE8A1]">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-warning-yellow/30">⭐</div>
            <div className="text-right">
              <p className="text-xs text-[#374151] font-poppins">AVG PLATFORM RATING</p>
              <p className="text-2xl font-dm-serif text-dark-text">4.7</p>
              <p className="text-xs text-[#374151] font-poppins">out of 5.0</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-yellow-400 to-orange-300"></div>
        </Card>
        <Card className="stat-card border-l-4 border-l-success-green">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-success-green/30">📝</div>
            <div className="text-right">
              <p className="text-xs text-[#374151] font-poppins">TOTAL RESPONSES</p>
              <p className="text-2xl font-dm-serif text-dark-text">1,842</p>
              <p className="text-xs text-success-green font-poppins">78% response rate</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-green-400 to-emerald-300"></div>
        </Card>
        <Card className="stat-card border-l-4 border-l-primary-blue">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-primary-blue/20">💖</div>
            <div className="text-right">
              <p className="text-xs text-[#374151] font-poppins">WOULD RECOMMEND</p>
              <p className="text-2xl font-dm-serif text-dark-text">91%</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-primary-blue to-lavender"></div>
        </Card>
        <Card className="stat-card border-l-4 border-l-lavender">
          <div className="flex items-start gap-3 mb-3">
            <div className="stat-card-icon bg-lavender/20">💬</div>
            <div className="text-right">
              <p className="text-xs text-[#374151] font-poppins">OPEN COMMENTS</p>
              <p className="text-2xl font-dm-serif text-dark-text">348</p>
            </div>
          </div>
          <div className="stat-card-pill bg-gradient-to-r from-purple-400 to-pink-300"></div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating Distribution */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-primary-blue/20 rounded-lg flex items-center justify-center">📊</div>
            <p className="text-xs font-poppins text-[#374151]">RATING DISTRIBUTION</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-poppins text-dark-text">★★★★★ 5 Stars</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-[#374151]">52%</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[52%] bg-gradient-to-r from-success-green to-primary-blue"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-poppins text-dark-text">★★★★☆ 4 Stars</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-[#374151]">28%</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[28%] bg-gradient-to-r from-primary-blue to-teal"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-poppins text-dark-text">★★★☆☆ 3 Stars</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-[#374151]">12%</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[12%] bg-gradient-to-r from-warning-yellow to-[#FFB700]"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-poppins text-dark-text">★★☆☆☆ 2 Stars</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-[#374151]">8%</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[8%] bg-gradient-to-r from-[#FFB700] to-error-red"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-poppins text-dark-text">★☆☆☆☆ 1 Star</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-[#374151]">3%</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[3%] bg-gradient-to-r from-error-red to-dark-text/30"></div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Features Satisfaction */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-lavender/20 rounded-lg flex items-center justify-center">📈</div>
            <p className="text-xs font-poppins text-[#374151]">FEATURES SATISFACTION SCORES</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-poppins text-dark-text">AI Sentiment Analysis</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-[#374151]">4.8/5</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[96%] bg-gradient-to-r from-success-green to-success-green"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-poppins text-dark-text">Mood Tracking Charts</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-[#374151]">4.6/5</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[92%] bg-gradient-to-r from-primary-blue to-teal"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-poppins text-dark-text">Taglish Support</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-dark-text/60">4.7/5</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[94%] bg-gradient-to-r from-primary-blue to-lavender"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-poppins text-dark-text">AI Reflection Prompts</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-dark-text/60">4.7/5</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[94%] bg-gradient-to-r from-lavender to-purple-400"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-poppins text-dark-text">Crisis Support Access</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-inter text-[#374151]">4.9/5</p>
                <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[98%] bg-gradient-to-r from-success-green to-success-green"></div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Open Comments */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#A8DADC]/20 rounded-lg flex items-center justify-center">📝</div>
            <p className="text-xs font-poppins text-[#374151]">ANONYMIZED OPEN COMMENTS (SAMPLES)</p>
          </div>
          <span className="badge-info">All identifiers removed</span>
        </div>
        <div className="space-y-4">
          {mockFeedback.map((feedback) => (
            <div key={feedback.id} className={`p-4 rounded-xl border-l-4 ${feedback.type === "Positive" ? "border-success-green bg-success-green/10 border-success-green/20" :
                feedback.type === "Suggestion" ? "border-primary-blue bg-primary-blue/10 border-primary-blue/20" :
                  "border-[#FFB700] bg-[#FFB700]/10"
              }`}>
              <div className="flex items-start gap-3 mb-2">
                <span className={`badge ${feedback.type === "Positive" ? "badge-success" :
                    feedback.type === "Suggestion" ? "badge-info" :
                      "badge-warning"
                  }`}>{feedback.type}</span>
                <span className="text-xs text-[#374151] font-inter ml-auto">{feedback.id} • {feedback.date}</span>
              </div>
              <p className="text-sm text-dark-text font-inter">{feedback.text}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
