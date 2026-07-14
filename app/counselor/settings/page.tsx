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
import Link from "next/link";

type SettingSection = "counselor" | "notifications" | "privacy" | "language" | "security" | "data" | "account";

export default function CounselorSettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingSection>("counselor");
  const [notificationSettings, setNotificationSettings] = useState({
    emailAlerts: true,
    newCaseAlerts: true,
    messageAlerts: true,
  });
  const [privacySettings, setPrivacySettings] = useState({
    shareAnonymousData: true,
    profileVisibility: "private",
  });
  const [language, setLanguage] = useState("English");
  const [isOnline, setIsOnline] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const checkSettings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_profiles")
      .select("two_factor_enabled, is_online")
      .eq("id", user.id)
      .single();
    if (data) {
      setTwoFactorEnabled(data.two_factor_enabled);
      setIsOnline(data.is_online || false);
    }
  }, [supabase, user]);

  useEffect(() => {
    if (user) {
      checkSettings();
    }
  }, [checkSettings, user]);

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
          .from("user_profiles")
          .update({
            two_factor_enabled: true,
          })
          .eq("id", user.id);
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
        .from("user_profiles")
        .update({
          two_factor_enabled: false,
          two_factor_secret: null,
        })
        .eq("id", user.id);
      setTwoFactorEnabled(false);
      setSuccess("Two-factor authentication disabled");
    } catch (err) {
      setError("Failed to disable 2FA");
    } finally {
      setLoading(false);
    }
  };

  const toggleOnlineStatus = async () => {
    if (!user) return;
    try {
      setIsOnline(!isOnline);
      await supabase
        .from("user_profiles")
        .update({ is_online: !isOnline })
        .eq("id", user.id);
    } catch (err) {
      setIsOnline(isOnline);
      console.error("Failed to update online status", err);
    }
  };

  const renderSettingsContent = () => {
    switch (activeSection) {
      case "counselor":
        return (
          <div className="space-y-4">
            <div className="mb-6">
              <h3 className="text-lg font-dm-serif text-dark-text">Counselor Settings</h3>
              <p className="text-sm text-dark-text/60 font-poppins">
                Manage your availability and counselor preferences.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-light-gray/30 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold font-poppins text-dark-text">Set as Online</h4>
                  <p className="text-xs text-dark-text/60 font-inter">Show users that you are available to chat</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOnline}
                    onChange={toggleOnlineStatus}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-light-gray peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-blue"></div>
                </label>
              </div>
            </div>
          </div>
        );
      case "notifications":
        return (
          <div className="space-y-4">
            <div className="mb-6">
              <h3 className="text-lg font-dm-serif text-dark-text">Notifications</h3>
              <p className="text-sm text-dark-text/60 font-poppins">
                Control when and how you receive notifications.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-light-gray/30 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold font-poppins text-dark-text">Email Alerts</h4>
                  <p className="text-xs text-dark-text/60 font-inter">Receive email notifications for important updates</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.emailAlerts}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, emailAlerts: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-light-gray peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-blue"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-light-gray/30 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold font-poppins text-dark-text">New Case Alerts</h4>
                  <p className="text-xs text-dark-text/60 font-inter">Get notified when new distress cases are reported</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.newCaseAlerts}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, newCaseAlerts: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-light-gray peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-blue"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-light-gray/30 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold font-poppins text-dark-text">Message Alerts</h4>
                  <p className="text-xs text-dark-text/60 font-inter">Get notified when receiving new messages</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.messageAlerts}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, messageAlerts: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-light-gray peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-blue"></div>
                </label>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <Button className="bg-primary-blue text-white hover:bg-primary-blue/80">Save Notification Settings</Button>
            </div>
          </div>
        );

      case "privacy":
        return (
          <div className="space-y-4">
            <div className="mb-6">
              <h3 className="text-lg font-dm-serif text-dark-text">Privacy & Data</h3>
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
                  <div className="w-11 h-6 bg-light-gray peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-blue"></div>
                </label>
              </div>

              <div className="p-4 bg-light-gray/30 rounded-xl">
                <h4 className="text-sm font-semibold font-poppins text-dark-text mb-2">Profile Visibility</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-inter text-dark-text">
                    <input
                      type="radio"
                      checked={privacySettings.profileVisibility === "private"}
                      onChange={() => setPrivacySettings({ ...privacySettings, profileVisibility: "private" })}
                      className="text-primary-blue focus:ring-primary-blue"
                    />
                    <span>Private (Only assigned users can see your profile)</span>
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
              <h3 className="text-lg font-dm-serif text-dark-text">Language & Region</h3>
              <p className="text-sm text-dark-text/60 font-poppins">
                Choose your preferred language for the app.
              </p>
            </div>
            <div className="p-4 bg-light-gray/30 rounded-xl">
              <label className="text-xs font-poppins text-dark-text/60">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-light-gray bg-white text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
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
              <h3 className="text-lg font-dm-serif text-dark-text">Security & Login</h3>
              <p className="text-sm text-dark-text/60 font-poppins">
                Manage your password and login security.
              </p>
            </div>
            {error && (
              <div className="text-red-600 text-xs bg-red-50 p-3 rounded-lg font-poppins">
                {error}
              </div>
            )}
            {success && (
              <div className="text-green-600 text-xs bg-green-50 p-3 rounded-lg font-poppins">
                {success}
              </div>
            )}
            <div className="space-y-3">
              <Button variant="secondary" className="bg-light-gray text-dark-text hover:bg-light-gray/80 border-light-gray">Change Password</Button>
              {!twoFactorEnabled ? (
                <div>
                  {!showSetup2FA ? (
                    <Button variant="ghost" onClick={startSetupAuthenticator} disabled={loading} className="text-dark-text/80 hover:text-dark-text hover:bg-light-gray">
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
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                          maxLength={6}
                          inputMode="numeric"
                          className="bg-white border-light-gray text-dark-text placeholder-dark-text/50"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setShowSetup2FA(false)} className="text-dark-text/80 hover:text-dark-text hover:bg-light-gray">Cancel</Button>
                        <Button onClick={verifyAndEnable2FA} disabled={loading} className="bg-primary-blue text-white hover:bg-primary-blue/80">
                          {loading ? "Verifying..." : "Verify & Enable"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Button variant="ghost" className="text-red-600 hover:text-red-500 hover:bg-red-50" onClick={disable2FA} disabled={loading}>
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
              <h3 className="text-lg font-dm-serif text-dark-text">Data & Export</h3>
              <p className="text-sm text-dark-text/60 font-poppins">
                Download or delete your data.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button variant="secondary" className="bg-light-gray text-dark-text hover:bg-light-gray/80 border-light-gray">Download All My Data</Button>
              <Button variant="ghost" className="text-red-600 hover:text-red-500 hover:bg-red-50">Delete My Account</Button>
            </div>
          </div>
        );

      case "account":
        return (
          <div className="space-y-4">
            <div className="mb-6">
              <h3 className="text-lg font-dm-serif text-dark-text">Account</h3>
            </div>
            <p className="text-sm text-dark-text/60 font-poppins">
              Manage your account details here. Go to Profile to edit personal info.
            </p>
            <Link href="/counselor/profile">
              <Button variant="ghost" className="text-primary-blue hover:text-primary-blue/80 hover:bg-primary-blue/10">
                Go to Profile
              </Button>
            </Link>
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
        <Card variant="white" className="p-4 space-y-2">
          <h2 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4">Settings</h2>
          <button
            onClick={() => setActiveSection("counselor")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              activeSection === "counselor"
                ? "bg-primary-blue/20 text-primary-blue"
                : "text-dark-text/70 hover:text-dark-text hover:bg-light-gray"
            }`}
          >
            <span className="flex items-center gap-2">
              <Image src="/icons/account.svg" alt="Counselor" width={16} height={16} className="w-4 h-4 object-contain" /> Counselor
            </span>
          </button>
          <button
            onClick={() => setActiveSection("notifications")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
              activeSection === "notifications"
                ? "bg-primary-blue/20 text-primary-blue"
                : "text-dark-text/70 hover:text-dark-text hover:bg-light-gray"
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
                ? "bg-primary-blue/20 text-primary-blue"
                : "text-dark-text/70 hover:text-dark-text hover:bg-light-gray"
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
                ? "bg-primary-blue/20 text-primary-blue"
                : "text-dark-text/70 hover:text-dark-text hover:bg-light-gray"
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
                ? "bg-primary-blue/20 text-primary-blue"
                : "text-dark-text/70 hover:text-dark-text hover:bg-light-gray"
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
                ? "bg-primary-blue/20 text-primary-blue"
                : "text-dark-text/70 hover:text-dark-text hover:bg-light-gray"
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
                ? "bg-primary-blue/20 text-primary-blue"
                : "text-dark-text/70 hover:text-dark-text hover:bg-light-gray"
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
        <Card variant="white" className="p-6">
          {renderSettingsContent()}
        </Card>
      </div>
    </div>
  );
}
