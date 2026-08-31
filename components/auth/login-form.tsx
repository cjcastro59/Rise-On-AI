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

// S6 (Phase 8): Maximum TOTP attempts before the session is signed out and
// the user must restart the login flow. Prevents brute-force of 6-digit codes.
const MAX_TOTP_ATTEMPTS = 5;

export function LoginForm() {
  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [totpCode,       setTotpCode]       = useState("");
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");
  const [step,           setStep]           = useState<LoginStep>("credentials");
  const [userId,         setUserId]         = useState<string | null>(null);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  // S6: attempt counter — resets when step returns to "credentials"
  const [totpAttempts,   setTotpAttempts]   = useState(0);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const router  = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const recaptchaKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  // S7 (Phase 8): Pending profile helper — no PII console.log
  const applyPendingProfileData = useCallback(async (uid: string) => {
    // S8 (Phase 8): Use sessionStorage instead of localStorage so data is
    // cleared when the browser tab is closed (not persisted cross-tab).
    const pendingDataStr = sessionStorage.getItem("pendingProfileData");
    if (!pendingDataStr) return;
    try {
      const formData = JSON.parse(pendingDataStr);
      const profileData: Record<string, unknown> = {
        username:           formData.username,
        email:              formData.email,
        role:               "user",
        full_name:          `${formData.firstName} ${formData.lastName}`,
        first_name:         formData.firstName,
        last_name:          formData.lastName,
        goals:              formData.goals,
        language:           formData.language,
        two_factor_enabled: false,
        two_factor_secret:  null,
      };
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update(profileData)
        .eq("id", uid)
        .select();
      if (updateError) {
        console.error("[login] Failed to apply pending profile.");
      }
      sessionStorage.removeItem("pendingProfileData");
    } catch {
      sessionStorage.removeItem("pendingProfileData");
    }
  }, [supabase]);

  // Check for an existing session on mount (handles email-confirm redirect)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("two_factor_enabled")
        .eq("id", session.user.id)
        .single();
      if (profile?.two_factor_enabled) {
        setUserId(session.user.id);
        setStep("2fa");
      } else {
        await applyPendingProfileData(session.user.id);
        router.push("/dashboard");
        router.refresh();
      }
    };
    checkSession();
  }, [applyPendingProfileData, router, supabase]);

  // ── Step 1: credential sign-in ────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!recaptchaToken) {
        if (recaptchaRef.current) {
          const token = await recaptchaRef.current.executeAsync();
          setRecaptchaToken(token);
        }
      }
      if (!recaptchaToken) {
        setError("Please complete the reCAPTCHA.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken: recaptchaToken },
      });

      if (error) {
        if (
          error.message.toLowerCase().includes("rate limit") ||
          error.message.toLowerCase().includes("too many")
        ) {
          setError("Too many login attempts. Please wait a few minutes and try again.");
        } else {
          // Generic message to avoid leaking whether the email exists
          setError("Invalid email or password.");
        }
        return;
      }

      if (data.session) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("two_factor_enabled")
          .eq("id", data.session.user.id)
          .single();

        if (profile?.two_factor_enabled) {
          // S3 (Phase 8): User has 2FA enabled — show TOTP challenge
          setUserId(data.session.user.id);
          setTotpAttempts(0); // S6: reset counter for fresh login attempt
          setStep("2fa");
        } else {
          await applyPendingProfileData(data.session.user.id);
          router.push("/dashboard");
          router.refresh();
        }
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: TOTP verification ─────────────────────────────────────────────
  const handle2FA = async (e: React.FormEvent) => {
    e.preventDefault();

    // S6 (Phase 8): Lockout after MAX_TOTP_ATTEMPTS incorrect codes
    if (totpAttempts >= MAX_TOTP_ATTEMPTS) {
      // Sign out the partially-authenticated session to force a full re-login
      await supabase.auth.signOut();
      setStep("credentials");
      setTotpAttempts(0);
      setTotpCode("");
      setError(
        "Too many incorrect codes. For your security, please sign in again."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("two_factor_secret")
        .eq("id", userId)
        .single();

      const verified = profile?.two_factor_secret
        ? authenticator.verify({
            secret: profile.two_factor_secret,
            token:  totpCode,
          })
        : false;

      if (verified) {
        if (userId) {
          await applyPendingProfileData(userId);
          router.push("/dashboard");
          router.refresh();
        }
      } else {
        const newCount = totpAttempts + 1;
        setTotpAttempts(newCount);
        const remaining = MAX_TOTP_ATTEMPTS - newCount;
        setError(
          remaining > 0
            ? `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining before sign-out.`
            : "Invalid code. You will be signed out on the next attempt."
        );
        setTotpCode("");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Render: TOTP step ─────────────────────────────────────────────────────
  if (step === "2fa") {
    const attemptsLeft = MAX_TOTP_ATTEMPTS - totpAttempts;
    return (
      <form onSubmit={handle2FA} className="space-y-4 w-full">
        <div>
          <p className="text-sm font-poppins text-dark-text mb-2">
            Enter the 6-digit code from your authenticator app
          </p>
          <Input
            type="text"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
            required
            placeholder="Enter 6-digit code"
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          {totpAttempts > 0 && (
            <p className="text-[10px] text-dark-text/50 font-inter mt-1">
              {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
            </p>
          )}
        </div>

        {error && (
          <div className="text-error-red text-xs bg-error-red/10 p-3 rounded-lg font-poppins">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              // Signing out when going back prevents session-without-TOTP abuse
              await supabase.auth.signOut();
              setStep("credentials");
              setTotpAttempts(0);
              setTotpCode("");
              setError("");
            }}
            className="flex-1"
          >
            Back
          </Button>
          <Button type="submit" disabled={loading || totpAttempts >= MAX_TOTP_ATTEMPTS} className="flex-1">
            {loading ? "Verifying…" : "Verify →"}
          </Button>
        </div>
      </form>
    );
  }

  // ── Render: credentials step ──────────────────────────────────────────────
  return (
    <div className="space-y-4 w-full">
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Email"
            autoComplete="email"
          />
        </div>
        <div>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Password"
            autoComplete="current-password"
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
          {loading ? "Signing in…" : "Log in →"}
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
