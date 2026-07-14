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
  is_online: boolean;
  created_at: string;
}

export default function CounselorProfilePage() {
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
    is_online: false,
    created_at: new Date().toISOString(),
  });
  const [originalProfile, setOriginalProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState({
    totalCases: 0,
    activeUsers: 0,
  });
  const { user: currentUser } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfileAndStats = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      
      // Fetch counselor profile
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();
        
      if (profileData) {
        setProfile(profileData);
        setOriginalProfile(profileData);
      }

      // Fetch counselor stats
      const [casesResult, assignedResult] = await Promise.all([
        supabase
          .from("distress_logs")
          .select("id", { count: "exact", head: true })
          .eq("assigned_counselor_id", currentUser.id),
        supabase
          .from("user_profiles")
          .select("id", { count: "exact", head: true })
          .eq("assigned_counselor_id", currentUser.id),
      ]);

      setStats({
        totalCases: casesResult.count || 0,
        activeUsers: assignedResult.count || 0,
      });

    } catch (error) {
      console.error("Error fetching data:", error);
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
      await supabase
        .from("user_profiles")
        .update({
          ...profile,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentUser.id);
      
      // Refetch profile
      await fetchProfileAndStats();
      
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
      
      // Update the profile
      setProfile({ ...profile, avatar_url: avatarUrl });
      
      // Save immediately to database
      await supabase
        .from("user_profiles")
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq("id", currentUser?.id);
        
      alert("Avatar uploaded successfully!");
    } catch (error) {
      alert("Error uploading avatar!");
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#A8DADC] mx-auto mb-4"></div>
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
                  {(profile.first_name?.[0] || "C")}{(profile.last_name?.[0] || "")}
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
                {profile.first_name || "Counselor"} {profile.last_name || ""}
              </h1>
              <p className="text-sm text-dark-text/60 font-poppins">
                @{profile.username || "counselor"} • {profile.country || "Not set"}
              </p>
              <div className="flex gap-4 mt-2">
                <span className="px-3 py-1 bg-primary-blue/20 rounded-full text-xs font-poppins text-primary-blue">
                  📋 {stats.totalCases} cases
                </span>
                <span className="px-3 py-1 bg-lavender/30 rounded-full text-xs font-poppins text-dark-text">
                  👤 {stats.activeUsers} users
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-poppins ${profile.is_online ? "bg-green-500/20 text-green-600" : "bg-light-gray text-dark-text/60"}`}>
                  {profile.is_online ? "🟢 Online" : "⚪ Offline"}
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
            <Link href="/counselor/settings">
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

        {/* Counselor Stats */}
        <Card variant="white" className="p-6">
          <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
            <span>📊</span>
            Counselor Stats
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary-blue/10 p-4 rounded-xl text-center">
              <div className="text-2xl font-dm-serif text-dark-text">{stats.totalCases}</div>
              <div className="text-xs font-poppins text-dark-text/60 uppercase">Total Cases</div>
            </div>
            <div className="bg-lavender/30 p-4 rounded-xl text-center">
              <div className="text-2xl font-dm-serif text-dark-text">{stats.activeUsers}</div>
              <div className="text-xs font-poppins text-dark-text/60 uppercase">Assigned Users</div>
            </div>
            <div className="bg-light-gray/50 p-4 rounded-xl text-center col-span-2">
              <div className="text-xl font-dm-serif text-dark-text">{formatJoinDate(profile.created_at)}</div>
              <div className="text-xs font-poppins text-dark-text/60 uppercase">Counselor Since</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
