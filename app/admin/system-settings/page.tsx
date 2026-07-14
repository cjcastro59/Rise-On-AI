"use client";

import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { authenticator } from "@otplib/preset-default";
import { QRCodeSVG } from "qrcode.react";

const supabase = createClient();

// Define permission types
type PermissionValue = "full" | "limited" | "rai-only" | "aggregated" | "none";

interface RolePermissions {
  [key: string]: {
    dashboard: boolean;
    userIds: PermissionValue;
    sentimentData: PermissionValue;
    alerts: boolean;
    settings: boolean;
    export: PermissionValue;
  };
}

const DEFAULT_PERMISSIONS: RolePermissions = {
  owner: {
    dashboard: true,
    userIds: "full",
    sentimentData: "full",
    alerts: true,
    settings: true,
    export: "full",
  },
  admin: {
    dashboard: true,
    userIds: "rai-only",
    sentimentData: "aggregated",
    alerts: true,
    settings: false,
    export: "limited",
  },
  counselor: {
    dashboard: true,
    userIds: "rai-only",
    sentimentData: "aggregated",
    alerts: true,
    settings: false,
    export: "limited",
  },
  user: {
    dashboard: true,
    userIds: "none",
    sentimentData: "none",
    alerts: false,
    settings: false,
    export: "none",
  },
};

const DEFAULT_FEATURES = {
  aiAnalysis: true,
  taglishSupport: true,
  autoCrisisDetection: true,
  emailAlerts: true,
  dataAnonymization: true,
  maintenanceMode: false,
};

type SettingSection = "system" | "notifications" | "privacy" | "language" | "security" | "data" | "account";

export default function AdminSystemSettingsPage() {
  const { user } = useAuth();
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [activeSection, setActiveSection] = useState<SettingSection>("system");
  
  // Personal settings state
  const [notificationSettings, setNotificationSettings] = useState({
    emailAlerts: true,
    newUserAlerts: true,
    distressAlertAlerts: true,
  });
  const [privacySettings, setPrivacySettings] = useState({
    shareAnonymousData: true,
    profileVisibility: "private",
  });
  const [language, setLanguage] = useState("English");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Check if current user is owner
  useEffect(() => {
    const checkOwner = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("user_profiles")
        .select("role, two_factor_enabled")
        .eq("id", user.id)
        .single();
      setIsOwner(data?.role === "owner");
      if (data) {
        setTwoFactorEnabled(data.two_factor_enabled);
      }
    };
    checkOwner();
  }, [user]);

  // Load settings from Supabase
  useEffect(() => {
    const loadSettings = async () => {
      if (!isOwner) return;
      
      try {
        const { data: rbacData, error: rbacError } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "rbac_permissions")
          .single();
        
        const { data: featuresData, error: featuresError } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "features")
          .single();

        console.log("Loaded RBAC data:", rbacData);
        console.log("Loaded Features data:", featuresData);
        if (rbacData && !rbacError) {
          // Handle cases where data might be stringified JSON
          const parsedRbac = typeof rbacData.value === 'string' ? JSON.parse(rbacData.value) : rbacData.value;
          setPermissions(parsedRbac as RolePermissions);
        }
        if (featuresData && !featuresError) {
          const parsedFeatures = typeof featuresData.value === 'string' ? JSON.parse(featuresData.value) : featuresData.value;
          setFeatures(parsedFeatures as typeof DEFAULT_FEATURES);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
        console.log("Using default settings");
      } finally {
        setLoading(false);
      }
    };

    if (isOwner) {
      loadSettings();
    } else {
      setLoading(false);
    }
  }, [isOwner]);

  // Update a single permission
  const updatePermission = (
    role: string,
    permission: keyof RolePermissions[string],
    value: boolean | PermissionValue
  ) => {
    setPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permission]: value,
      },
    }));
  };

  // Toggle a feature
  const toggleFeature = (feature: keyof typeof features, value: boolean) => {
    setFeatures(prev => ({
      ...prev,
      [feature]: value,
    }));
  };

  // Save system settings to Supabase
  const saveSystemSettings = async () => {
    if (!isOwner) return;

    try {
      console.log("Saving permissions:", permissions);
      console.log("Saving features:", features);
      
      // Save RBAC permissions
      const { error: rbacError } = await supabase
        .from("system_settings")
        .upsert(
          {
            key: "rbac_permissions",
            value: permissions,
          },
          { onConflict: "key" }
        );
      
      if (rbacError) {
        console.error("RBAC save error:", rbacError);
        throw rbacError;
      }

      // Save features
      const { error: featuresError } = await supabase
        .from("system_settings")
        .upsert(
          {
            key: "features",
            value: features,
          },
          { onConflict: "key" }
        );
      
      if (featuresError) {
        console.error("Features save error:", featuresError);
        throw featuresError;
      }

      // Log to audit logs
      await supabase
        .from("audit_logs")
        .insert({
          admin_id: user?.id,
          action: "Settings Change",
          details: "Updated system settings and RBAC permissions",
        });

      alert("System settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save system settings.");
    }
  };

  const startSetupAuthenticator = async () => {
    if (!user?.email) return;
    try {
      setLoadingPersonal(true);
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

      const url = authenticator.keyuri(user.email, "Rise On", currentSecret);
      setSecret(currentSecret);
      setQrCodeUrl(url);
      setShowSetup2FA(true);
    } catch (err) {
      setError("Failed to setup 2FA");
    } finally {
      setLoadingPersonal(false);
    }
  };

  const verifyAndEnable2FA = async () => {
    if (!user) return;
    try {
      setLoadingPersonal(true);
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
      setLoadingPersonal(false);
    }
  };

  const disable2FA = async () => {
    if (!user) return;
    try {
      setLoadingPersonal(true);
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
      setLoadingPersonal(false);
    }
  };

  // Render permission cell
  const renderPermissionCell = (
    role: string,
    permission: keyof RolePermissions[string],
    type: "boolean" | "select" = "boolean"
  ) => {
    if (!isOwner) {
      // Read-only mode for non-owners
      const value = permissions[role][permission];
      if (type === "boolean") {
        return (
          <span className={value ? "text-success-green" : "text-error-red"}>
            {value ? "✅" : "❌"}
          </span>
        );
      } else {
        return (
          <span className="text-sm font-poppins text-primary-blue">
            {value === "full" ? "✅" :
             value === "none" ? "❌" :
             value === "rai-only" ? "RAI-Only" :
             value === "aggregated" ? "Aggregated" : "Limited"}
          </span>
        );
      }
    }

    if (type === "boolean") {
      return (
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={permissions[role][permission] as boolean}
            onChange={(e) => updatePermission(role, permission, e.target.checked)}
            className="sr-only peer"
          />
          <div className="toggle-switch"></div>
        </label>
      );
    } else {
      return (
        <select
          value={permissions[role][permission] as PermissionValue}
          onChange={(e) => updatePermission(role, permission, e.target.value as PermissionValue)}
          className="px-2 py-1 border border-gray-200 rounded-lg text-xs font-poppins text-dark-text bg-white focus:outline-none focus:ring-2 focus:ring-primary-blue/50"
        >
          <option value="full">✅ Full</option>
          <option value="rai-only">RAI-Only</option>
          <option value="aggregated">Aggregated</option>
          <option value="limited">Limited</option>
          <option value="none">❌ None</option>
        </select>
      );
    }
  };

  const renderSettingsContent = () => {
    switch (activeSection) {
      case "system":
        if (!isOwner) {
          return (
            <div className="space-y-6">
              <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-xl">
                <p className="text-sm font-poppins text-yellow-800">
                  ⚠️ Only owners can modify system settings and RBAC permissions.
                </p>
              </div>

              {/* Read-only view of current settings */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card variant="white" className="lg:col-span-1 p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-primary-blue/20 rounded-lg flex items-center justify-center">⚙️</div>
                    <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider">Global Settings</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-poppins text-dark-text">Platform Name</p>
                      <span className="text-sm font-poppins text-dark-text/60">Rise On</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-poppins text-dark-text">Institution</p>
                      <span className="text-sm font-poppins text-dark-text/60">Multi-University Platform</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-poppins text-dark-text">Support Email</p>
                      <span className="text-sm font-poppins text-dark-text/60">support@rise-on.edu.ph</span>
                    </div>
                  </div>
                </Card>

                <Card variant="white" className="lg:col-span-2 p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-lavender/20 rounded-lg flex items-center justify-center">🔐</div>
                    <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider">Role-Based Access Control</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>ROLE</th>
                          <th>DASHBOARD</th>
                          <th>USER IDS</th>
                          <th>SENTIMENT DATA</th>
                          <th>ALERTS</th>
                          <th>SETTINGS</th>
                          <th>EXPORT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(permissions).map((role) => (
                          <tr key={role}>
                            <td>
                              <span className={`badge ${
                                role === "owner" ? "badge-error" :
                                role === "admin" ? "badge-success" :
                                role === "counselor" ? "badge-info" :
                                ""
                              }`}>
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                              </span>
                            </td>
                            <td>{renderPermissionCell(role, "dashboard", "boolean")}</td>
                            <td>{renderPermissionCell(role, "userIds", "select")}</td>
                            <td>{renderPermissionCell(role, "sentimentData", "select")}</td>
                            <td>{renderPermissionCell(role, "alerts", "boolean")}</td>
                            <td>{renderPermissionCell(role, "settings", "boolean")}</td>
                            <td>{renderPermissionCell(role, "export", "select")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Global Settings */}
              <Card variant="white" className="lg:col-span-1 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-primary-blue/20 rounded-lg flex items-center justify-center">⚙️</div>
                  <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider">Global Settings</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-poppins text-dark-text">Platform Name</p>
                    <span className="text-sm font-poppins text-dark-text/60">Rise On</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-poppins text-dark-text">Institution</p>
                    <span className="text-sm font-poppins text-dark-text/60">Multi-University Platform</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-poppins text-dark-text">Support Email</p>
                    <span className="text-sm font-poppins text-dark-text/60">support@rise-on.edu.ph</span>
                  </div>
                </div>
              </Card>

              {/* Role-Based Access */}
              <Card variant="white" className="lg:col-span-2 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-lavender/20 rounded-lg flex items-center justify-center">🔐</div>
                  <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider">Role-Based Access Control</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ROLE</th>
                        <th>DASHBOARD</th>
                        <th>USER IDS</th>
                        <th>SENTIMENT DATA</th>
                        <th>ALERTS</th>
                        <th>SETTINGS</th>
                        <th>EXPORT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(permissions).map((role) => (
                        <tr key={role}>
                          <td>
                            <span className={`badge ${
                              role === "owner" ? "badge-error" :
                              role === "admin" ? "badge-success" :
                              role === "counselor" ? "badge-info" :
                              ""
                            }`}>
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </span>
                          </td>
                          <td>{renderPermissionCell(role, "dashboard", "boolean")}</td>
                          <td>{renderPermissionCell(role, "userIds", "select")}</td>
                          <td>{renderPermissionCell(role, "sentimentData", "select")}</td>
                          <td>{renderPermissionCell(role, "alerts", "boolean")}</td>
                          <td>{renderPermissionCell(role, "settings", "boolean")}</td>
                          <td>{renderPermissionCell(role, "export", "select")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Features & Alerts */}
            <Card variant="white" className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-success-green/30 rounded-lg flex items-center justify-center">🤖</div>
                <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider">AI Modules & Alert Rules</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-poppins text-dark-text">AI Sentiment Analysis</p>
                      <p className="text-xs text-dark-text/60 font-inter">Enable emotion detection on journal entries</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={features.aiAnalysis}
                        onChange={(e) => toggleFeature("aiAnalysis", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="toggle-switch"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-poppins text-dark-text">Taglish NLP Mode</p>
                      <p className="text-xs text-dark-text/60 font-inter">Supports mixed Filipino & English text</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={features.taglishSupport}
                        onChange={(e) => toggleFeature("taglishSupport", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="toggle-switch"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-poppins text-dark-text">Auto Crisis Detection</p>
                      <p className="text-xs text-dark-text/60 font-inter">Automatic flagging of self-harm keywords</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={features.autoCrisisDetection}
                        onChange={(e) => toggleFeature("autoCrisisDetection", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="toggle-switch"></div>
                    </label>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-poppins text-dark-text">Email Alerts to Counselors</p>
                      <p className="text-xs text-dark-text/60 font-inter">Send notifications for high-severity distress flags</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={features.emailAlerts}
                        onChange={(e) => toggleFeature("emailAlerts", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="toggle-switch"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-poppins text-dark-text">Data Anonymization</p>
                      <p className="text-xs text-dark-text/60 font-inter">Hides real names; protects user privacy</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={features.dataAnonymization}
                        onChange={(e) => toggleFeature("dataAnonymization", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="toggle-switch"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-poppins text-dark-text">Maintenance Mode</p>
                      <p className="text-xs text-dark-text/60 font-inter">Temporarily disable new entries for updates</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={features.maintenanceMode}
                        onChange={(e) => toggleFeature("maintenanceMode", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="toggle-switch"></div>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <button className="btn-primary" onClick={saveSystemSettings}>Save System Settings</button>
                <button className="btn-secondary" onClick={() => {
                  setPermissions(DEFAULT_PERMISSIONS);
                  setFeatures(DEFAULT_FEATURES);
                }}>Reset to Defaults</button>
              </div>
            </Card>
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
              <div className="flex items-center justify-between p-4 bg-light-gray/50 rounded-xl">
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
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-blue"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-light-gray/50 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold font-poppins text-dark-text">New User Alerts</h4>
                  <p className="text-xs text-dark-text/60 font-inter">Get notified when new users register</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.newUserAlerts}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, newUserAlerts: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-blue"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-light-gray/50 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold font-poppins text-dark-text">Distress Alert Alerts</h4>
                  <p className="text-xs text-dark-text/60 font-inter">Get notified when new distress alerts are received</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.distressAlertAlerts}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, distressAlertAlerts: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-blue"></div>
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
              <div className="flex items-center justify-between p-4 bg-light-gray/50 rounded-xl">
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
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-blue"></div>
                </label>
              </div>

              <div className="p-4 bg-light-gray/50 rounded-xl">
                <h4 className="text-sm font-semibold font-poppins text-dark-text mb-2">Profile Visibility</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-inter text-dark-text">
                    <input
                      type="radio"
                      checked={privacySettings.profileVisibility === "private"}
                      onChange={() => setPrivacySettings({ ...privacySettings, profileVisibility: "private" })}
                      className="text-primary-blue focus:ring-primary-blue"
                    />
                    <span>Private (Only admins can see your profile)</span>
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
            <div className="p-4 bg-light-gray/50 rounded-xl">
              <label className="text-xs font-poppins text-dark-text/60">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-light-gray bg-white focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
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
              <div className="text-red-500 text-xs bg-red-50 p-3 rounded-lg font-poppins">
                {error}
              </div>
            )}
            {success && (
              <div className="text-green-500 text-xs bg-green-50 p-3 rounded-lg font-poppins">
                {success}
              </div>
            )}
            <div className="space-y-3">
              <Button variant="secondary" className="bg-gray-100 text-dark-text hover:bg-gray-200 border-gray-200">Change Password</Button>
              {!twoFactorEnabled ? (
                <div>
                  {!showSetup2FA ? (
                    <Button variant="ghost" onClick={startSetupAuthenticator} disabled={loadingPersonal} className="text-dark-text/70 hover:text-dark-text hover:bg-gray-100">
                      {loadingPersonal ? "Setting up..." : "Enable Two-Factor Authentication"}
                    </Button>
                  ) : (
                    <div className="p-4 bg-light-gray/50 rounded-xl space-y-4">
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
                          className="bg-white border-light-gray text-dark-text placeholder-gray-400"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setShowSetup2FA(false)} className="text-dark-text/70 hover:text-dark-text hover:bg-gray-100">Cancel</Button>
                        <Button onClick={verifyAndEnable2FA} disabled={loadingPersonal} className="bg-primary-blue text-white hover:bg-primary-blue/80">
                          {loadingPersonal ? "Verifying..." : "Verify & Enable"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Button variant="ghost" className="text-red-500 hover:text-red-400 hover:bg-red-50" onClick={disable2FA} disabled={loadingPersonal}>
                  {loadingPersonal ? "Disabling..." : "Disable Two-Factor Authentication"}
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
              <Button variant="secondary" className="bg-gray-100 text-dark-text hover:bg-gray-200 border-gray-200">Download All My Data</Button>
              <Button variant="ghost" className="text-red-500 hover:text-red-400 hover:bg-red-50">Delete My Account</Button>
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
            <Link href="/admin/profile">
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
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-1">System Settings</h1>
          <p className="text-sm text-dark-text/60 font-poppins">Configure system, personal, and security settings</p>
        </div>
        {activeSection === "system" && isOwner && (
          <button className="btn-primary" onClick={saveSystemSettings}>
            Save All Changes
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Settings Sidebar */}
        <div className="w-64 flex-shrink-0 hidden md:block">
          <Card variant="white" className="p-4 space-y-2 bg-white border border-gray-100">
            <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider mb-4">Settings</p>
            <button
              onClick={() => setActiveSection("system")}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
                activeSection === "system"
                  ? "bg-primary-blue/10 text-primary-blue"
                  : "text-dark-text/70 hover:text-dark-text hover:bg-gray-100"
              }`}
            >
              <span className="flex items-center gap-2">
                <Image src="/icons/settings.svg" alt="System" width={16} height={16} className="w-4 h-4 object-contain" /> System
              </span>
            </button>
            <button
              onClick={() => setActiveSection("notifications")}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-poppins transition-all ${
                activeSection === "notifications"
                  ? "bg-primary-blue/10 text-primary-blue"
                  : "text-dark-text/70 hover:text-dark-text hover:bg-gray-100"
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
                  : "text-dark-text/70 hover:text-dark-text hover:bg-gray-100"
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
                  : "text-dark-text/70 hover:text-dark-text hover:bg-gray-100"
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
                  : "text-dark-text/70 hover:text-dark-text hover:bg-gray-100"
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
                  : "text-dark-text/70 hover:text-dark-text hover:bg-gray-100"
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
                  : "text-dark-text/70 hover:text-dark-text hover:bg-gray-100"
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
          <Card variant="white" className="p-6 bg-white border border-gray-100">
            {renderSettingsContent()}
          </Card>
        </div>
      </div>
    </div>
  );
}
