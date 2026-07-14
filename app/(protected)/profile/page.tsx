"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { COUNTRIES } from "@/lib/constants";

interface Profile {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  age: number | null;
  gender: string | null;
  country: string | null;
  mood_baseline: string | null;
  mood_baseline_details: string | null;
  family_background: string | null;
  living_situation: string | null;
  goals: string[] | null;
  language: string | null;
  mood_reminder_enabled: boolean;
  mood_reminder_time: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  created_at: string;
}

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    first_name: null,
    last_name: null,
    email: null,
    username: null,
    bio: null,
    avatar_url: null,
    age: null,
    gender: null,
    country: null,
    mood_baseline: null,
    goals: [],
    language: "English",
    mood_reminder_enabled: false,
    mood_reminder_time: null,
    family_background: null,
    living_situation: null,
    mood_baseline_details: null,
    emergency_contact_name: null,
    emergency_contact_relation: null,
    emergency_contact_phone: null,
    created_at: new Date().toISOString(),
  });
  const [originalProfile, setOriginalProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState({
    totalEntries: 0,
    streak: 0,
    avgMood: 0,
  });
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculateStats = useCallback((entries: any[]) => {
    const totalEntries = entries.length;

    let streak = 0;
    const dates = new Set(
      entries.map(entry => new Date(entry.created_at).toDateString())
    );

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toDateString();

      if (dates.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    const moodScores: Record<string, number> = {
      "Happy": 10,
      "Calm": 8,
      "Anxious": 4,
      "Sad": 2,
      "Frustrated": 3,
      "Excited": 9,
      "Confused": 5,
      "Overwhelmed": 1,
    };

    let totalMoodScore = 0;
    let moodCount = 0;

    entries.forEach(entry => {
      if (entry.mood && moodScores[entry.mood]) {
        totalMoodScore += moodScores[entry.mood];
        moodCount++;
      }
    });

    const avgMood = moodCount > 0 ? (totalMoodScore / moodCount).toFixed(1) : 0;

    setStats({
      totalEntries,
      streak,
      avgMood: Number(avgMood),
    });
  }, []);

  const fetchProfileAndStats = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single();
        
      if (profileError) {
        console.error("Error fetching profile:", profileError);
      } else if (profileData) {
        setProfile(profileData);
        setOriginalProfile(profileData);
      }

      // Fetch journal entries for stats
      const { data: entries, error: entriesError } = await supabase
        .from("journal_entries")
        .select("created_at, mood")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
        
      if (entriesError) {
        console.error("Error fetching entries:", entriesError);
      } else {
        calculateStats(entries || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [calculateStats, supabase, user]);

  const saveProfile = async () => {
    if (!user) {
      console.error("No user found");
      alert("Please log in to save profile");
      return;
    }
    
    try {
      setSaving(true);
      
      console.log("Saving profile with data:", {
        id: user.id,
        ...profile,
        updated_at: new Date().toISOString(),
      });
      
      // Let's use update instead of upsert to be safe, and handle insert if needed
      let error;
      
      // First try to update
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          ...profile,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
        
      error = updateError;
      
      // If update failed because no row exists, try insert
      if (updateError && updateError.code === "PGRST116") {
        console.log("No existing profile, inserting new one");
        const { error: insertError } = await supabase
          .from("user_profiles")
          .insert({
            id: user.id,
            ...profile,
            email: user.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        error = insertError;
      }
      
      if (error) {
        console.error("Error saving profile:", error);
        alert(`Failed to save profile: ${error.message}`);
        return;
      }
      
      // Refetch profile to get fresh data
      await fetchProfileAndStats();
      
      setIsEditing(false);
      alert("Profile saved successfully!");
    } catch (error) {
      console.error("Error saving profile:", error);
      alert(`Failed to save profile: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (originalProfile) {
      setProfile(originalProfile);
    }
    setIsEditing(false);
  };

  const toggleGoal = (goal: string) => {
    const currentGoals = profile.goals || [];
    const newGoals = currentGoals.includes(goal)
      ? currentGoals.filter(g => g !== goal)
      : [...currentGoals, goal];
      
    setProfile({
      ...profile,
      goals: newGoals,
    });
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("You must select an image to upload.");
      }

      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Upload the file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get the public URL
      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatarUrl = data.publicUrl;
      
      // Update the profile with the new avatar URL
      setProfile({ ...profile, avatar_url: avatarUrl });
      
      // Save immediately to database
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq("id", user?.id);
        
      if (updateError) {
        throw updateError;
      }
      
      alert("Avatar uploaded successfully!");
    } catch (error) {
      alert(`Error uploading avatar: ${(error as Error).message}`);
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndStats();
  }, [fetchProfileAndStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue mx-auto mb-4"></div>
          <p className="text-dark-text/60 font-poppins">Loading profile...</p>
        </div>
      </div>
    );
  }

  const handleEditToggle = () => {
    if (isEditing) {
      saveProfile();
    } else {
      setIsEditing(true);
    }
  };

  const formatJoinDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-primary-blue/10 to-lavender/30 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="relative">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt="Profile"
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-primary-blue to-lavender flex items-center justify-center text-white text-3xl font-bold font-poppins">
                  {(profile.first_name?.[0] || "U")}{(profile.last_name?.[0] || "")}
                </div>
              )}
              {isEditing && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={uploadAvatar}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary-blue rounded-full flex items-center justify-center text-white hover:bg-primary-blue/80 transition-all shadow-md"
                  >
                    {uploading ? (
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    ) : (
                      <span className="text-sm">📷</span>
                    )}
                  </button>
                </>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-dm-serif text-dark-text">
                {profile.first_name || "User"} {profile.last_name || ""}
              </h1>
              <p className="text-sm text-dark-text/60 font-poppins">
                @{profile.username || "user"} • {profile.country || "Not set"}
              </p>
              <div className="flex gap-4 mt-2">
                <span className="px-3 py-1 bg-success-green/20 rounded-full text-xs font-poppins text-success-dark">
                  🔥 {stats.streak}-day streak
                </span>
                <span className="px-3 py-1 bg-lavender/30 rounded-full text-xs font-poppins text-dark-text">
                  📝 {stats.totalEntries} entries
                </span>
                <span className="px-3 py-1 bg-primary-blue/10 rounded-full text-xs font-poppins text-primary-blue">
                  😊 {stats.avgMood} avg mood
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={handleEditToggle} disabled={saving}>
              {saving ? "Saving..." : (isEditing ? "Save Changes" : "Edit Profile")}
            </Button>
            {isEditing && (
              <Button variant="secondary" onClick={handleCancel} disabled={saving}>
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
        <Card variant="white" className="p-6">
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
                    value={profile.first_name || ""}
                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                  />
                ) : (
                  <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                    {profile.first_name || "Not set"}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-poppins text-dark-text/60">Last Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={profile.last_name || ""}
                    onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                  />
                ) : (
                  <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                    {profile.last_name || "Not set"}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-poppins text-dark-text/60">Age</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={profile.age || ""}
                    onChange={(e) => setProfile({ ...profile, age: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                  />
                ) : (
                  <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                    {profile.age || "Not set"}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-poppins text-dark-text/60">Gender</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={profile.gender || ""}
                    onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                  />
                ) : (
                  <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                    {profile.gender || "Not set"}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-poppins text-dark-text/60">Country</label>
              {isEditing ? (
                <select
                  value={profile.country || ""}
                  onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                >
                  <option value="">Select a country</option>
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                  {profile.country || "Not set"}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-poppins text-dark-text/60">Username</label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.username || ""}
                  onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                />
              ) : (
                <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                  {profile.username || "Not set"}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-poppins text-dark-text/60">Email Address</label>
              <div className="px-3 py-2 bg-light-gray/30 rounded-lg text-sm font-inter text-dark-text/70">
                {profile.email || user?.email}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-poppins text-dark-text/60">Bio / About Me</label>
              {isEditing ? (
                <textarea
                  value={profile.bio || ""}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                />
              ) : (
                <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                  {profile.bio || "No bio yet"}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-poppins text-dark-text/60">Family Background</label>
              {isEditing ? (
                <textarea
                  value={profile.family_background || ""}
                  onChange={(e) => setProfile({ ...profile, family_background: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                />
              ) : (
                <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                  {profile.family_background || "Not shared yet"}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-poppins text-dark-text/60">Current Living Situation</label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.living_situation || ""}
                  onChange={(e) => setProfile({ ...profile, living_situation: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                />
              ) : (
                <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                  {profile.living_situation || "Not set"}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Mood Preferences */}
        <Card variant="white" className="p-6">
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
                    checked={profile.mood_reminder_enabled}
                    onChange={(e) => setProfile({ ...profile, mood_reminder_enabled: e.target.checked })}
                    className="w-5 h-5 accent-primary-blue"
                  />
                  <span className="text-sm font-inter text-dark-text">
                    {profile.mood_reminder_enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded ${profile.mood_reminder_enabled ? "bg-primary-blue" : "bg-light-gray"} flex items-center justify-center text-white`}>
                    {profile.mood_reminder_enabled && "✓"}
                  </div>
                  <span className="text-sm font-inter text-dark-text">
                    {profile.mood_reminder_enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              )}
            </div>
            {profile.mood_reminder_enabled && (
              <div className="space-y-1">
                <label className="text-xs font-poppins text-dark-text/60">Reminder Time</label>
                {isEditing ? (
                  <input
                    type="time"
                    value={profile.mood_reminder_time || ""}
                    onChange={(e) => setProfile({ ...profile, mood_reminder_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                  />
                ) : (
                  <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                    {profile.mood_reminder_time || "Not set"}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-poppins text-dark-text/60">Current Mood Baseline</label>
              {isEditing ? (
                <select
                  value={profile.mood_baseline || ""}
                  onChange={(e) => setProfile({ ...profile, mood_baseline: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                >
                  <option value="">Select a baseline</option>
                  <option value="Happy">Happy</option>
                  <option value="Calm">Calm</option>
                  <option value="Anxious">Anxious</option>
                  <option value="Sad">Sad</option>
                </select>
              ) : (
                <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                  {profile.mood_baseline || "Not set"}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-poppins text-dark-text/60">Mood Baseline Details</label>
              {isEditing ? (
                <textarea
                  value={profile.mood_baseline_details || ""}
                  onChange={(e) => setProfile({ ...profile, mood_baseline_details: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                />
              ) : (
                <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                  {profile.mood_baseline_details || "Share what your typical mood feels like"}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-poppins text-dark-text/60">Language</label>
              {isEditing ? (
                <select
                  value={profile.language || ""}
                  onChange={(e) => setProfile({ ...profile, language: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                >
                  <option value="">Select language</option>
                  <option value="English">English</option>
                  <option value="Filipino">Filipino</option>
                </select>
              ) : (
                <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                  {profile.language || "English"}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* My Wellness Journey */}
      <Card variant="white" className="p-6">
        <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
          <span>📊</span>
          My Wellness Journey
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-light-gray/30 p-4 rounded-xl text-center">
            <div className="text-2xl font-dm-serif text-dark-text">{stats.totalEntries}</div>
            <div className="text-xs font-poppins text-dark-text/60 uppercase">Total Entries</div>
          </div>
          <div className="bg-success-green/20 p-4 rounded-xl text-center">
            <div className="text-2xl font-dm-serif text-dark-text">🔥 {stats.streak}</div>
            <div className="text-xs font-poppins text-dark-text/60 uppercase">Day Streak</div>
          </div>
          <div className="bg-primary-blue/10 p-4 rounded-xl text-center">
            <div className="text-2xl font-dm-serif text-dark-text">{stats.avgMood}</div>
            <div className="text-xs font-poppins text-dark-text/60 uppercase">Avg Mood Score</div>
          </div>
          <div className="bg-lavender/30 p-4 rounded-xl text-center">
            <div className="text-2xl font-dm-serif text-dark-text">{formatJoinDate(profile.created_at)}</div>
            <div className="text-xs font-poppins text-dark-text/60 uppercase">Member Since</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wellness Goals */}
        <Card variant="white" className="p-6">
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
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${
                  (profile.goals || []).includes(goal)
                    ? "bg-primary-blue/10 border border-primary-blue/30"
                    : "bg-light-gray/50 opacity-60"
                }`}
                onClick={() => isEditing && toggleGoal(goal)}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center ${
                  (profile.goals || []).includes(goal)
                    ? "bg-primary-blue text-white"
                    : "bg-light-gray"
                }`}>
                  {(profile.goals || []).includes(goal) && "✓"}
                </div>
                <span className="text-sm font-inter text-dark-text">{goal}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card variant="white" className="p-6">
          <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
            <span>📝</span>
            Recent Activity
          </h3>
          <div className="space-y-3">
            {[
              { title: "Check your journal history", date: "See entries" },
            ].map((activity, index) => (
              <Link key={index} href="/journal/history">
                <div className="flex items-center justify-between p-3 bg-light-gray/30 rounded-lg hover:bg-light-gray/50 transition-colors">
                  <div className="space-y-1">
                    <p className="text-sm font-inter text-dark-text">{activity.title}</p>
                    <p className="text-xs font-poppins text-dark-text/60">{activity.date}</p>
                  </div>
                  <span className="text-sm font-poppins text-primary-blue">→</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Emergency Support */}
      <Card variant="white" className="p-6 bg-red-50 border-2 border-red-100">
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
                  value={profile.emergency_contact_name || ""}
                  onChange={(e) => setProfile({ ...profile, emergency_contact_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300 text-sm font-inter"
                />
              ) : (
                <div className="px-3 py-2 bg-white rounded-lg text-sm font-inter text-dark-text">
                  {profile.emergency_contact_name || "Not set"}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-poppins text-red-800/60">Relation</label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.emergency_contact_relation || ""}
                  onChange={(e) => setProfile({ ...profile, emergency_contact_relation: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300 text-sm font-inter"
                />
              ) : (
                <div className="px-3 py-2 bg-white rounded-lg text-sm font-inter text-dark-text">
                  {profile.emergency_contact_relation || "Not set"}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-poppins text-red-800/60">Phone Number</label>
            {isEditing ? (
              <input
                type="tel"
                value={profile.emergency_contact_phone || ""}
                onChange={(e) => setProfile({ ...profile, emergency_contact_phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300 text-sm font-inter"
              />
            ) : (
              <div className="px-3 py-2 bg-white rounded-lg text-sm font-inter text-dark-text">
                {profile.emergency_contact_phone || "Not set"}
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
