"use client";

import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function RegisterPage() {
  const [step, setStep] = useState(1);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-5xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        {/* Left Section - Steps */}
        <div className="md:w-1/2 p-8 md:p-12 bg-gradient-to-br from-header-bg to-lavender/30">
          <div className="h-full flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 bg-white/70 rounded-full px-3 py-1 text-xs font-poppins text-dark-text/70 mb-6">
              step {step} of 3
            </div>
            <h1 className="text-3xl font-dm-serif text-dark-text mb-2">Begin your journey to <span className="text-lavender italic">self-clarity</span>.</h1>
            <p className="text-xs font-inter text-dark-text/70 mb-4 flex items-start gap-2">
              <span className="text-lg">🔒</span>
              Your journal entries are private and encrypted. Only you and the AI can see your reflections.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step === 1 
                    ? "bg-gradient-to-r from-primary-blue to-teal text-white" 
                    : step > 1 
                      ? "bg-success-green text-white"
                      : "bg-light-gray text-dark-text"
                }`}>
                  {step > 1 ? "✓" : "1"}
                </div>
                <span className={`text-sm font-poppins ${
                  step === 1 ? "text-dark-text font-semibold" : step > 1 ? "text-dark-text" : "text-dark-text/60"
                }`}>Create Account</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step === 2 
                    ? "bg-gradient-to-r from-primary-blue to-teal text-white" 
                    : step > 2 
                      ? "bg-success-green text-white"
                      : "bg-light-gray text-dark-text"
                }`}>
                  {step > 2 ? "✓" : "2"}
                </div>
                <span className={`text-sm font-poppins ${
                  step === 2 ? "text-dark-text font-semibold" : step > 2 ? "text-dark-text" : "text-dark-text/60"
                }`}>Set Preferences</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step === 3 
                    ? "bg-gradient-to-r from-primary-blue to-teal text-white" 
                    : "bg-light-gray text-dark-text"
                }`}>
                  {step > 3 ? "✓" : "3"}
                </div>
                <span className={`text-sm font-poppins ${
                  step === 3 ? "text-dark-text font-semibold" : "text-dark-text/60"
                }`}>You're Ready!</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Section - Form */}
        <div className="md:w-1/2 p-8 md:p-12">
          {/* Back to Landing Button */}
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" className="text-sm flex items-center gap-2">
                ← Return to Landing Page
              </Button>
            </Link>
          </div>
          
          <div className="mb-8">
            <h2 className="text-3xl font-dm-serif text-dark-text mb-1">Create your account</h2>
            <p className="text-dark-text/80 text-sm font-inter">Join thousands of students and adults on their wellness journey.</p>
          </div>
          
          <RegisterForm setStep={setStep} />

          <p className="mt-4 text-center text-sm font-inter text-dark-text/80">
            Already have an account?{" "}
            <Link href="/login" className="font-poppins font-semibold text-lavender hover:text-lavender/80">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
