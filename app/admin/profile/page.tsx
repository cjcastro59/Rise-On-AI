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
  full_name?: string | null;
  email: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  age: number | null;
  sex: string | null;
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
  emergency_contact_relation: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
}

export default function AdminProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    first_name: null,
    last_name: null,
    full_name: null,
    email: null,
    username: null,
    bio: null,
    avatar_url: null,
    age: null,
    sex: null,
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
  const [originalProfile, setOriginalProfile] = useState<Profile | null>(null); // Store original for cancel
  const { user: currentUser } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      // Load user profile
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();
        
      if (profileData) {
        const newProfile = {
          ...profileData,
          first_name: profileData.first_name || null,
          last_name: profileData.last_name || null,
        };
        setProfile(newProfile);
        setOriginalProfile(newProfile); // Store original for cancel
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUser, supabase]);

  const saveProfile = async () => {
    if (!currentUser) {
      console.error("No user found");
      alert("Please log in to save profile");
      return;
    }
    
    try {
      setSaving(true);
      
      // Save profile
      const { error } = await supabase
        .from("user_profiles")
        .update({
          ...profile,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentUser.id);
      
      if (error) throw error;
      
      // Refetch profile to get fresh data
      await fetchProfile();
      
      setIsEditing(false);
      alert("Profile saved successfully!");
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile.");
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
      const fileName = `${currentUser?.id}/${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Upload the file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

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
        .eq("id", currentUser?.id);
      
      if (updateError) throw updateError;
      
      alert("Avatar uploaded successfully!");
    } catch (error) {
      alert("Error uploading avatar!");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

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

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-6 border border-light-gray shadow-sm">
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
                  {(profile.first_name?.[0] || "Admin")}{(profile.last_name?.[0] || "")}
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
                {profile.first_name || profile.full_name || profile.username || "Admin"} {profile.last_name || ""}
              </h1>
              <p className="text-sm text-dark-text/60 font-poppins">
                @{profile.username || "admin"} • {profile.country || "Not set"}
              </p>
              <div className="flex gap-4 mt-2">
                <span className="px-3 py-1 bg-primary-blue/20 rounded-full text-xs font-poppins text-primary-blue">
                  Role: Admin
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
            <Link href="/admin/system-settings">
              <Button variant="ghost" className="text-sm">
                Go to Settings
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Personal Information & Preferences */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card variant="white" className="p-6">
          <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-6 flex items-center gap-2">
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
                <label className="text-xs font-poppins text-dark-text/60">Sex</label>
                {isEditing ? (
                  <select
                    value={profile.sex || ""}
                    onChange={(e) => setProfile({ ...profile, sex: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                  >
                    <option value="">Select Sex</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                ) : (
                  <div className="px-3 py-2 bg-light-gray/50 rounded-lg text-sm font-inter text-dark-text">
                    {profile.sex || "Not set"}
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
                {profile.email || currentUser?.email}
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
          </div>
        </Card>

        <Card variant="white" className="p-6">
          <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-6 flex items-center gap-2">
            <span>⏰</span>
            Preferences
          </h3>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-poppins text-dark-text/60">Language</label>
              {isEditing ? (
                <select
                  value={profile.language || ""}
                  onChange={(e) => setProfile({ ...profile, language: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                >
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
    </div>
  );
}
