"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function CounselorSettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    newCaseAlerts: true,
    messageAlerts: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user: currentUser } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  // Load profile and settings
  useEffect(() => {
    if (!currentUser) return;
    const loadData = async () => {
      try {
        setLoading(true);
        // Load user profile
        const { data: profileData } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", currentUser.id)
          .single();
        setProfile(profileData);

        // Load notification settings
        const { data: settingsData } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", `counselor_notifications_${currentUser.id}`)
          .single();
        
        if (settingsData) {
          const parsedSettings = typeof settingsData.value === 'string' 
            ? JSON.parse(settingsData.value) 
            : settingsData.value;
          setNotifications({ ...notifications, ...parsedSettings });
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentUser, supabase]);

  // Save notification settings
  const saveSettings = async () => {
    if (!currentUser) return;
    try {
      setSaving(true);
      await supabase
        .from("system_settings")
        .upsert(
          {
            key: `counselor_notifications_${currentUser.id}`,
            value: notifications
          },
          { onConflict: "key" }
        );
      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue mx-auto mb-4"></div>
          <p className="text-dark-text/60 font-poppins">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text">Settings</h1>
          <p className="text-sm text-dark-text/60 font-poppins">Manage your profile and preferences.</p>
        </div>
      </div>

      {/* Profile Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-primary-blue/20 rounded-lg flex items-center justify-center">👤</div>
          <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider">Your Profile</p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt="Profile" 
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-r from-primary-blue to-lavender rounded-full flex items-center justify-center text-white font-bold text-xl">
                {profile?.full_name?.charAt(0) || profile?.username?.charAt(0) || "?"}
              </div>
            )}
            <div>
              <p className="font-poppins text-lg font-semibold text-dark-text">
                {profile?.full_name || profile?.username || "Unknown User"}
              </p>
              <p className="text-sm text-dark-text/60 font-poppins">
                {profile?.email || ""}
              </p>
              <p className="text-xs text-dark-text/50 font-poppins">
                Role: Counselor
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Notifications Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-lavender/20 rounded-lg flex items-center justify-center">🔔</div>
          <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider">Notification Preferences</p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-poppins text-dark-text">Email Alerts</p>
              <p className="text-xs text-dark-text/60 font-inter">Receive email notifications for important updates</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.emailAlerts}
                onChange={(e) => setNotifications(prev => ({ ...prev, emailAlerts: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="toggle-switch"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-poppins text-dark-text">New Case Alerts</p>
              <p className="text-xs text-dark-text/60 font-inter">Get notified when new distress cases are reported</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.newCaseAlerts}
                onChange={(e) => setNotifications(prev => ({ ...prev, newCaseAlerts: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="toggle-switch"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-poppins text-dark-text">Message Alerts</p>
              <p className="text-xs text-dark-text/60 font-inter">Get notified when receiving new messages</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.messageAlerts}
                onChange={(e) => setNotifications(prev => ({ ...prev, messageAlerts: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="toggle-switch"></div>
            </label>
          </div>
        </div>
        <div className="mt-6">
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
