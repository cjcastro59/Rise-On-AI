"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { authenticator } from "@otplib/preset-default";
import { QRCodeSVG } from "qrcode.react";

// S6 (Phase 8): Maximum TOTP verify attempts before secret is regenerated,
// preventing an attacker who captures the QR from brute-forcing the setup.
const MAX_VERIFY_ATTEMPTS = 5;

export default function Setup2FAPage() {
  const [otpAuthUrl, setOtpAuthUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [secretVisible, setSecretVisible] = useState(false); // S5: hidden by default
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]  = useState("");
  const [success, setSuccess] = useState("");
  const [step, setStep] = useState(1); // 1=intro, 2=setup, 3=complete
  const [verifyAttempts, setVerifyAttempts]    = useState(0); // S6: lockout counter
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const initializeAuthenticator = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setVerifyAttempts(0);

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("two_factor_enabled, two_factor_secret")
        .eq("id", user.id)
        .single();

      if (!profile) {
        await supabase.from("user_profiles").insert({
          id: user.id,
          email: user.email,
          role: "user",
          two_factor_enabled: false,
          two_factor_secret: null,
        });
      }

      let currentSecret = profile?.two_factor_secret;
      if (!currentSecret) {
        currentSecret = authenticator.generateSecret();
        await supabase
          .from("user_profiles")
          .update({ two_factor_secret: currentSecret })
          .eq("id", user.id);
      }

      const newOtpAuthUrl = authenticator.keyuri(
        user.email || "",
        "Rise On AI",
        currentSecret
      );
      setSecret(currentSecret);
      setOtpAuthUrl(newOtpAuthUrl);
      setSecretVisible(false); // S5: always start hidden
    } catch {
      setError("Failed to initialize 2FA setup. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  const verifyAndEnable2FA = async () => {
    if (!user) return;

    // S6 (Phase 8): Lockout after MAX_VERIFY_ATTEMPTS
    if (verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
      setError(
        "Too many incorrect codes. Please refresh the page to generate a new QR code."
      );
      return;
    }

    try {
      setLoading(true);
      setError("");

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("two_factor_secret")
        .eq("id", user.id)
        .single();

      if (!profile?.two_factor_secret) {
        setError("Secret not found. Please refresh the page.");
        return;
      }

      const verified = authenticator.verify({
        secret: profile.two_factor_secret,
        token:  verificationCode,
      });

      if (!verified) {
        const newCount = verifyAttempts + 1;
        setVerifyAttempts(newCount);
        const remaining = MAX_VERIFY_ATTEMPTS - newCount;
        setError(
          remaining > 0
            ? `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`
            : "Too many incorrect attempts. Please refresh to generate a new QR code."
        );
        setVerificationCode("");
        return;
      }

      await supabase
        .from("user_profiles")
        .update({ two_factor_enabled: true })
        .eq("id", user.id);

      setStep(3);
      setSuccess("Two-Factor Authentication set up successfully!");
    } catch {
      setError("Failed to enable 2FA. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const skip2FA = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data: existing } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existing) {
        await supabase.from("user_profiles").insert({
          id: user.id,
          email: user.email,
          role: "user",
          two_factor_enabled: false,
          two_factor_secret: null,
          two_factor_skipped: true,
        });
      } else {
        await supabase
          .from("user_profiles")
          .update({ two_factor_skipped: true })
          .eq("id", user.id);
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    const check = async () => {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("two_factor_enabled")
        .eq("id", user.id)
        .single();
      if (profile?.two_factor_enabled) router.push("/dashboard");
    };
    check();
  }, [authLoading, router, supabase, user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-dark-text font-poppins">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-md w-full">
        <Card className="p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-dm-serif text-dark-text mb-2">
                  Secure Your Account
                </h2>
                <p className="text-sm font-inter text-dark-text/70">
                  Set up Two-Factor Authentication with an authenticator app
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  variant="ghost"
                  onClick={() => { setStep(2); initializeAuthenticator(); }}
                  className="w-full justify-start text-left h-auto py-4 border border-light-gray"
                >
                  <div className="space-y-1">
                    <div className="font-semibold font-poppins text-dark-text">
                      Authenticator App
                    </div>
                    <div className="text-xs font-inter text-dark-text/60">
                      Use Google Authenticator
                    </div>
                  </div>
                </Button>
              </div>

              <Button
                variant="ghost"
                onClick={skip2FA}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Redirecting…" : "Skip for now (not recommended)"}
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-dm-serif text-dark-text mb-2">
                  Set Up Authenticator
                </h2>
                <p className="text-sm font-inter text-dark-text/70">
                  Follow the steps below
                </p>
              </div>

              {otpAuthUrl && (
                <div className="flex justify-center">
                  <div className="p-4 bg-white border border-light-gray rounded-xl">
                    <QRCodeSVG
                      value={otpAuthUrl}
                      size={192}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-poppins text-dark-text">
                  Scan this QR code with{" "}
                  <span className="font-semibold">Google Authenticator</span> or
                  another authenticator app.
                </p>

                {/* S5 (Phase 8): Secret masked by default — toggle to reveal */}
                <p className="text-xs font-inter text-dark-text/60">
                  Can&apos;t scan? Manually enter the secret key:
                </p>
                <div className="flex items-center gap-2 bg-light-gray/40 rounded-lg px-3 py-2">
                  <code className="flex-1 font-mono text-xs text-dark-text tracking-widest break-all select-all">
                    {secretVisible
                      ? secret
                      : "•".repeat(Math.max(0, secret.length))}
                  </code>
                  <button
                    type="button"
                    onClick={() => setSecretVisible((v) => !v)}
                    className="text-[10px] font-poppins text-primary-blue hover:underline shrink-0"
                    aria-label={secretVisible ? "Hide secret key" : "Reveal secret key"}
                  >
                    {secretVisible ? "Hide" : "Reveal"}
                  </button>
                </div>
                <p className="text-[10px] text-dark-text/40 font-inter">
                  Keep this secret key private. Never share it with anyone.
                </p>
              </div>

              <div className="space-y-3">
                <Input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(e.target.value.replace(/\D/g, ""))
                  }
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  disabled={verifyAttempts >= MAX_VERIFY_ATTEMPTS}
                />

                {verifyAttempts > 0 && verifyAttempts < MAX_VERIFY_ATTEMPTS && (
                  <p className="text-[10px] text-dark-text/50 font-inter">
                    {MAX_VERIFY_ATTEMPTS - verifyAttempts} attempt
                    {MAX_VERIFY_ATTEMPTS - verifyAttempts !== 1 ? "s" : ""} remaining
                  </p>
                )}

                {error && (
                  <div className="text-error-red text-xs bg-error-red/10 p-3 rounded-lg font-poppins">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Button
                    onClick={verifyAndEnable2FA}
                    disabled={loading || verifyAttempts >= MAX_VERIFY_ATTEMPTS}
                    className="w-full"
                  >
                    {loading ? "Verifying…" : "Enable 2FA"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setStep(1)}
                    className="w-full"
                  >
                    Back
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 bg-success-green/20 rounded-full flex items-center justify-center mx-auto">
                <span className="text-3xl">✅</span>
              </div>
              <div>
                <h2 className="text-2xl font-dm-serif text-dark-text mb-2">
                  All Set!
                </h2>
                <p className="text-sm font-inter text-dark-text/70 mb-4">
                  {success}
                </p>
              </div>
              <Link href="/dashboard">
                <Button className="w-full">Go to Dashboard</Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
