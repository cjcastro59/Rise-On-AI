"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Portal } from "@/components/ui/Portal";
import { useRBAC } from "@/hooks/useRBAC";
import { Input } from "@/components/ui/input";

interface PrivacyPolicyModalProps {
  onClose: () => void;
}

export function PrivacyPolicyModal({ onClose }: PrivacyPolicyModalProps) {
  const { hasPermission } = useRBAC();
  const supabase = useMemo(() => createClient(), []);
  const [privacyPolicy, setPrivacyPolicy] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editablePolicy, setEditablePolicy] = useState("");
  const [loading, setLoading] = useState(false);

  const getDefaultPrivacyPolicy = useCallback(() => `
Privacy Policy

Last updated: ${new Date().toLocaleDateString()}

1. Introduction

Welcome to Rise On AI. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you about how we look after your personal data when you use our application and tell you about your privacy rights and how the law protects you.

2. Data We Collect

We may collect the following types of information:

- Personal identification information: Name, email address, username, and other information you provide during registration.
- Journal entries: Your personal reflections and emotional data you enter into the application.
- Usage data: Information about how you use our application.
- Device information: Information about your device and internet connection.

3. How We Use Your Data

We use your data to:
- Provide and maintain our service
- Improve and personalize your experience
- Analyze usage of our service
- Detect and prevent fraud
- Comply with legal obligations

4. Data Security

We implement appropriate security measures to protect your personal data. Your journal entries are encrypted and stored securely.

5. Data Sharing

We do not share your personal data with third parties except:
- With your consent
- To comply with legal obligations
- To protect and defend our rights and property

6. Your Rights

You have the right to:
- Access your personal data
- Correct your personal data
- Erase your personal data
- Restrict processing of your personal data
- Data portability
- Object to processing of your personal data

7. Changes to This Policy

We may update our privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page.

8. Contact Us

If you have any questions about this privacy policy, please contact us.
  `, []);

  const fetchPrivacyPolicy = useCallback(async () => {
    setLoading(true);
    try {
      // Try to fetch privacy policy from system_settings
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'privacy_policy')
        .single();

      if (error) {
        // If not found, use default
        setPrivacyPolicy(getDefaultPrivacyPolicy());
        setEditablePolicy(getDefaultPrivacyPolicy());
      } else {
        setPrivacyPolicy(data.value);
        setEditablePolicy(data.value);
      }
    } catch (err) {
      console.error(err);
      setPrivacyPolicy(getDefaultPrivacyPolicy());
      setEditablePolicy(getDefaultPrivacyPolicy());
    } finally {
      setLoading(false);
    }
  }, [getDefaultPrivacyPolicy, supabase]);

  useEffect(() => {
    fetchPrivacyPolicy();
  }, [fetchPrivacyPolicy]);

  const savePrivacyPolicy = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'privacy_policy', value: editablePolicy }, { onConflict: 'key' });

      if (error) {
        console.error(error);
        alert('Failed to save privacy policy');
      } else {
        setPrivacyPolicy(editablePolicy);
        setIsEditing(false);
        alert('Privacy policy saved successfully!');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save privacy policy');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/60"
          onClick={onClose}
        ></div>
        <div className="relative bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden z-10 m-4">
          <div className="p-6 border-b border-light-gray flex justify-between items-center">
            <h2 className="text-xl font-dm-serif text-dark-text">Privacy Policy</h2>
            <div className="flex items-center gap-3">
              {hasPermission('settings') && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (isEditing) {
                      setIsEditing(false);
                      setEditablePolicy(privacyPolicy);
                    } else {
                      setIsEditing(true);
                    }
                  }}
                  disabled={loading}
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={onClose}
              >
                ✕
              </Button>
            </div>
          </div>
          <div className="p-6 overflow-y-auto max-h-[70vh]">
            {isEditing ? (
              <div className="space-y-4">
                <textarea
                  value={editablePolicy}
                  onChange={(e) => setEditablePolicy(e.target.value)}
                  className="w-full h-96 p-4 border border-light-gray rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                />
                <div className="flex justify-end">
                  <Button onClick={savePrivacyPolicy} disabled={loading}>
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none">
                {privacyPolicy.split('\n').map((line, i) => (
                  <p key={i} className="mb-3 text-sm font-inter text-dark-text/80">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
