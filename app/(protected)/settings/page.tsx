"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type SettingSection = "notifications" | "privacy" | "language" | "security" | "data" | "account";

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingSection>("notifications");
  const [notificationSettings, setNotificationSettings] = useState({
    dailyReminder: true,
    weeklyReport: true,
    aiAlerts: true,
    streakReminder: false,
    reminderTime: "20:00"
  });
  const [privacySettings, setPrivacySettings] = useState({
    shareAnonymousData: true,
    profileVisibility: "private"
  });
  const [language, setLanguage] = useState("English");

  const renderSettingsContent = () => {
    switch (activeSection) {
      case "notifications":
        return (
          <div className="space-y-4">
            <div className="mb-6">
              <h3 className="text-lg font-dm-serif text-dark-text mb-2">Notifications</h3>
              <p className="text-sm text-dark-text/60 font-poppins">
                Control when and how Rise On AI reminds you to journal.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-light-gray/30 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold font-poppins text-dark-text">Daily Journal Reminder</h4>
                  <p className="text-xs text-dark-text/60 font-inter">Get a gentle nudge to write each day</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.dailyReminder}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, dailyReminder: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark-text/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-primary-blue peer-checked:to-lavender"></div>
                </label>
              </div>

              {notificationSettings.dailyReminder && (
                <div className="pl-4">
                  <label className="text-xs font-poppins text-dark-text/60">Reminder Time</label>
                  <input
                    type="time"
                    value={notificationSettings.reminderTime}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, reminderTime: e.target.value })}
                    className="mt-1 px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
                  />
                </div>
              )}

              <div className="flex items-center justify-between p-4 bg-light-gray/30 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold font-poppins text-dark-text">Weekly Mood Report</h4>
                  <p className="text-xs text-dark-text/60 font-inter">AI-generated emotional summary every Sunday</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.weeklyReport}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, weeklyReport: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark-text/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-primary-blue peer-checked:to-lavender"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-light-gray/30 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold font-poppins text-dark-text">AI Insight Alerts</h4>
                  <p className="text-xs text-dark-text/60 font-inter">Get notified when AI detects mood changes</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.aiAlerts}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, aiAlerts: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark-text/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-primary-blue peer-checked:to-lavender"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-light-gray/30 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold font-poppins text-dark-text">Streak Reminders</h4>
                  <p className="text-xs text-dark-text/60 font-inter">Alert when your streak is about to break</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.streakReminder}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, streakReminder: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark-text/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-primary-blue peer-checked:to-lavender"></div>
                </label>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <Button>Save Notification Settings</Button>
            </div>
          </div>
        );

      case "privacy":
        return (
          <div className="space-y-4">
            <div className="mb-6">
              <h3 className="text-lg font-dm-serif text-dark-text mb-2">Privacy & Data</h3>
              <p className="text-sm text-dark-text/60 font-poppins">
                Control how your data is used and who can see it.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-light-gray/30 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold font-poppins text-dark-text">Share Anonymous Data</h4>
                  <p className="text-xs text-dark-text/60 font-inter">Help improve AI by sharing anonymized insights</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacySettings.shareAnonymousData}
                    onChange={(e) => setPrivacySettings({ ...privacySettings, shareAnonymousData: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark-text/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-primary-blue peer-checked:to-lavender"></div>
                </label>
              </div>

              <div className="p-4 bg-light-gray/30 rounded-xl">
                <h4 className="text-sm font-semibold font-poppins text-dark-text mb-2">Profile Visibility</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-inter">
                    <input
                      type="radio"
                      checked={privacySettings.profileVisibility === "private"}
                      onChange={() => setPrivacySettings({ ...privacySettings, profileVisibility: "private" })}
                      className="text-primary-blue focus:ring-primary-blue"
                    />
                    <span>Private (Only you can see your profile)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      case "language":
        return (
          <div className="space-y-4">
            <div className="mb-6">
              <h3 className="text-lg font-dm-serif text-dark-text mb-2">Language & Region</h3>
              <p className="text-sm text-dark-text/60 font-poppins">
                Choose your preferred language for the app.
              </p>
            </div>
            <div className="p-4 bg-light-gray/30 rounded-xl">
              <label className="text-xs font-poppins text-dark-text/60">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
              >
                <option value="English">English</option>
                <option value="Filipino">Filipino</option>
              </select>
            </div>
          </div>
        );

      case "security":
        return (
          <div className="space-y-4">
            <div className="mb-6">
              <h3 className="text-lg font-dm-serif text-dark-text mb-2">Security & Login</h3>
              <p className="text-sm text-dark-text/60 font-poppins">
                Manage your password and login security.
              </p>
            </div>
            <div className="space-y-3">
              <Button variant="secondary">Change Password</Button>
              <Button variant="ghost">Enable Two-Factor Authentication</Button>
            </div>
          </div>
        );

      case "data":
        return (
          <div className="space-y-4">
            <div className="mb-6">
              <h3 className="text-lg font-dm-serif text-dark-text mb-2">Data & Export</h3>
              <p className="text-sm text-dark-text/60 font-poppins">
                Download or delete your data.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button variant="secondary">Download All My Data</Button>
              <Button variant="ghost" className="text-soft-red">Delete My Account</Button>
            </div>
          </div>
        );

      case "account":
        return (
          <div className="space-y-4">
            <div className="mb-6">
              <h3 className="text-lg font-dm-serif text-dark-text mb-2">Account</h3>
            </div>
            <p className="text-sm text-dark-text/60 font-poppins">
              Manage your account details here. Go to Profile to edit personal info.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 hidden md:block">
        <Card className="p-4 space-y-2">
          <h2 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4">Settings</h2>
          <button
            onClick={() => setActiveSection("notifications")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              activeSection === "notifications"
                ? "bg-primary-blue/10 text-primary-blue"
                : "text-dark-text hover:bg-light-gray/50"
            }`}
          >
            <span className="flex items-center gap-2">
              <span>🔔</span> Notifications
            </span>
          </button>
          <button
            onClick={() => setActiveSection("privacy")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              activeSection === "privacy"
                ? "bg-primary-blue/10 text-primary-blue"
                : "text-dark-text hover:bg-light-gray/50"
            }`}
          >
            <span className="flex items-center gap-2">
              <span>🔒</span> Privacy
            </span>
          </button>
          <button
            onClick={() => setActiveSection("language")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              activeSection === "language"
                ? "bg-primary-blue/10 text-primary-blue"
                : "text-dark-text hover:bg-light-gray/50"
            }`}
          >
            <span className="flex items-center gap-2">
              <span>🌐</span> Language
            </span>
          </button>
          <button
            onClick={() => setActiveSection("security")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              activeSection === "security"
                ? "bg-primary-blue/10 text-primary-blue"
                : "text-dark-text hover:bg-light-gray/50"
            }`}
          >
            <span className="flex items-center gap-2">
              <span>🛡️</span> Security
            </span>
          </button>
          <button
            onClick={() => setActiveSection("data")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              activeSection === "data"
                ? "bg-primary-blue/10 text-primary-blue"
                : "text-dark-text hover:bg-light-gray/50"
            }`}
          >
            <span className="flex items-center gap-2">
              <span>📦</span> Data & Export
            </span>
          </button>
          <button
            onClick={() => setActiveSection("account")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              activeSection === "account"
                ? "bg-primary-blue/10 text-primary-blue"
                : "text-dark-text hover:bg-light-gray/50"
            }`}
          >
            <span className="flex items-center gap-2">
              <span>👤</span> Account
            </span>
          </button>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <Card className="p-6">
          {renderSettingsContent()}
        </Card>
      </div>
    </div>
  );
}
