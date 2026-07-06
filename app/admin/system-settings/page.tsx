"use client";

import { Card } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

export default function AdminSystemSettingsPage() {
  const { user } = useAuth();
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [features, setFeatures] = useState(DEFAULT_FEATURES);

  // Check if current user is owner
  useEffect(() => {
    const checkOwner = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setIsOwner(data?.role === "owner");
    };
    checkOwner();
  }, [user]);

  // Load settings from Supabase
  useEffect(() => {
    const loadSettings = async () => {
      if (!isOwner) return;
      
      try {
        const { data: rbacData } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "rbac_permissions")
          .single();
        
        const { data: featuresData } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "features")
          .single();

        if (rbacData) setPermissions(rbacData.value as RolePermissions);
        if (featuresData) setFeatures(featuresData.value as typeof DEFAULT_FEATURES);
      } catch (error) {
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

  // Save settings to Supabase
  const saveSettings = async () => {
    if (!isOwner) return;

    try {
      // Save RBAC permissions
      await supabase
        .from("system_settings")
        .upsert({
          key: "rbac_permissions",
          value: permissions,
        });

      // Save features
      await supabase
        .from("system_settings")
        .upsert({
          key: "features",
          value: features,
        });

      // Log to audit logs
      await supabase
        .from("audit_logs")
        .insert({
          admin_id: user?.id,
          action: "Settings Change",
          details: "Updated system settings and RBAC permissions",
        });

      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings.");
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

  if (!isOwner) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-dm-serif text-dark-text mb-1">System Settings</h1>
            <p className="text-sm text-dark-text/60 font-poppins">Configure safety, privacy, and AI response settings</p>
          </div>
        </div>

        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-xl">
          <p className="text-sm font-poppins text-yellow-800">
            ⚠️ Only owners can modify system settings and RBAC permissions.
          </p>
        </div>

        {/* Read-only view of current settings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 p-6">
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

          <Card className="lg:col-span-2 p-6">
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
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-1">System Settings</h1>
          <p className="text-sm text-dark-text/60 font-poppins">Configure safety, privacy, and AI response settings</p>
        </div>
        <button className="btn-primary" onClick={saveSettings}>
          Save All Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Global Settings */}
        <Card className="lg:col-span-1 p-6">
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
        <Card className="lg:col-span-2 p-6">
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
      <Card className="p-6">
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
          <button className="btn-primary" onClick={saveSettings}>Save Settings</button>
          <button className="btn-secondary" onClick={() => {
            setPermissions(DEFAULT_PERMISSIONS);
            setFeatures(DEFAULT_FEATURES);
          }}>Reset to Defaults</button>
        </div>
      </Card>
    </div>
  );
}
