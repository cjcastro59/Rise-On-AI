"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    firstName: "CJ",
    lastName: "Castro",
    email: "cjcastro@gmail.com",
    username: "cjcastro",
    bio: "Psychology student passionate about mental health awareness. Using journaling to grow every day.",
    age: 22,
    gender: "Male",
    country: "Philippines",
    moodBaseline: "Calm",
    goals: ["Reduce stress", "Improve mood"],
    language: "English",
    moodReminderEnabled: true,
    moodReminderTime: "09:00",
    emergencyContactName: "Maria Castro",
    emergencyContactPhone: "+63 917 123 4567",
    emergencyContactRelation: "Mother",
    joinDate: "January 2026",
    totalEntries: 47,
    streak: 12,
    avgMood: 7.4
  });

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-primary-blue/10 to-lavender/30 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-primary-blue to-lavender flex items-center justify-center text-white text-3xl font-bold font-poppins">
              {profile.firstName[0]}{profile.lastName[0]}
            </div>
            <div>
              <h1 className="text-2xl font-dm-serif text-dark-text">
                {profile.firstName} {profile.lastName}
              </h1>
              <p className="text-sm text-dark-text/60 font-poppins">
                @{profile.username} • {profile.country}
              </p>
              <div className="flex gap-4 mt-2">
                <span className="px-3 py-1 bg-success-green/20 rounded-full text-xs font-poppins text-success-dark">
                  🔥 {profile.streak}-day streak
                </span>
                <span className="px-3 py-1 bg-lavender/30 rounded-full text-xs font-poppins text-dark-text">
                  📝 {profile.totalEntries} entries
                </span>
                <span className="px-3 py-1 bg-primary-blue/10 rounded-full text-xs font-poppins text-primary-blue">
                  😊 {profile.avgMood} avg mood
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? "Save Changes" : "Edit Profile"}
            </Button>
            {isEditing && (
              <Button variant="secondary" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            )}
            <Link href="/settings">
              <Button variant="ghost" className="text-sm">
                Go to Settings
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
            <span>👤</span>
            Personal Information
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-poppins text-dark-text/60">First Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                  />
                ) : (
                  <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                    {profile.firstName}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-poppins text-dark-text/60">Last Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                  />
                ) : (
                  <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                    {profile.lastName}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-poppins text-dark-text/60">Email Address</label>
              {isEditing ? (
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                />
              ) : (
                <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                  {profile.email}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-poppins text-dark-text/60">Bio / About Me</label>
              {isEditing ? (
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                />
              ) : (
                <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                  {profile.bio}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Mood Preferences */}
        <Card className="p-6">
          <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
            <span>⏰</span>
            Mood Preferences
          </h3>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-poppins text-dark-text/60">Enable Mood Reminders</label>
              {isEditing ? (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={profile.moodReminderEnabled}
                    onChange={(e) => setProfile({ ...profile, moodReminderEnabled: e.target.checked })}
                    className="w-5 h-5 accent-primary-blue"
                  />
                  <span className="text-sm font-inter text-dark-text">
                    {profile.moodReminderEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded ${profile.moodReminderEnabled ? "bg-primary-blue" : "bg-light-gray"} flex items-center justify-center text-white`}>
                    {profile.moodReminderEnabled && "✓"}
                  </div>
                  <span className="text-sm font-inter text-dark-text">
                    {profile.moodReminderEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              )}
            </div>
            {profile.moodReminderEnabled && (
              <div className="space-y-1">
                <label className="text-xs font-poppins text-dark-text/60">Reminder Time</label>
                {isEditing ? (
                  <input
                    type="time"
                    value={profile.moodReminderTime}
                    onChange={(e) => setProfile({ ...profile, moodReminderTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                  />
                ) : (
                  <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                    {profile.moodReminderTime}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-poppins text-dark-text/60">Current Mood Baseline</label>
              {isEditing ? (
                <select
                  value={profile.moodBaseline}
                  onChange={(e) => setProfile({ ...profile, moodBaseline: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                >
                  <option value="Happy">Happy</option>
                  <option value="Calm">Calm</option>
                  <option value="Anxious">Anxious</option>
                  <option value="Sad">Sad</option>
                </select>
              ) : (
                <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                  {profile.moodBaseline}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* My Wellness Journey */}
      <Card className="p-6">
        <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
          <span>📊</span>
          My Wellness Journey
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-light-gray/30 p-4 rounded-xl text-center">
            <div className="text-2xl font-dm-serif text-dark-text">{profile.totalEntries}</div>
            <div className="text-xs font-poppins text-dark-text/60 uppercase">Total Entries</div>
          </div>
          <div className="bg-success-green/20 p-4 rounded-xl text-center">
            <div className="text-2xl font-dm-serif text-dark-text">🔥 {profile.streak}</div>
            <div className="text-xs font-poppins text-dark-text/60 uppercase">Day Streak</div>
          </div>
          <div className="bg-primary-blue/10 p-4 rounded-xl text-center">
            <div className="text-2xl font-dm-serif text-dark-text">{profile.avgMood}</div>
            <div className="text-xs font-poppins text-dark-text/60 uppercase">Avg Mood Score</div>
          </div>
          <div className="bg-lavender/30 p-4 rounded-xl text-center">
            <div className="text-2xl font-dm-serif text-dark-text">{profile.joinDate}</div>
            <div className="text-xs font-poppins text-dark-text/60 uppercase">Member Since</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wellness Goals */}
        <Card className="p-6">
          <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
            <span>🎯</span>
            Wellness Goals
          </h3>
          <div className="space-y-3">
            {[
              "Reduce stress",
              "Improve mood",
              "Build gratitude",
              "Track emotions",
              "Better sleep",
              "Self-reflection",
            ].map((goal) => (
              <div
                key={goal}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  profile.goals.includes(goal)
                    ? "bg-primary-blue/10 border border-primary-blue/30"
                    : "bg-light-gray/50 opacity-60"
                }`}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center ${
                  profile.goals.includes(goal)
                    ? "bg-primary-blue text-white"
                    : "bg-light-gray"
                }`}>
                  {profile.goals.includes(goal) && "✓"}
                </div>
                <span className="text-sm font-inter text-dark-text">{goal}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="p-6">
          <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
            <span>📝</span>
            Recent Activity
          </h3>
          <div className="space-y-3">
            {[
              { title: "Morning Journal", date: "Today", mood: "😊 Positive" },
              { title: "Evening Reflection", date: "Yesterday", mood: "😌 Calm" },
              { title: "Weekly Check-in", date: "3 days ago", mood: "😐 Neutral" },
            ].map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-light-gray/30 rounded-lg">
                <div className="space-y-1">
                  <p className="text-sm font-inter text-dark-text">{activity.title}</p>
                  <p className="text-xs font-poppins text-dark-text/60">{activity.date}</p>
                </div>
                <span className="text-sm font-poppins">{activity.mood}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Emergency Support */}
      <Card className="p-6 bg-red-50 border-2 border-red-100">
        <h3 className="text-xs font-poppins uppercase tracking-wider text-red-800/80 mb-4 flex items-center gap-2">
          <span>🚨</span>
          Emergency Support
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-poppins text-red-800/60">Contact Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.emergencyContactName}
                  onChange={(e) => setProfile({ ...profile, emergencyContactName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300 text-sm font-inter"
                />
              ) : (
                <div className="px-3 py-2 bg-white rounded-lg text-sm font-inter text-dark-text">
                  {profile.emergencyContactName}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-poppins text-red-800/60">Relation</label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.emergencyContactRelation}
                  onChange={(e) => setProfile({ ...profile, emergencyContactRelation: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300 text-sm font-inter"
                />
              ) : (
                <div className="px-3 py-2 bg-white rounded-lg text-sm font-inter text-dark-text">
                  {profile.emergencyContactRelation}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-poppins text-red-800/60">Phone Number</label>
            {isEditing ? (
              <input
                type="tel"
                value={profile.emergencyContactPhone}
                onChange={(e) => setProfile({ ...profile, emergencyContactPhone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300 text-sm font-inter"
              />
            ) : (
              <div className="px-3 py-2 bg-white rounded-lg text-sm font-inter text-dark-text">
                {profile.emergencyContactPhone}
              </div>
            )}
          </div>
          <div className="pt-2">
            <Button className="w-full bg-red-600 hover:bg-red-700 text-white">
              📞 Call Emergency Contact
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
