"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReCAPTCHA from "react-google-recaptcha";
import { PrivacyPolicyModal } from "@/components/PrivacyPolicyModal";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

const PasswordRequirement = ({ label, satisfied }: { label: string; satisfied: boolean }) => (
  <div className="flex items-center gap-2 text-xs font-inter">
    <span className={`text-lg ${satisfied ? "text-success-green" : "text-dark-text/40"}`}>
      {satisfied ? "✓" : "✗"}
    </span>
    <span className={`${satisfied ? "text-dark-text" : "text-dark-text/60"}`}>{label}</span>
  </div>
);

interface FormData {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  goals: string[];
  language: string;
  sex: string;
}

interface RegisterFormProps {
  setStep?: (step: number) => void;
}

export function RegisterForm({ setStep }: RegisterFormProps = {}) {
  const [step, setStepLocal] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    goals: [],
    language: "English",
    sex: "",
  });
  const [privacyPolicyAccepted, setPrivacyPolicyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const router = useRouter();
  const supabase = createClient();
  const recaptchaKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [captchaCompletedOnStep1, setCaptchaCompletedOnStep1] = useState(false);

  // Reset captcha when going back to step 1
  useEffect(() => {
    if (step === 1) {
      setRecaptchaToken(null);
      setCaptchaCompletedOnStep1(false);
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
      }
    }
  }, [step]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const updateStep = (newStep: number) => {
    setStepLocal(newStep);
    if (setStep) {
      setStep(newStep);
    }
  };

  const passwordRequirements = [
    { label: "At least 8 characters", satisfied: formData.password.length >= 8 },
    { label: "One uppercase letter", satisfied: /[A-Z]/.test(formData.password) },
    { label: "One lowercase letter", satisfied: /[a-z]/.test(formData.password) },
    { label: "One number", satisfied: /\d/.test(formData.password) },
    { label: "One special character", satisfied: /[@$!%*?&]/.test(formData.password) },
  ];

  const isPasswordValid = PASSWORD_REGEX.test(formData.password);
  const doPasswordsMatch =
    formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;

  const validateStep1 = () => {
    if (!formData.firstName || !formData.lastName || !formData.username || !formData.email) {
      setError("Please fill out all fields.");
      return false;
    }
    if (!isPasswordValid) {
      setError("Please meet all password requirements.");
      return false;
    }
    if (!doPasswordsMatch) {
      setError("Passwords do not match.");
      return false;
    }
    if (!privacyPolicyAccepted) {
      setError("Please accept the Privacy Policy to proceed.");
      return false;
    }
    if (recaptchaKey && !recaptchaToken) {
      setError("Please complete the reCAPTCHA first.");
      return false;
    }
    setError("");
    return true;
  };

  const validateStep2 = () => {
    if (formData.goals.length === 0) {
      setError("Please select at least one goal.");
      return false;
    }
    if (!formData.sex) {
      setError("Please select your sex.");
      return false;
    }
    setError("");
    return true;
  };

  // Step 3 — send OTP to email, then show OTP input
  const handleSendOtp = async () => {
    setLoading(true);
    setError("");

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: formData.email,
        options: {
          shouldCreateUser: true,
          // Setting data: {} ensures Supabase sends a 6-digit OTP code
          // instead of a magic link. The OTP template must be enabled in
          // the Supabase dashboard under Authentication → Email Templates.
          data: {},
        },
      });

      if (otpError) {
        if (
          otpError.message.toLowerCase().includes("rate limit") ||
          otpError.message.toLowerCase().includes("too many")
        ) {
          setError("Too many attempts. Please wait a few minutes and try again.");
        } else {
          setError(otpError.message);
        }
        return;
      }

      setOtpSent(true);
      setResendCooldown(60);
    } catch {
      console.error("[register] Unexpected error sending OTP.");
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Verify the OTP code entered by the user, then create the profile
  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter the 6-digit code sent to your email.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: otpCode,
        type: "email",
      });

      if (verifyError) {
        if (
          verifyError.message.toLowerCase().includes("expired") ||
          verifyError.message.toLowerCase().includes("invalid")
        ) {
          setError("Invalid or expired code. Please request a new one.");
        } else {
          setError(verifyError.message);
        }
        return;
      }

      const userId = verifyData?.user?.id;
      if (!userId) {
        setError("Verification succeeded but no user session was found. Please try again.");
        return;
      }

      // Build and upsert the full profile row now that the email is confirmed
      const profileData: Record<string, unknown> = {
        id: userId,
        username: formData.username,
        email: formData.email,
        role: "user",
        full_name: `${formData.firstName} ${formData.lastName}`,
        first_name: formData.firstName,
        last_name: formData.lastName,
        goals: formData.goals,
        language: formData.language,
        sex: formData.sex,
        two_factor_enabled: false,
        two_factor_secret: null,
      };

      const { error: upsertError } = await supabase
        .from("user_profiles")
        .upsert(profileData, { onConflict: "id" })
        .select();

      if (upsertError) {
        console.error("[register] Profile upsert failed.");
        setError(`Profile setup failed: ${upsertError.message}`);
        return;
      }

      // Show "You're Ready!" step before redirecting
      updateStep(4);
      setTimeout(() => {
        router.push("/setup-2fa");
        router.refresh();
      }, 1800);
    } catch {
      console.error("[register] Unexpected error during OTP verification.");
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const toggleGoal = (goal: string) => {
    setFormData((prev) => {
      if (prev.goals.includes(goal)) {
        return { ...prev, goals: prev.goals.filter((g) => g !== goal) };
      } else {
        return { ...prev, goals: [...prev.goals, goal] };
      }
    });
  };

  // ── Step renderers ────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
            required
            placeholder="First Name"
          />
        </div>
        <div>
          <Input
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
            required
            placeholder="Last Name"
          />
        </div>
      </div>

      <div>
        <Input
          type="text"
          value={formData.username}
          onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
          required
          placeholder="Username"
        />
      </div>

      <div>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          required
          placeholder="Email Address"
        />
      </div>

      <div className="space-y-2">
        <Input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
          required
          placeholder="Password"
        />
        <div className="grid grid-cols-1 gap-1">
          {passwordRequirements.map((req, i) => (
            <PasswordRequirement key={i} label={req.label} satisfied={req.satisfied} />
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Input
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
          required
          placeholder="Confirm Password"
        />
        {formData.confirmPassword.length > 0 && (
          <div className="flex items-center gap-2 text-xs font-inter">
            <span
              className={`text-lg ${doPasswordsMatch ? "text-success-green" : "text-error-red"}`}
            >
              {doPasswordsMatch ? "✓" : "✗"}
            </span>
            <span className={`${doPasswordsMatch ? "text-dark-text" : "text-error-red"}`}>
              {doPasswordsMatch ? "Passwords match" : "Passwords do not match"}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1 accent-primary-blue"
          checked={privacyPolicyAccepted}
          onChange={(e) => setPrivacyPolicyAccepted(e.target.checked)}
        />
        <p className="text-xs font-inter text-dark-text/70">
          I agree to the{" "}
          <button
            type="button"
            className="text-primary-blue font-semibold hover:underline"
            onClick={() => setShowPrivacyPolicy(true)}
          >
            Privacy Policy
          </button>
          . My mental health data is encrypted and never shared without consent.
        </p>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-poppins font-semibold text-dark-text mb-3">Select your goals</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            "Reduce stress",
            "Improve mood",
            "Build gratitude",
            "Track emotions",
            "Better sleep",
            "Self-reflection",
          ].map((goal) => (
            <div
              key={goal}
              onClick={() => toggleGoal(goal)}
              className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                formData.goals.includes(goal)
                  ? "border-primary-blue bg-primary-blue/10"
                  : "border-light-gray hover:border-primary-blue/50"
              }`}
            >
              <p className="text-sm font-poppins text-dark-text">{goal}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-poppins font-semibold text-dark-text mb-3">
          Language Preference
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {["English", "Taglish"].map((lang) => (
            <div
              key={lang}
              onClick={() => setFormData((prev) => ({ ...prev, language: lang }))}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${
                formData.language === lang
                  ? "border-primary-blue bg-primary-blue/10"
                  : "border-light-gray hover:border-primary-blue/50"
              }`}
            >
              <p className="text-sm font-poppins text-dark-text">{lang}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-poppins font-semibold text-dark-text mb-3">Sex</h3>
        <select
          value={formData.sex}
          onChange={(e) => setFormData((prev) => ({ ...prev, sex: e.target.value }))}
          required
          className="w-full px-3 py-2 rounded-xl border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
        >
          <option value="">Select Sex</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </div>
    </div>
  );

  // Step 3 — verify email via OTP
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        {/* Envelope icon */}
        <div className="w-16 h-16 bg-primary-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4EAAB3"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <polyline points="2,4 12,13 22,4" />
          </svg>
        </div>
        <h3 className="text-xl font-dm-serif text-dark-text mb-1">Verify your email</h3>
        <p className="text-sm font-inter text-dark-text/70">
          We&apos;ll send a 6-digit code to{" "}
          <span className="font-semibold text-dark-text">{formData.email}</span>
        </p>
      </div>

      {!otpSent ? (
        // Before OTP is sent — just show the send button (triggered by Next button)
        <div className="p-4 bg-light-gray/30 rounded-xl text-center">
          <p className="text-xs font-inter text-dark-text/60">
            Click &quot;Send Code&quot; to receive the verification email.
          </p>
        </div>
      ) : (
        // After OTP is sent — show the code input
        <div className="space-y-4">
          <div className="p-3 bg-success-green/10 border border-success-green/30 rounded-xl text-center">
            <p className="text-xs font-inter text-success-green font-medium">
              Code sent! Check your inbox (and spam folder).
            </p>
          </div>

          <div>
            <label className="text-xs font-poppins text-slate-600 mb-1 block">
              Enter 6-digit verification code
            </label>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="text-center text-xl tracking-[0.4em] font-mono"
            />
          </div>

          <div className="text-center">
            <button
              type="button"
              disabled={resendCooldown > 0 || loading}
              onClick={handleSendOtp}
              className="text-xs font-poppins text-primary-blue hover:underline disabled:text-slate-400 disabled:no-underline transition-colors"
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Didn't receive it? Resend code"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Step 4 — success screen (previously step 3)
  const renderStep4 = () => (
    <div className="text-center py-8 space-y-6">
      <div className="w-20 h-20 bg-gradient-to-r from-success-green to-teal rounded-full flex items-center justify-center mx-auto">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div>
        <h3 className="text-2xl font-dm-serif text-dark-text mb-2">Email Verified!</h3>
        <p className="text-sm font-inter text-dark-text/70">
          Your account is confirmed. Setting up your profile…
        </p>
      </div>
    </div>
  );

  // ── Derived flags for button row ──────────────────────────────────────────
  // On step 3 the "Next" action differs depending on whether OTP has been sent
  const step3ButtonLabel = loading
    ? otpSent
      ? "Verifying…"
      : "Sending…"
    : otpSent
    ? "Verify & Continue"
    : "Send Code";

  const handleStep3Action = () => {
    if (!otpSent) {
      handleSendOtp();
    } else {
      handleVerifyOtp();
    }
  };

  return (
    <>
      <div className="space-y-4 w-full">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}

        {/* reCAPTCHA v2 — only visible on step 1 */}
        <div
          className="flex justify-center"
          style={{ display: step === 1 ? "flex" : "none" }}
        >
          {recaptchaKey && (
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={recaptchaKey}
              onChange={(token: string | null) => {
                setRecaptchaToken(token);
                if (step === 1) {
                  setCaptchaCompletedOnStep1(true);
                }
              }}
            />
          )}
          {!recaptchaKey && (
            <div className="text-xs text-dark-text/70 font-inter">
              Note: NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set in .env.local
            </div>
          )}
        </div>

        {error && (
          <div className="text-error-red text-xs bg-error-red/10 p-3 rounded-lg font-poppins">
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        {step < 4 && (
          <div className="flex gap-3 pt-2">
            {/* Back — not allowed on step 3 once OTP was sent (avoid resending confusion) */}
            {step > 1 && !(step === 3 && otpSent) && (
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setError("");
                  updateStep(step - 1);
                }}
              >
                Back
              </Button>
            )}

            {step === 1 && (
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  if (validateStep1()) updateStep(2);
                }}
              >
                Next
              </Button>
            )}

            {step === 2 && (
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  if (validateStep2()) updateStep(3);
                }}
              >
                Continue
              </Button>
            )}

            {step === 3 && (
              <Button
                type="button"
                className="flex-1"
                disabled={loading || (otpSent && otpCode.length < 6)}
                onClick={handleStep3Action}
              >
                {step3ButtonLabel}
              </Button>
            )}
          </div>
        )}
      </div>
      {showPrivacyPolicy && (
        <PrivacyPolicyModal onClose={() => setShowPrivacyPolicy(false)} />
      )}
    </>
  );
}
