"use client";

import { useState, useEffect } from "react";
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
  const [step, setStep] = useState(1); // 1 = setup, 2 = complete
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    initialize2FA();
  }, [user, authLoading]);

  const initialize2FA = async () => {
    if (!user) return;
    try {
      setLoading(true);

      // Check if user already has 2FA enabled or already has a secret set
      let { data: profile, error: fetchError } = await supabase
        .from("user_profiles")
        .select("two_factor_enabled, two_factor_secret")
        .eq("id", user.id)
        .single();
      
      // If no profile exists, create one!
      if (fetchError || !profile) {
        console.log("Creating new user profile...");
        const { error: insertError } = await supabase
          .from("user_profiles")
          .insert({
            id: user.id,
            email: user.email,
            role: "user",
            two_factor_enabled: false,
            two_factor_secret: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          
        if (insertError) {
          console.error("Error creating profile:", insertError);
        }
        
        // Fetch the new profile
        const { data: newProfile } = await supabase
          .from("user_profiles")
          .select("two_factor_enabled, two_factor_secret")
          .eq("id", user.id)
          .single();
        profile = newProfile;
      }

      if (profile?.two_factor_enabled) {
        router.push("/dashboard");
        return;
      }

      let currentSecret = profile?.two_factor_secret;
      
      // If no secret exists yet, generate and save one!
      if (!currentSecret) {
        currentSecret = authenticator.generateSecret();
        
        // Save the secret to the database right away!
        const { error: saveError } = await supabase
          .from("user_profiles")
          .update({
            two_factor_secret: currentSecret
          })
          .eq("id", user.id);
          
        if (saveError) {
          console.error("Error saving secret:", saveError);
        }
      }
      
      // Generate QR code URL — first param empty so it just says "Rise On AI"
      const newOtpAuthUrl = authenticator.keyuri("", "Rise On AI", currentSecret);
      setSecret(currentSecret);
      setOtpAuthUrl(newOtpAuthUrl);
    } catch (err) {
      setError("Failed to initialize 2FA setup.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable2FA = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError("");
      
      // First get the saved secret from the database to make sure!
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("two_factor_secret")
        .eq("id", user.id)
        .single();
        
      console.log("📝 Profile from DB:", profile);
      console.log("🔑 Secret being used:", profile?.two_factor_secret);
      console.log("🔢 Verification code entered:", verificationCode);
      
      if (!profile?.two_factor_secret) {
        setError("Secret not found, please refresh the page!");
        return;
      }
      
      const verified = authenticator.verify({
        secret: profile.two_factor_secret,
        token: verificationCode,
        window: 2
      });

      console.log("✅ Verification result:", verified);

      if (verified) {
        // Update the user profile
        await supabase
          .from("user_profiles")
          .update({
            two_factor_enabled: true
          })
          .eq("id", user.id);
        
        setStep(2);
        setSuccess("Two-Factor Authentication set up successfully!");
      } else {
        const expected = authenticator.generate(profile.two_factor_secret);
        setError(`Invalid verification code! Expected: ${expected}. Please try again.`);
      }
    } catch (err) {
      setError("Failed to enable 2FA. Please try again.");
      console.error("2FA Verify Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const skip2FA = async () => {
    if (!user) return;
    // Still set the profile with 2FA disabled, but let them skip for now
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", user.id)
      .single();
    
    if (!profile) {
      // Create basic profile if it doesn't exist
      await supabase.from("user_profiles").insert({
        id: user.id,
        email: user.email,
        role: "user",
        two_factor_enabled: false,
        two_factor_secret: null,
      });
    }

    router.push("/dashboard");
  };

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
                  Set up Two-Factor Authentication for extra security
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
                  If you can't scan, you can also manually enter this
                  secret key: <span className="font-mono font-semibold">{secret}</span>
                </p>
              </div>

              <div className="space-y-3">
                <Input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, ''); // Only allow numbers!
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
                    onClick={skip2FA}
                    className="w-full"
                  >
                    Skip for now (not recommended)
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
