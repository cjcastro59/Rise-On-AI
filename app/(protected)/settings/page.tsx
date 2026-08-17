"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { authenticator } from "@otplib/preset-default";
import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";

type SettingSection = "notifications" | "privacy" | "language" | "security" | "data" | "account";

const flash = (setter: (m: string) => void, msg: string, ms = 3500) => {
  setter(msg);
  setTimeout(() => setter(""), ms);
};

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
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const signOut = async () => { await supabase.auth.signOut(); router.push("/login"); };

  // Change password modal
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // Delete account confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("mood_reminder_enabled, reminder_time, weekly_report_enabled, ai_insight_alerts_enabled, streak_reminder_enabled, share_anonymous_data, profile_visibility, preferred_language, two_factor_enabled")
        .eq("id", user.id)
        .single();
      if (error) return;
      if (data) {
        setNotificationSettings({
          dailyReminder: data.mood_reminder_enabled ?? true,
          weeklyReport: data.weekly_report_enabled ?? true,
          aiAlerts: data.ai_insight_alerts_enabled ?? true,
          streakReminder: data.streak_reminder_enabled ?? false,
          reminderTime: data.reminder_time || "20:00",
        });
        setPrivacySettings({
          shareAnonymousData: data.share_anonymous_data ?? true,
          profileVisibility: data.profile_visibility || "private",
        });
        setLanguage(data.preferred_language || "English");
        setTwoFactorEnabled(Boolean(data.two_factor_enabled));
      }
    } catch {
      /* ignore */
    }
  }, [supabase, user]);

  const check2FAStatus = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_profiles')
      .select('two_factor_enabled')
      .eq('id', user.id)
      .single();
    if (data) {
      setTwoFactorEnabled(data.two_factor_enabled);
    }
  }, [supabase, user]);

  useEffect(() => {
    if (user) {
      loadSettings();
      check2FAStatus();
    }
  }, [loadSettings, check2FAStatus, user]);

  const saveNotificationSettings = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const { error } = await supabase.from("user_profiles").update({
        mood_reminder_enabled: notificationSettings.dailyReminder,
        reminder_time: notificationSettings.reminderTime,
        weekly_report_enabled: notificationSettings.weeklyReport,
        ai_insight_alerts_enabled: notificationSettings.aiAlerts,
        streak_reminder_enabled: notificationSettings.streakReminder,
        updated_at: new Date().toISOString(),
      }).eq("id", user.id);
      if (error) throw error;
      flash(setSuccess, "✅ Notification settings saved!");
    } catch (e: any) {
      flash(setError, "❌ Failed to save: " + (e.message || "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const savePrivacySettings = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const { error } = await supabase.from("user_profiles").update({
        share_anonymous_data: privacySettings.shareAnonymousData,
        profile_visibility: privacySettings.profileVisibility,
        updated_at: new Date().toISOString(),
      }).eq("id", user.id);
      if (error) throw error;
      flash(setSuccess, "✅ Privacy settings saved!");
    } catch (e: any) {
      flash(setError, "❌ Failed to save: " + (e.message || "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const saveLanguageSettings = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const { error } = await supabase.from("user_profiles").update({
        preferred_language: language,
        updated_at: new Date().toISOString(),
      }).eq("id", user.id);
      if (error) throw error;
      flash(setSuccess, "✅ Language preference saved!");
    } catch (e: any) {
      flash(setError, "❌ Failed to save: " + (e.message || "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (!pwCurrent || !pwNew || !pwConfirm) {
      flash(setError, "Please fill in all password fields");
      return;
    }
    if (pwNew.length < 6) {
      flash(setError, "New password must be at least 6 characters");
      return;
    }
    if (pwNew !== pwConfirm) {
      flash(setError, "New passwords don't match");
      return;
    }
    try {
      setPwLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: pwNew,
      });
      if (error) throw error;
      setShowChangePw(false);
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      flash(setSuccess, "✅ Password changed successfully!");
    } catch (e: any) {
      flash(setError, "❌ " + (e.message || "Failed to change password (verify current password via email OTP if required)"));
    } finally {
      setPwLoading(false);
    }
  };

  const downloadAllData = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const chunks: string[] = [];
      const addSection = (title: string, rows: any[]) => {
        chunks.push(`\n===== ${title} =====\n`);
        if (rows.length === 0) chunks.push("(no records)\n");
        else chunks.push(JSON.stringify(rows, null, 2) + "\n");
      };

      const [{ data: profile }, { data: entries }, { data: moods }, { data: indicators }] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("id", user.id).single(),
        supabase.from("journal_entries").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5000),
        supabase.from("mood_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5000),
        supabase.from("behavioral_indicators").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(2000),
      ] as any);

      chunks.push(`# Rise On AI - Data Export for ${(profile as any)?.email || user.email}\n`);
      chunks.push(`Generated: ${new Date().toISOString()}\n`);
      addSection("User Profile", [profile].filter(Boolean));
      addSection("Journal Entries", entries || []);
      addSection("Mood Logs", moods || []);
      addSection("Behavioral Indicators", indicators || []);

      try {
        const [{ data: convs }, { data: distressLogs }] = await Promise.all([
          supabase.from("conversations").select("*").eq("user_id", user.id),
          supabase.from("distress_logs").select("*").eq("user_id", user.id),
        ] as any);
        addSection("Support Conversations", convs || []);
        addSection("Distress Logs", distressLogs || []);
      } catch {
        /* ignore optional sections */
      }

      const blob = new Blob(chunks, { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rise-on-ai-data-export-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      flash(setSuccess, "✅ Data export downloaded!");
    } catch (e: any) {
      flash(setError, "❌ Failed to export: " + (e.message || "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (deleteConfirmText.trim().toLowerCase() !== "delete my account") {
      flash(setError, 'Type "DELETE MY ACCOUNT" exactly to confirm');
      return;
    }
    try {
      setDeleteLoading(true);
      // Step 1: Soft-delete profile data
      try {
        await supabase.from("user_profiles").update({
          status: "deactivated",
          first_name: "Deleted",
          last_name: "User",
          emergency_contact_name: null,
          emergency_contact_number: null,
          avatar_url: null,
          bio: null,
          updated_at: new Date().toISOString(),
        }).eq("id", user.id);
      } catch { /* ignore */ }

      // Step 2: Sign out client-side
      try {
        await signOut();
      } catch { /* ignore */ }

      // Step 3: Try to delete auth user via RPC (if defined); otherwise redirect and let admin handle
      try {
        await supabase.rpc("delete_auth_user", {});
      } catch { /* ignore */ }

      router.push("/");
    } catch (e: any) {
      flash(setError, "❌ " + (e.message || "Failed, contact an admin to delete your account"));
      setDeleteLoading(false);
    }
  };

  const startSetupAuthenticator = async () => {
    if (!user?.email) return;
    try {
      setLoading(true);
      setError("");

      let { data: profile } = await supabase
        .from("user_profiles")
        .select("two_factor_secret")
        .eq("id", user.id)
        .single();

      let currentSecret = profile?.two_factor_secret;
      if (!currentSecret) {
        currentSecret = authenticator.generateSecret();
        await supabase
          .from("user_profiles")
          .update({ two_factor_secret: currentSecret })
          .eq("id", user.id);
      }

      const url = authenticator.keyuri(user.email, "Rise On AI", currentSecret);
      setSecret(currentSecret);
      setQrCodeUrl(url);
      setShowSetup2FA(true);
    } catch (err) {
      setError("Failed to setup 2FA");
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable2FA = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError("");

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("two_factor_secret")
        .eq("id", user.id)
        .single();

      if (!profile?.two_factor_secret) {
        setError("Secret not found, please try again.");
        return;
      }

      const verified = authenticator.verify({
        secret: profile.two_factor_secret,
        token: verificationCode,
      });

      if (verified) {
        await supabase
          .from('user_profiles')
          .update({
            two_factor_enabled: true
          })
          .eq('id', user.id);
        setTwoFactorEnabled(true);
        setShowSetup2FA(false);
        setSuccess("Two-factor authentication enabled successfully!");
      } else {
        const expected = authenticator.generate(profile.two_factor_secret);
        setError(`Invalid verification code! Expected: ${expected}`);
      }
    } catch (err) {
      setError("Failed to verify code");
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!user) return;
    try {
      setLoading(true);
      await supabase
        .from('user_profiles')
        .update({
          two_factor_enabled: false,
          two_factor_secret: null
        })
        .eq('id', user.id);
      setTwoFactorEnabled(false);
      setSuccess("Two-factor authentication disabled");
    } catch (err) {
      setError("Failed to disable 2FA");
    } finally {
      setLoading(false);
    }
  };

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
              <Button onClick={saveNotificationSettings} disabled={saving}>{saving ? "Saving..." : "Save Notification Settings"}</Button>
            </div>
          </div>
        );

      case "privacy":
        return (
          <div className="space-y-4">
            <div className="mb-6">
              <h3 className="text-lg font-dm-serif text-dark-text mb-2">Privacy &amp; Data</h3>
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
                  <label className="flex items-center gap-2 text-sm font-inter">
                    <input
                      type="radio"
                      checked={privacySettings.profileVisibility === "counselor"}
                      onChange={() => setPrivacySettings({ ...privacySettings, profileVisibility: "counselor" })}
                      className="text-primary-blue focus:ring-primary-blue"
                    />
                    <span>Counselors Only (assigned counselor can view details)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm font-inter">
                    <input
                      type="radio"
                      checked={privacySettings.profileVisibility === "public"}
                      onChange={() => setPrivacySettings({ ...privacySettings, profileVisibility: "public" })}
                      className="text-primary-blue focus:ring-primary-blue"
                    />
                    <span>Public (basic info visible)</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={savePrivacySettings} disabled={saving}>{saving ? "Saving..." : "Save Privacy Settings"}</Button>
            </div>
          </div>
        );

      case "language":
        return (
          <div className="space-y-4">
            <div className="mb-6">
              <h3 className="text-lg font-dm-serif text-dark-text mb-2">Language &amp; Region</h3>
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
                <option value="Taglish">Taglish</option>
                <option value="Cebuano">Cebuano</option>
              </select>
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={saveLanguageSettings} disabled={saving}>{saving ? "Saving..." : "Save Language Preference"}</Button>
            </div>
          </div>
        );

      case "security":
        return (
          <div className="space-y-4">
            <div className="mb-6">
              <h3 className="text-lg font-dm-serif text-dark-text mb-2">Security &amp; Login</h3>
              <p className="text-sm text-dark-text/60 font-poppins">
                Manage your password and login security.
              </p>
            </div>
            {error && (
              <div className="text-error-red text-xs bg-error-red/10 p-3 rounded-lg font-poppins">
                {error}
              </div>
            )}
            {success && (
              <div className="text-green-600 text-xs bg-green-100 p-3 rounded-lg font-poppins">
                {success}
              </div>
            )}
            <div className="space-y-3">
              <Button variant="secondary" onClick={() => setShowChangePw(true)}>Change Password</Button>
              {!twoFactorEnabled ? (
                <div>
                  {!showSetup2FA ? (
                    <Button variant="ghost" onClick={startSetupAuthenticator} disabled={loading}>
                      {loading ? "Setting up..." : "Enable Two-Factor Authentication"}
                    </Button>
                  ) : (
                    <div className="p-4 bg-light-gray/30 rounded-xl space-y-4">
                      <h4 className="text-sm font-semibold font-poppins text-dark-text">Scan QR Code</h4>
                      <p className="text-xs text-dark-text/60 font-inter">
                        Scan this QR code with Google Authenticator or Authy
                      </p>
                      {qrCodeUrl && (
                        <div className="flex justify-center">
                          <div className="p-4 bg-white border border-light-gray rounded-xl">
                            <QRCodeSVG value={qrCodeUrl} size={192} level="H" includeMargin={true} />
                          </div>
                        </div>
                      )}
                      <div>
                        <Input
                          type="text"
                          placeholder="Enter verification code"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                          maxLength={6}
                          inputMode="numeric"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setShowSetup2FA(false)}>Cancel</Button>
                        <Button onClick={verifyAndEnable2FA} disabled={loading}>
                          {loading ? "Verifying..." : "Verify & Enable"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Button variant="ghost" className="text-soft-red" onClick={disable2FA} disabled={loading}>
                  {loading ? "Disabling..." : "Disable Two-Factor Authentication"}
                </Button>
              )}
            </div>
          </div>
        );

      case "data":
        return (
          <div className="space-y-4">
            <div className="mb-6">
              <h3 className="text-lg font-dm-serif text-dark-text mb-2">Data &amp; Export</h3>
              <p className="text-sm text-dark-text/60 font-poppins">
                Download or delete your data.
              </p>
            </div>
            {error && (
              <div className="text-error-red text-xs bg-error-red/10 p-3 rounded-lg font-poppins">{error}</div>
            )}
            {success && (
              <div className="text-green-600 text-xs bg-green-100 p-3 rounded-lg font-poppins">{success}</div>
            )}
            <div className="flex flex-col gap-3">
              <Button variant="secondary" onClick={downloadAllData} disabled={saving}>
                {saving ? "Preparing..." : "📥 Download All My Data"}
              </Button>
              <Button variant="ghost" className="text-soft-red" onClick={() => setShowDeleteConfirm(true)}>
                🗑️ Delete My Account
              </Button>
            </div>
            <p className="text-xs text-dark-text/50 font-inter mt-2">
              Export includes your profile, journal entries, mood logs, behavioral indicators, and support conversations.
            </p>
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
        <Card className="p-4 space-y-2 bg-white">
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
              <Image src="/icons/notifications.svg" alt="Notifications" width={16} height={16} className="w-4 h-4 object-contain" /> Notifications
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
              <Image src="/icons/privacy.svg" alt="Privacy" width={16} height={16} className="w-4 h-4 object-contain" /> Privacy
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
              <Image src="/icons/language.svg" alt="Language" width={16} height={16} className="w-4 h-4 object-contain" /> Language
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
              <Image src="/icons/security.svg" alt="Security" width={16} height={16} className="w-4 h-4 object-contain" /> Security
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
              <Image src="/icons/data-export.svg" alt="Data & Export" width={16} height={16} className="w-4 h-4 object-contain" /> Data & Export
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
              <Image src="/icons/account.svg" alt="Account" width={16} height={16} className="w-4 h-4 object-contain" /> Account
            </span>
          </button>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <Card className="p-6 bg-white">
          {renderSettingsContent()}
        </Card>
      </div>

      {/* Change Password Modal */}
      {showChangePw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-text/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-xl font-dm-serif text-dark-text">🔐 Change Password</h3>
                <p className="text-xs text-dark-text/60 font-poppins mt-1">Update your login credentials</p>
              </div>
              <button onClick={() => { setShowChangePw(false); setPwCurrent(""); setPwNew(""); setPwConfirm(""); }} className="text-dark-text/40 hover:text-dark-text text-2xl leading-none">×</button>
            </div>
            {error && <div className="text-error-red text-xs bg-error-red/10 p-3 rounded-lg font-poppins mb-3">{error}</div>}
            {success && <div className="text-green-600 text-xs bg-green-100 p-3 rounded-lg font-poppins mb-3">{success}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-poppins text-dark-text/70 mb-1 block">Current Password</label>
                <Input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} placeholder="Enter current password" />
              </div>
              <div>
                <label className="text-xs font-poppins text-dark-text/70 mb-1 block">New Password (min 6 chars)</label>
                <Input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="Enter new password" />
              </div>
              <div>
                <label className="text-xs font-poppins text-dark-text/70 mb-1 block">Confirm New Password</label>
                <Input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} placeholder="Repeat new password" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowChangePw(false); setPwCurrent(""); setPwNew(""); setPwConfirm(""); }}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-poppins text-dark-text hover:bg-gray-50"
              >Cancel</button>
              <button
                onClick={handleChangePassword}
                disabled={pwLoading}
                className="flex-1 px-4 py-2.5 bg-primary-blue text-white rounded-lg text-sm font-poppins hover:bg-primary-blue/90 disabled:opacity-60"
              >{pwLoading ? "Updating..." : "Update Password"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-text/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border-l-4 border-l-[#FF6B6B]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-dm-serif text-dark-text">⚠️ Delete My Account</h3>
                <p className="text-xs text-dark-text/70 font-poppins mt-1 leading-relaxed">
                  This is permanent and cannot be undone. Your profile will be anonymized and your support conversations may be retained for compliance.
                </p>
              </div>
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }} className="text-dark-text/40 hover:text-dark-text text-2xl leading-none">×</button>
            </div>
            {error && <div className="text-error-red text-xs bg-error-red/10 p-3 rounded-lg font-poppins mb-3">{error}</div>}
            <div className="space-y-3">
              <div className="p-3 bg-gradient-to-r from-red-400/20 to-pink-300/20 rounded-xl border border-[#FF6B6B]/20">
                <p className="text-xs font-poppins text-dark-text font-semibold mb-1">
                  Type exactly below to confirm:
                </p>
                <p className="text-sm font-mono text-[#FF6B6B] font-bold tracking-wide">DELETE MY ACCOUNT</p>
              </div>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type confirmation phrase here"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-poppins focus:outline-none focus:ring-2 focus:ring-[#FF6B6B]/30 focus:border-[#FF6B6B]"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-poppins text-dark-text hover:bg-gray-50"
              >Cancel, Keep My Account</button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-400 to-pink-300 text-white rounded-lg text-sm font-poppins hover:opacity-90 disabled:opacity-60"
              >{deleteLoading ? "Deleting..." : "Yes, Delete Forever"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
