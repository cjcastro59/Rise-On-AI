"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    firstName: "Juan",
    lastName: "dela Cruz",
    email: "juan@example.com",
    username: "juandelacruz",
    bio: "Psychology student passionate about mental health awareness. Using journaling to grow every day.",
    age: 21,
    gender: "Male",
    country: "Philippines",
    university: "University of the Philippines",
    course: "BS Psychology",
    yearLevel: "3rd Year",
    studentId: "2021-12345",
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
              <p className="text-xs text-dark-text/50 font-poppins mt-1">
                {profile.university} • {profile.yearLevel} • {profile.course}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Info Card */}
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

        {/* Academic Info Card */}
        <Card className="p-6">
          <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
            <span>🎓</span>
            Academic Information
          </h3>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-poppins text-dark-text/60">University / School</label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.university}
                  onChange={(e) => setProfile({ ...profile, university: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                />
              ) : (
                <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                  {profile.university}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-poppins text-dark-text/60">Program / Course</label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.course}
                  onChange={(e) => setProfile({ ...profile, course: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                />
              ) : (
                <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                  {profile.course}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-poppins text-dark-text/60">Year Level</label>
                {isEditing ? (
                  <select
                    value={profile.yearLevel}
                    onChange={(e) => setProfile({ ...profile, yearLevel: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                    <option value="Graduate">Graduate</option>
                  </select>
                ) : (
                  <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                    {profile.yearLevel}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-poppins text-dark-text/60">Student ID</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={profile.studentId}
                    onChange={(e) => setProfile({ ...profile, studentId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                  />
                ) : (
                  <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                    {profile.studentId}
                  </div>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end">
                <Button>Update Academic Info</Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Stats Overview */}
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
    </div>
  );
}
