"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COUNTRIES } from "@/lib/constants";
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
  country: string;
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
    country: "",
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

  // Keep track of whether we've completed the captcha on step 1
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
  const doPasswordsMatch = formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;

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
    // Check if captcha is enabled and completed
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
    setError("");
    return true;
  };

  const handleRegister = async () => {
    setLoading(true);
    setError("");

    try {
      // Execute reCAPTCHA
      if (!recaptchaToken) {
        if (recaptchaRef.current) {
          const token = await recaptchaRef.current.executeAsync();
          setRecaptchaToken(token);
        }
      }

      if (!recaptchaToken) {
        setError("Please complete the reCAPTCHA");
        setLoading(false);
        return;
      }

      // First, let's store the profile data in localStorage in case we need it after email confirmation!
      localStorage.setItem('pendingProfileData', JSON.stringify(formData));

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          // Optional: disable email confirmation in Supabase dashboard for dev!
          data: {
            // We can put some data here but full profile needs to be in user_profiles
          },
          captchaToken: recaptchaToken,
        }
      });

      console.log('Auth signUp response:', { authData, authError });

      if (authError) {
        localStorage.removeItem('pendingProfileData');
        // Handle rate limit errors with a friendly message
        if (authError.message.toLowerCase().includes("rate limit") || authError.message.toLowerCase().includes("too many")) {
          setError("Too many signups! Please wait a few minutes or log in. For development, you can disable email confirmation in your Supabase dashboard (Authentication → Providers → Email).");
        } else {
          setError(authError.message);
        }
        return;
      }

      if (authData.user) {
        console.log('User created! Now upserting complete profile...');

        // Prepare ALL profile data
        const profileData: any = {
          id: authData.user.id,
          username: formData.username,
          email: formData.email,
          role: 'user',
          full_name: `${formData.firstName} ${formData.lastName}`,
          first_name: formData.firstName,
          last_name: formData.lastName,
          goals: formData.goals,
          language: formData.language,
          country: formData.country,
          two_factor_enabled: false,
          two_factor_secret: null,
        };

        console.log('Full profile data:', profileData);

        // Use UPSERT! This will insert or update if the row already exists (from the trigger!)
        const { error: upsertError } = await supabase
          .from('user_profiles')
          .upsert(profileData, { onConflict: 'id' })
          .select();

        if (upsertError) {
          console.error('Upsert failed!', upsertError);
          setError(`Profile setup failed: ${upsertError.message}`);
          localStorage.removeItem('pendingProfileData');
          return;
        }

        localStorage.removeItem('pendingProfileData');
        console.log('Profile setup complete!');

        // Redirect to 2FA setup
        router.push('/setup-2fa');
        router.refresh();
      } else if (authData.session) {
        // If user is auto-confirmed (email confirmation off), we should have a user
        console.log('Session exists but no user?');
      } else {
        // Email confirmation is enabled - user needs to confirm first!
        setError('Please check your email to confirm your account! We saved your profile info.');
        // We can keep pendingProfileData in localStorage for after confirmation
        updateStep(1); // Or show a message
      }
    } catch (err) {
      console.error('Unexpected error in handleRegister:', err);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const toggleGoal = (goal: string) => {
    setFormData(prev => {
      if (prev.goals.includes(goal)) {
        return { ...prev, goals: prev.goals.filter(g => g !== goal) };
      } else {
        return { ...prev, goals: [...prev.goals, goal] };
      }
    });
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
            required
            placeholder="First Name"
          />
        </div>
        <div>
          <Input
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
            required
            placeholder="Last Name"
          />
        </div>
      </div>

      <div>
        <Input
          type="text"
          value={formData.username}
          onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
          required
          placeholder="Username"
        />
      </div>

      <div>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          required
          placeholder="Email Address"
        />
      </div>

      <div className="space-y-2">
        <Input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
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
          onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
          required
          placeholder="Confirm Password"
        />
        {formData.confirmPassword.length > 0 && (
          <div className="flex items-center gap-2 text-xs font-inter">
            <span className={`text-lg ${doPasswordsMatch ? "text-success-green" : "text-error-red"}`}>
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
          </button>. My mental health data is encrypted and never shared without consent.
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
              className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.goals.includes(goal)
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
        <h3 className="text-lg font-poppins font-semibold text-dark-text mb-3">Language Preference</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {["English", "Taglish"].map((lang) => (
              <div
                key={lang}
                onClick={() => setFormData(prev => ({ ...prev, language: lang }))}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${formData.language === lang
                  ? "border-primary-blue bg-primary-blue/10"
                  : "border-light-gray hover:border-primary-blue/50"
                  }`}
              >
                <p className="text-sm font-poppins text-dark-text">{lang}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-poppins font-semibold text-dark-text mb-3">Country</h3>
        <div className="space-y-3">
          <select
            value={formData.country}
            onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-light-gray focus:outline-none focus:ring-2 focus:ring-primary-blue/30 text-sm font-inter"
          >
            <option value="">Select your country</option>
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="text-center py-8 space-y-6">
      <div className="w-20 h-20 bg-gradient-to-r from-success-green to-teal rounded-full flex items-center justify-center mx-auto">
        <span className="text-white text-4xl">🎉</span>
      </div>
      <div>
        <h3 className="text-2xl font-dm-serif text-dark-text mb-2">You&apos;re Ready!</h3>
        <p className="text-sm font-inter text-dark-text/70">
          Welcome to Rise On AI! Your wellness journey starts now.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-4 w-full">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* reCAPTCHA v2 - always mounted! */}
        <div className="flex justify-center" style={{ display: (step === 1 || step === 3) ? 'flex' : 'none' }}>
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

        <div className="flex gap-3 pt-2">
          {step > 1 && (
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => updateStep(step - 1)}
            >
              Back
            </Button>
          )}
          {step < 3 && (
            <Button
              type="button"
              className="flex-1"
              onClick={() => {
                if (step === 1 && validateStep1()) {
                  updateStep(2);
                } else if (step === 2 && validateStep2()) {
                  updateStep(3);
                }
              }}
            >
              {step === 2 ? "Continue" : "Next"}
            </Button>
          )}
          {step === 3 && (
            <Button
              type="button"
              className="flex-1"
              disabled={loading}
              onClick={handleRegister}
            >
              {loading ? "Creating account..." : "Complete Setup"}
            </Button>
          )}
        </div>
      </div>
      {showPrivacyPolicy && <PrivacyPolicyModal onClose={() => setShowPrivacyPolicy(false)} />}
    </>
  );
}
