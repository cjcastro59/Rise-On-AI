"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  age: string;
  gender: string;
  country: string;
  moodBaseline: string;
  password: string;
  confirmPassword: string;
  goals: string[];
  language: string;
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
    age: "",
    gender: "",
    country: "",
    moodBaseline: "",
    password: "",
    confirmPassword: "",
    goals: [],
    language: "English",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

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
    if (!formData.firstName || !formData.lastName || !formData.username || !formData.email || !formData.age || !formData.gender || !formData.country || !formData.moodBaseline) {
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        // Handle rate limit errors with a friendly message
        if (authError.message.toLowerCase().includes("rate limit") || authError.message.toLowerCase().includes("too many")) {
          setError("Too many signups! Please wait a few minutes or log in. For development, you can disable email confirmation in your Supabase dashboard (Authentication → Providers → Email).");
        } else {
          setError(authError.message);
        }
        return;
      }

      if (authData.user) {
        // Prepare profile data with optional columns
        const profileData: any = {
          id: authData.user.id,
          username: formData.username,
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          role: "user",
        };
        
        // Add optional columns (will be ignored if they don't exist in the table yet)
        if (formData.age) profileData.age = parseInt(formData.age);
        if (formData.gender) profileData.gender = formData.gender;
        if (formData.country) profileData.country = formData.country;
        if (formData.moodBaseline) profileData.mood_baseline = formData.moodBaseline;
        if (formData.goals.length > 0) profileData.goals = formData.goals;
        if (formData.language) profileData.language = formData.language;

        // Try to insert profile - if it already exists, do an upsert (update instead)
        try {
          const { error: profileError } = await (supabase
            .from("user_profiles") as any)
            .upsert(profileData, {
              onConflict: "id", // If the ID already exists, update instead of inserting
            });

          if (profileError) {
            console.warn("Profile creation/update failed:", profileError);
            // Still continue - user is authenticated
          }
        } catch (err) {
          console.warn("Profile insert failed:", err);
          // Ignore errors - user is already authenticated
        }

        // Always redirect to dashboard after successful auth
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input
            type="number"
            value={formData.age}
            onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
            required
            placeholder="Age"
          />
        </div>
        <div>
          <select
            value={formData.gender}
            onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
            className="w-full px-4 py-3 bg-light-gray border border-transparent rounded-lg text-sm font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue"
          >
            <option value="">Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <select
            value={formData.country}
            onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
            className="w-full px-4 py-3 bg-light-gray border border-transparent rounded-lg text-sm font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue"
          >
            <option value="">Country</option>
            <option value="philippines">Philippines</option>
            <option value="usa">USA</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <select
            value={formData.moodBaseline}
            onChange={(e) => setFormData(prev => ({ ...prev, moodBaseline: e.target.value }))}
            className="w-full px-4 py-3 bg-light-gray border border-transparent rounded-lg text-sm font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue"
          >
            <option value="">Current Mood Baseline</option>
            <option value="happy">Happy</option>
            <option value="calm">Calm</option>
            <option value="anxious">Anxious</option>
            <option value="sad">Sad</option>
          </select>
        </div>
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
        <input type="checkbox" className="mt-1 accent-primary-blue" required />
        <p className="text-xs font-inter text-dark-text/70">
          I agree to the Privacy Policy. My mental health data is encrypted and never shared without consent.
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
        <h3 className="text-lg font-poppins font-semibold text-dark-text mb-3">Select your language</h3>
        <select
          value={formData.language}
          onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
          className="w-full px-4 py-3 bg-light-gray border border-transparent rounded-lg text-sm font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue"
        >
          <option value="English">English</option>
          <option value="Taglish">Taglish</option>
        </select>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="text-center py-8 space-y-6">
      <div className="w-20 h-20 bg-gradient-to-r from-success-green to-teal rounded-full flex items-center justify-center mx-auto">
        <span className="text-white text-4xl">🎉</span>
      </div>
      <div>
        <h3 className="text-2xl font-dm-serif text-dark-text mb-2">You're Ready!</h3>
        <p className="text-sm font-inter text-dark-text/70">
          Welcome to Rise On AI! Your wellness journey starts now.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 w-full">
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}

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
  );
}