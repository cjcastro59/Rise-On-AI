"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const supabase = createClient();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess("Password reset email sent! Please check your inbox.");
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
          <Link href="/login">
            <Button variant="ghost" className="text-sm flex items-center gap-2">
              ← Back to Log In
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <h2 className="text-3xl font-dm-serif text-dark-text mb-2">Forgot Password?</h2>
          <p className="text-dark-text/80 text-sm font-inter">
            Enter your email address and we'll send you a password reset link.
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email Address"
            />
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
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>
      </div>
    </div>
  );
}
