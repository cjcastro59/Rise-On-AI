"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Portal } from "@/components/ui/Portal";
import { useRBAC } from "@/hooks/useRBAC";

interface PrivacyPolicyModalProps {
  onClose: () => void;
}

// ── S13 (Phase 8): RA 10173 — Philippines Data Privacy Act of 2012 ────────────
// The previous default privacy policy was a generic placeholder that did not
// comply with the Data Privacy Act of 2012 (Republic Act No. 10173) and its
// Implementing Rules and Regulations (IRR).
//
// RA 10173 requires the following to be disclosed to data subjects:
//   1. Identity and contact details of the personal information controller (PIC)
//   2. Purpose and legal basis for processing personal data
//   3. Scope and method of collection
//   4. Recipients or classes of recipients of personal data
//   5. Rights of data subjects (Sections 16–18, RA 10173)
//   6. Retention period
//   7. Automated decision-making (if any)
//   8. Breach notification commitment
//   9. Reference to the National Privacy Commission (NPC)
//  10. How to exercise rights (complaints, erasure, portability)
//
// This default policy satisfies all of the above requirements.
// System admins/owners should customize the PIC name, DPO contact, and
// institution-specific details before deploying to production.
// ─────────────────────────────────────────────────────────────────────────────

const RA_10173_POLICY = `PRIVACY NOTICE
Rise On AI — AI-Assisted Mental Wellness Monitoring System
Effective Date: ${new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}

This Privacy Notice is issued in compliance with Republic Act No. 10173, known as the Data Privacy Act of 2012 (DPA), and its Implementing Rules and Regulations (IRR).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. IDENTITY OF THE PERSONAL INFORMATION CONTROLLER (PIC)

Rise On AI is operated by [Institution/Organization Name], hereinafter referred to as the "Personal Information Controller" or "PIC."

Data Protection Officer (DPO):
  Name: [DPO Name]
  Email: [dpo@institution.edu.ph]
  Address: [Institution Address]

For privacy-related concerns, please contact the DPO using the details above.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. PERSONAL DATA WE COLLECT

We collect the following categories of personal data:

a) Account Information
   • Full name, username, email address
   • Password (stored in hashed form only — we never store your plain-text password)
   • Sex, country, language preference
   • Wellness goals selected during registration

b) Sensitive Personal Information
   • Journal entries — your personal reflections and thoughts
   • Emotional/mood data — mood logs, sentiment classifications (Positive, Negative, Distress)
   • Behavioral and wellness indicators derived from your journal entries
   • Distress risk assessments (decision-support only; not a clinical diagnosis)
   • Two-factor authentication secret (stored encrypted at the database level)

c) Technical Data
   • Session tokens managed by Supabase Authentication
   • Usage timestamps (entry creation/update dates)
   • Device and browser information collected incidentally during session management

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. PURPOSES AND LEGAL BASIS FOR PROCESSING

We process your personal data for the following purposes:

a) Provision of the Service (Contractual Necessity — Section 12(b), RA 10173)
   • Creating and managing your user account
   • Storing and displaying your journal entries
   • Generating AI-assisted sentiment analysis, behavioral analytics, wellness assessments, and adaptive conversational responses
   • Enabling counselor assignment and user–counselor communication

b) Legitimate Interests (Section 12(f), RA 10173)
   • Improving the accuracy and performance of the AI model
   • Detecting and preventing misuse, fraud, or abuse of the platform
   • Platform administration, audit logging, and security monitoring

c) Compliance with Legal Obligations (Section 12(c), RA 10173)
   • Responding to lawful requests from government authorities
   • Complying with court orders, NPC directives, or applicable Philippine law

d) Consent (Section 12(a), RA 10173)
   • For any purpose not listed above, we will seek your explicit, informed consent before processing

Sensitive personal information (your journal entries and emotional data) is processed only on the basis of your explicit consent given at registration and reinforced by your voluntary use of the journaling feature.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. DATA SHARING AND RECIPIENTS

We do not sell, rent, or commercially exploit your personal data.

We may share your personal data only with:

a) Within the Platform
   • Assigned counselors — counselors assigned to you may view your journal history, sentiment data, and wellness indicators for the purpose of providing guidance and early intervention support.
   • Administrators and owners — for platform administration, audit, and compliance purposes only.

b) Third-Party Service Providers (Data Processors)
   • Supabase, Inc. — cloud database and authentication services. Supabase processes your data on our behalf and is contractually bound to protect it.
   • Google LLC — reCAPTCHA v2 (anti-bot verification at login and registration). Google's privacy policy applies to reCAPTCHA interactions.

c) Legal Disclosure
   • We may disclose personal data when required by Philippine law, court order, or a valid directive from the National Privacy Commission (NPC).

In all cases, data sharing is limited to what is strictly necessary for the stated purpose.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. DATA RETENTION

We retain your personal data for the following periods:

• Account and profile data: For the duration of your active account, plus 1 year after deletion or deactivation, unless a longer period is required by applicable law.
• Journal entries and emotional data: For the duration of your active account. You may delete individual entries or request deletion of all entries at any time.
• Audit logs: Up to 3 years from creation, for security and compliance purposes.
• Session tokens: Managed by Supabase Authentication; automatically invalidated on sign-out.

Upon the expiry of the retention period, personal data will be securely deleted or irreversibly anonymized.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. YOUR RIGHTS AS A DATA SUBJECT (Sections 16–18, RA 10173)

Under the Data Privacy Act of 2012, you have the following rights:

a) Right to be Informed
   You have the right to be informed of the processing of your personal data, including the purposes, the legal basis, and the recipients.

b) Right to Access (Section 16(c))
   You have the right to obtain a copy of the personal data we hold about you and information about how it is being processed.

c) Right to Rectification (Section 16(d))
   You have the right to correct inaccurate, incomplete, outdated, false, or unlawfully obtained personal data about you.

d) Right to Erasure or Blocking (Section 16(e))
   You have the right to suspend, withdraw, or order the blocking, removal, or destruction of your personal data from our systems, subject to legal and contractual retention obligations.

e) Right to Data Portability (Section 18)
   You have the right to obtain a copy of your personal data in a structured, commonly used, and machine-readable format, and to transmit it to another controller.

f) Right to Object (Section 16(f))
   You have the right to object to the processing of your personal data, including processing for direct marketing, profiling, or automated decision-making.

g) Right to Lodge a Complaint
   If you believe your rights under the DPA have been violated, you may file a complaint with the National Privacy Commission (NPC):
     Website: www.privacy.gov.ph
     Email: info@privacy.gov.ph
     Hotline: +632-8234-2228

To exercise any of these rights, please contact our Data Protection Officer using the details in Section 1 of this Notice. We will respond within fifteen (15) working days of receiving your request.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. AUTOMATED DECISION-MAKING AND AI PROCESSING

Rise On AI uses artificial intelligence (XLM-RoBERTa, a multilingual language model) to analyze your journal entries and produce:

• Sentiment classifications (Positive, Negative, or Distress)
• Behavioral indicators (journaling frequency, mood consistency, behavioral trend)
• A Wellness Score (0–10 scale)
• A Distress Risk Indicator (Low / Moderate / High / Critical Risk)
• Adaptive conversational responses

IMPORTANT DISCLAIMER: These AI-generated outputs are decision-support tools for self-reflection and counselor awareness only. They do NOT constitute clinical diagnoses, medical assessments, psychiatric evaluations, or professional mental health advice. No automated decision with legal or similarly significant effect is made solely on the basis of these outputs. All outputs require human review before any intervention is taken.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. DATA SECURITY

We implement the following security measures to protect your personal data:

• Encryption in transit: All data is transmitted over HTTPS (TLS).
• Authentication: Supabase Authentication with JWT session tokens and optional Two-Factor Authentication (TOTP via Google Authenticator or equivalent).
• Access controls: Role-Based Access Control (RBAC) and Row-Level Security (RLS) policies ensure that each user can only access their own data, except where explicitly authorized (e.g., assigned counselors).
• Database security: Supabase hosted infrastructure with encryption at rest.
• reCAPTCHA: Google reCAPTCHA v2 is used at login and registration to prevent automated abuse.

Despite these measures, no system can guarantee absolute security. In the event of a personal data breach that is likely to result in a risk to your rights and freedoms, we will notify affected data subjects and the National Privacy Commission within 72 hours of becoming aware of the breach, in accordance with Section 20(f) of RA 10173 and NPC Circular 16-03.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. COOKIES AND SESSION MANAGEMENT

We use session cookies managed by Supabase Authentication to maintain your login session. These cookies are:
• Set with HttpOnly and Secure flags where supported
• Subject to SameSite protections to mitigate cross-site request forgery
• Automatically invalidated when you sign out

We do not use third-party advertising or tracking cookies.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. CHANGES TO THIS NOTICE

We may update this Privacy Notice from time to time to reflect changes in our practices or applicable law. When we make material changes, we will update the "Effective Date" at the top of this Notice and, where required, notify you through the platform or by email.

Your continued use of Rise On AI after any update constitutes your acknowledgement of the revised Notice.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. GOVERNING LAW

This Privacy Notice is governed by and construed in accordance with the laws of the Republic of the Philippines, including Republic Act No. 10173 (Data Privacy Act of 2012), its Implementing Rules and Regulations, and applicable issuances of the National Privacy Commission (NPC).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For questions or concerns about this Privacy Notice or our data processing practices, please contact:

Data Protection Officer
[Institution/Organization Name]
Email: [dpo@institution.edu.ph]
Address: [Institution Address]
Contact Number: [+63 XXX XXX XXXX]
`;

export function PrivacyPolicyModal({ onClose }: PrivacyPolicyModalProps) {
  const { hasPermission } = useRBAC();
  const supabase = useMemo(() => createClient(), []);
  const [privacyPolicy,  setPrivacyPolicy]  = useState("");
  const [isEditing,      setIsEditing]      = useState(false);
  const [editablePolicy, setEditablePolicy] = useState("");
  const [loading,        setLoading]        = useState(false);

  const getDefaultPrivacyPolicy = useCallback(() => RA_10173_POLICY, []);

  const fetchPrivacyPolicy = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "privacy_policy")
        .single();

      const policy =
        !error && data?.value
          ? (typeof data.value === "string" ? data.value : JSON.stringify(data.value))
          : getDefaultPrivacyPolicy();

      setPrivacyPolicy(policy);
      setEditablePolicy(policy);
    } catch {
      const fallback = getDefaultPrivacyPolicy();
      setPrivacyPolicy(fallback);
      setEditablePolicy(fallback);
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
        .from("system_settings")
        .upsert({ key: "privacy_policy", value: editablePolicy }, { onConflict: "key" });

      if (error) {
        console.error("[privacy] Failed to save policy:", error.message);
        alert("Failed to save privacy policy. Please try again.");
      } else {
        setPrivacyPolicy(editablePolicy);
        setIsEditing(false);
        alert("Privacy policy saved successfully.");
      }
    } catch {
      alert("Failed to save privacy policy. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal */}
        <div
          className="relative bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden z-10 m-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="privacy-policy-title"
        >
          {/* Header */}
          <div className="p-6 border-b border-light-gray flex justify-between items-start gap-4">
            <div>
              <h2
                id="privacy-policy-title"
                className="text-xl font-dm-serif text-dark-text"
              >
                Privacy Notice
              </h2>
              <p className="text-[11px] text-dark-text/50 font-inter mt-0.5">
                In compliance with Republic Act No. 10173 (Data Privacy Act of 2012)
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {hasPermission("settings") && (
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
                  {isEditing ? "Cancel" : "Edit"}
                </Button>
              )}
              <Button variant="ghost" onClick={onClose} aria-label="Close privacy notice">
                ✕
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto max-h-[70vh]">
            {loading ? (
              <p className="text-xs text-dark-text/50 font-inter py-8 text-center">
                Loading privacy notice…
              </p>
            ) : isEditing ? (
              <div className="space-y-4">
                <p className="text-[11px] text-dark-text/50 font-inter">
                  Editing this policy as an admin. Ensure the updated text remains
                  compliant with RA 10173 before saving.
                </p>
                <textarea
                  value={editablePolicy}
                  onChange={(e) => setEditablePolicy(e.target.value)}
                  className="w-full h-96 p-4 border border-light-gray rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-blue/30 resize-y"
                  spellCheck={false}
                />
                <div className="flex justify-end">
                  <Button onClick={savePrivacyPolicy} disabled={loading}>
                    {loading ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-0">
                {privacyPolicy.split("\n").map((line, i) => {
                  // Section headings (━━━ separator lines)
                  if (line.startsWith("━")) {
                    return <hr key={i} className="my-4 border-light-gray" />;
                  }
                  // Bold section numbers (lines starting with a digit and dot)
                  if (/^\d+\.\s/.test(line) && line === line.toUpperCase()) {
                    return (
                      <h3
                        key={i}
                        className="text-sm font-poppins font-semibold text-dark-text mt-4 mb-2"
                      >
                        {line}
                      </h3>
                    );
                  }
                  // Title line
                  if (line === "PRIVACY NOTICE") {
                    return (
                      <h2
                        key={i}
                        className="text-base font-poppins font-bold text-dark-text mb-1"
                      >
                        {line}
                      </h2>
                    );
                  }
                  // IMPORTANT label
                  if (line.startsWith("IMPORTANT DISCLAIMER:")) {
                    return (
                      <p
                        key={i}
                        className="text-xs font-inter text-[#9B3A1E] bg-[#F4A6A6]/20 px-3 py-2 rounded-lg mb-2 leading-relaxed"
                      >
                        {line}
                      </p>
                    );
                  }
                  // Empty line → small spacer
                  if (!line.trim()) {
                    return <div key={i} className="h-1" />;
                  }
                  // Regular paragraph
                  return (
                    <p
                      key={i}
                      className="text-sm font-inter text-dark-text/80 leading-relaxed mb-1"
                    >
                      {line}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
