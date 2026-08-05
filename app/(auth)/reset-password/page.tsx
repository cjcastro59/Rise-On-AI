"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

const PasswordRequirement = ({ label, satisfied }: { label: string; satisfied: boolean }) => (
  <div className="flex items-center gap-2 text-xs font-inter">
    <span className={`text-lg ${satisfied ? "text-success-green" : "text-dark-text/40"}`}>
      {satisfied ? "✓" : "✗"}
    </span>
    <span className={`${satisfied ? "text-dark-text" : "text-dark-text/60"}`}>{label}</span>
  </div>
);

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const passwordRequirements = [
    { label: "At least 8 characters", satisfied: password.length >= 8 },
    { label: "One uppercase letter", satisfied: /[A-Z]/.test(password) },
    { label: "One lowercase letter", satisfied: /[a-z]/.test(password) },
    { label: "One number", satisfied: /\d/.test(password) },
    { label: "One special character", satisfied: /[@$!%*?&]/.test(password) },
  ];

  const isPasswordValid = PASSWORD_REGEX.test(password);
  const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!isPasswordValid) {
      setError("Please meet all password requirements.");
      setLoading(false);
      return;
    }
    if (!doPasswordsMatch) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(error.message);
      } else {
        setSuccess("Password updated successfully! Redirecting to login...");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-md w-full">
        <div className="mb-8">
          <h2 className="text-3xl font-dm-serif text-dark-text mb-2">Reset Password</h2>
          <p className="text-dark-text/80 text-sm font-inter">
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="New Password"
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
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm New Password"
            />
            {confirmPassword.length > 0 && (
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

          {error && (
            <div className="text-error-red text-xs bg-error-red/10 p-3 rounded-lg font-poppins">
              {error}
            </div>
          )}

          {success && (
            <div className="text-success-green text-xs bg-success-green/10 p-3 rounded-lg font-poppins">
              {success}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Updating..." : "Reset Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
