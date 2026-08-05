"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authenticator } from "@otplib/preset-default";
import ReCAPTCHA from "react-google-recaptcha";

type LoginStep = "credentials" | "2fa";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<LoginStep>("credentials");
  const [userId, setUserId] = useState<string | null>(null);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const recaptchaKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  // Function to apply pending profile data
  const applyPendingProfileData = useCallback(async (userId: string) => {
    const pendingDataStr = localStorage.getItem('pendingProfileData');
    if (!pendingDataStr) return;

    try {
      const formData = JSON.parse(pendingDataStr);
      const profileData: any = {
        username: formData.username,
        email: formData.email,
        role: 'user',
        full_name: `${formData.firstName} ${formData.lastName}`,
        first_name: formData.firstName,
        last_name: formData.lastName,
        goals: formData.goals,
        language: formData.language,
        two_factor_enabled: false,
        two_factor_secret: null,
      };

      console.log('Applying pending profile data:', profileData);
      
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(profileData)
        .eq('id', userId)
        .select();

      if (updateError) {
        console.error('Failed to update pending profile:', updateError);
      } else {
        console.log('Pending profile applied successfully!');
        localStorage.removeItem('pendingProfileData');
      }
    } catch (err) {
      console.error('Error parsing pending profile data:', err);
      localStorage.removeItem('pendingProfileData');
    }
  }, [supabase]);

  // Check if user is already logged in on component mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log("🔍 Checking existing session");
        
        // Check if user has 2FA enabled
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('two_factor_enabled')
          .eq('id', session.user.id)
          .single();
          
        if (profile?.two_factor_enabled) {
          console.log("🔑 User has 2FA enabled, staying on login page to show verification");
          setUserId(session.user.id);
          setStep("2fa");
        } else {
          console.log("🚀 User doesn't have 2FA enabled, redirecting to dashboard");
          await applyPendingProfileData(session.user.id);
          router.push("/dashboard");
          router.refresh();
        }
      }
    };
    checkSession();
  }, [applyPendingProfileData, router, supabase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      console.log("🔐 Starting login process");
      
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

      console.log("📝 Signing in with password");
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken: recaptchaToken,
        },
      });

      if (error) {
        console.error("❌ Login error:", error);
        if (error.message.toLowerCase().includes("rate limit") || error.message.toLowerCase().includes("too many")) {
          setError("Too many login attempts! Please wait a few minutes and try again.");
        } else {
          setError(error.message);
        }
      } else if (data.session) {
        console.log("✅ Signed in successfully");
        console.log("👤 User ID:", data.session.user.id);
        
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('two_factor_enabled')
          .eq('id', data.session.user.id)
          .single();
          
        console.log("📋 User profile:", profile);

        if (profile?.two_factor_enabled) {
          console.log("🔑 2FA is enabled, showing verification step");
          setUserId(data.session.user.id);
          setStep("2fa");
        } else {
          console.log("🚀 2FA not enabled, redirecting to dashboard");
          await applyPendingProfileData(data.session.user.id);
          router.push("/dashboard");
          router.refresh();
        }
      }
    } catch (err) {
      console.error("💥 Unexpected error:", err);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handle2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let verified = false;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('two_factor_secret')
        .eq('id', userId)
        .single();

      if (profile?.two_factor_secret) {
        verified = authenticator.verify({
          secret: profile.two_factor_secret,
          token: totpCode,
        });
      }

      if (verified) {
        if (userId) {
          await applyPendingProfileData(userId);
          router.push("/dashboard");
          router.refresh();
        }
      } else {
        setError("Invalid verification code! Please try again.");
      }
    } catch (err) {
      console.error("💥 Unexpected error:", err);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (step === "2fa") {
    return (
      <form onSubmit={handle2FA} className="space-y-4 w-full">
        <div>
          <p className="text-sm font-poppins text-dark-text mb-2">
            Enter the 6-digit code from your authenticator app
          </p>
          <Input
            type="text"
            value={totpCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              setTotpCode(value);
            }}
            required
            placeholder="Enter 6-digit code"
            maxLength={6}
            inputMode="numeric"
          />
        </div>

        {error && (
          <div className="text-error-red text-xs bg-error-red/10 p-3 rounded-lg font-poppins">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setStep("credentials")} className="flex-1">
            Back
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? "Verifying..." : "Verify →"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4 w-full">
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Email or Username"
          />
        </div>
        <div>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Password"
          />
        </div>
        <div className="flex justify-center">
          {recaptchaKey && (
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={recaptchaKey}
              onChange={(token: string | null) => setRecaptchaToken(token)}
            />
          )}
        </div>
        {error && (
          <div className="text-error-red text-xs bg-error-red/10 p-3 rounded-lg font-poppins">
            {error}
          </div>
        )}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in..." : "Log in →"}
        </Button>
      </form>
      
      <div className="flex items-center justify-between">
        <Link
          href="/forgot-password"
          className="text-xs font-poppins text-dark-text/60 hover:text-primary-blue"
        >
          Forgot password?
        </Link>
      </div>
    </div>
  );
}
