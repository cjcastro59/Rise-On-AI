"use client";

import { Card } from "@/components/ui/card";
import { useState } from "react";

export default function AdminSystemSettingsPage() {
  const [settings, setSettings] = useState({
    aiAnalysis: true,
    taglishSupport: true,
    autoCrisisDetection: true,
    emailAlerts: true,
    dataAnonymization: true,
    maintenanceMode: false,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text mb-1">System Settings</h1>
          <p className="text-sm text-dark-text/60 font-poppins">Configure safety, privacy, and AI response settings</p>
        </div>
        <button className="btn-primary">Save All Changes</button>
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
                <tr>
                  <td><span className="badge-success">Owner</span></td>
                  <td><span className="text-success-green">✅</span></td>
                  <td><span className="text-success-green">✅</span></td>
                  <td><span className="text-success-green">✅</span></td>
                  <td><span className="text-success-green">✅</span></td>
                  <td><span className="text-success-green">✅</span></td>
                  <td><span className="text-success-green">✅</span></td>
                </tr>
                <tr>
                  <td><span className="badge-info">Admin</span></td>
                  <td><span className="text-success-green">✅</span></td>
                  <td><span className="text-primary-blue">RAI-Only</span></td>
                  <td><span className="text-primary-blue">Aggregated</span></td>
                  <td><span className="text-success-green">✅</span></td>
                  <td><span className="text-error-red">❌</span></td>
                  <td><span className="text-primary-blue">Limited</span></td>
                </tr>
                <tr>
                  <td><span className="badge-warning">Counselor</span></td>
                  <td><span className="text-success-green">✅</span></td>
                  <td><span className="text-primary-blue">RAI-Only</span></td>
                  <td><span className="text-primary-blue">Aggregated</span></td>
                  <td><span className="text-success-green">✅</span></td>
                  <td><span className="text-error-red">❌</span></td>
                  <td><span className="text-primary-blue">Limited</span></td>
                </tr>
                <tr>
                  <td><span className="badge-warning">Researcher</span></td>
                  <td><span className="text-success-green">✅</span></td>
                  <td><span className="text-error-red">❌</span></td>
                  <td><span className="text-primary-blue">Aggregated</span></td>
                  <td><span className="text-error-red">❌</span></td>
                  <td><span className="text-error-red">❌</span></td>
                  <td><span className="text-primary-blue">Anonymous</span></td>
                </tr>
                <tr>
                  <td><span className="badge">User</span></td>
                  <td><span className="text-success-green">✅</span></td>
                  <td><span className="text-error-red">❌</span></td>
                  <td><span className="text-error-red">❌</span></td>
                  <td><span className="text-error-red">❌</span></td>
                  <td><span className="text-error-red">❌</span></td>
                  <td><span className="text-error-red">❌</span></td>
                </tr>
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
                  checked={settings.aiAnalysis}
                  onChange={(e) => setSettings({ ...settings, aiAnalysis: e.target.checked })}
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
                  checked={settings.taglishSupport}
                  onChange={(e) => setSettings({ ...settings, taglishSupport: e.target.checked })}
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
                  checked={settings.autoCrisisDetection}
                  onChange={(e) => setSettings({ ...settings, autoCrisisDetection: e.target.checked })}
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
                  checked={settings.emailAlerts}
                  onChange={(e) => setSettings({ ...settings, emailAlerts: e.target.checked })}
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
                  checked={settings.dataAnonymization}
                  onChange={(e) => setSettings({ ...settings, dataAnonymization: e.target.checked })}
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
                  checked={settings.maintenanceMode}
                  onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="toggle-switch"></div>
              </label>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-6">
          <button className="btn-primary">Save Settings</button>
          <button className="btn-secondary">Cancel</button>
        </div>
      </Card>
    </div>
  );
}
