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

export default function Setup2FAPage() {
  const [otpAuthUrl, setOtpAuthUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [step, setStep] = useState(1); // 1 = intro, 2 = setup, 3 = complete
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const initializeAuthenticator = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      let { data: profile } = await supabase
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

      const newOtpAuthUrl = authenticator.keyuri(user.email || "", "Rise On AI", currentSecret);
      setSecret(currentSecret);
      setOtpAuthUrl(newOtpAuthUrl);
    } catch (err) {
      setError("Failed to initialize 2FA setup.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  const verifyAndEnable2FA = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError("");

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("two_factor_secret")
        .eq("id", user.id)
        .single();

      if (!profile?.two_factor_secret) {
        setError("Secret not found, please refresh the page!");
        return;
      }

      const verified = authenticator.verify({
        secret: profile.two_factor_secret,
        token: verificationCode,
      });

      if (!verified) {
        const expected = authenticator.generate(profile.two_factor_secret);
        setError(`Invalid verification code! Expected: ${expected}. Please try again.`);
        return;
      }

      await supabase
        .from("user_profiles")
        .update({
          two_factor_enabled: true,
        })
        .eq("id", user.id);

      setStep(3);
      setSuccess("Two-Factor Authentication set up successfully!");
    } catch (err) {
      setError("Failed to enable 2FA. Please try again.");
      console.error("2FA Verify Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const skip2FA = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!profile) {
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
    if (!user) {
      router.push("/login");
      return;
    }

    const checkExisting = async () => {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("two_factor_enabled")
        .eq("id", user.id)
        .single();
      if (profile?.two_factor_enabled) {
        router.push("/dashboard");
      }
    };

    checkExisting();
  }, [authLoading, router, supabase, user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-dark-text font-poppins">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-md w-full">
        <Card className="p-8">
          {step === 1 ? (
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
                  onClick={() => {
                    setStep(2);
                    initializeAuthenticator();
                  }}
                  className="w-full justify-start text-left h-auto py-4 border border-light-gray"
                >
                  <div className="space-y-1">
                    <div className="font-semibold font-poppins text-dark-text">
                      Authenticator App
                    </div>
                    <div className="text-xs font-inter text-dark-text/60">
                      Use Google Authenticator, Authy, or similar
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
                {loading ? "Redirecting..." : "Skip for now (not recommended)"}
              </Button>
            </div>
          ) : step === 2 ? (
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
                    <QRCodeSVG value={otpAuthUrl} size={192} level="H" includeMargin={true} />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-poppins text-dark-text">
                  Scan this QR code with{" "}
                  <span className="font-semibold">Google Authenticator</span> or
                  another authenticator app.
                </p>
                <p className="text-xs font-inter text-dark-text/60">
                  If you can&apos;t scan, you can also manually enter this
                  secret key: <span className="font-mono font-semibold">{secret}</span>
                </p>
              </div>

              <div className="space-y-3">
                <Input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setVerificationCode(value);
                  }}
                  maxLength={6}
                  inputMode="numeric"
                />

                {error && (
                  <div className="text-error-red text-xs bg-error-red/10 p-3 rounded-lg font-poppins">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Button
                    onClick={verifyAndEnable2FA}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? "Verifying..." : "Enable 2FA"}
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
          ) : (
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
