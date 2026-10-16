"use client";

import Image from "next/image";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function RegisterPage() {
  const [step, setStep] = useState(1);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-5xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Left Section — hidden on mobile to show form first */}
        <div className="hidden md:block md:w-1/2 p-12 bg-gradient-to-br from-header-bg to-lavender/30">
          <div className="h-full flex flex-col justify-center">
            <h1 className="text-3xl font-dm-serif text-dark-text mb-2 animate-in fade-in slide-in-from-left-4 duration-500 delay-150">Begin your journey to <span className="text-lavender italic">self-clarity</span>.</h1>
            <p className="text-xs font-inter text-dark-text/70 mb-4 flex items-center gap-2 animate-in fade-in duration-500 delay-200">
              <Image src="/icons/lock.svg" alt="Security lock" width={24} height={24} className="w-6 h-6 flex-shrink-0 object-contain" />
              Your journal entries are private and encrypted. Only you and the AI can see your reflections.
            </p>
            
            <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500 delay-300">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  step === 1 
                    ? "bg-gradient-to-r from-primary-blue to-lavender text-white scale-110 shadow-md" 
                    : step > 1 
                      ? "bg-success-green text-white"
                      : "bg-light-gray text-dark-text"
                }`}>
                  {step > 1 ? "✓" : "1"}
                </div>
                <span className={`text-sm font-poppins transition-colors duration-200 ${
                  step === 1 ? "text-dark-text font-semibold" : step > 1 ? "text-dark-text" : "text-dark-text/60"
                }`}>Create Account</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  step === 2 
                    ? "bg-gradient-to-r from-primary-blue to-lavender text-white scale-110 shadow-md" 
                    : step > 2 
                      ? "bg-success-green text-white"
                      : "bg-light-gray text-dark-text"
                }`}>
                  {step > 2 ? "✓" : "2"}
                </div>
                <span className={`text-sm font-poppins transition-colors duration-200 ${
                  step === 2 ? "text-dark-text font-semibold" : step > 2 ? "text-dark-text" : "text-dark-text/60"
                }`}>Set Preferences</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  step === 3 
                    ? "bg-gradient-to-r from-primary-blue to-lavender text-white scale-110 shadow-md" 
                    : step > 3
                      ? "bg-success-green text-white"
                      : "bg-light-gray text-dark-text"
                }`}>
                  {step > 3 ? "✓" : "3"}
                </div>
                <span className={`text-sm font-poppins transition-colors duration-200 ${
                  step === 3 ? "text-dark-text font-semibold" : step > 3 ? "text-dark-text" : "text-dark-text/60"
                }`}>Verify Email</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  step === 4 
                    ? "bg-gradient-to-r from-primary-blue to-lavender text-white scale-110 shadow-md" 
                    : "bg-light-gray text-dark-text"
                }`}>
                  {step > 4 ? "✓" : "4"}
                </div>
                <span className={`text-sm font-poppins transition-colors duration-200 ${
                  step === 4 ? "text-dark-text font-semibold" : "text-dark-text/60"
                }`}>You&apos;re Ready!</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Section - Form */}
        <div className="w-full md:w-1/2 p-8 md:p-12 animate-in fade-in slide-in-from-right-4 duration-500 delay-100">
          {/* Back to Landing Button */}
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" className="text-sm flex items-center gap-2">
                ← Return to Landing Page
              </Button>
            </Link>
          </div>

          {/* Mobile step indicator — visible only on mobile */}
          <div className="flex items-center gap-2 mb-6 md:hidden">
            {[
              { n: 1, label: "Account" },
              { n: 2, label: "Preferences" },
              { n: 3, label: "Verify Email" },
              { n: 4, label: "Done" },
            ].map(({ n, label }, i, arr) => (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    step === n
                      ? "bg-gradient-to-r from-primary-blue to-lavender text-white shadow-md"
                      : step > n
                      ? "bg-success-green text-white"
                      : "bg-light-gray text-dark-text/40"
                  }`}>
                    {step > n ? "✓" : n}
                  </div>
                  <span className={`text-[9px] font-poppins text-center leading-tight ${
                    step === n ? "text-dark-text font-semibold" : step > n ? "text-dark-text/70" : "text-dark-text/30"
                  }`}>{label}</span>
                </div>
                {i < arr.length - 1 && (
                  <div className={`h-px flex-1 mb-4 transition-colors duration-300 ${step > n ? "bg-success-green" : "bg-light-gray"}`} />
                )}
              </div>
            ))}
          </div>
          
          <div className="mb-8">
            <h2 className="text-3xl font-dm-serif text-dark-text mb-1">Create your account</h2>
            <p className="text-dark-text/80 text-sm font-inter">Join Rise On AI on your wellness journey.</p>
          </div>
          
          <RegisterForm setStep={setStep} />

          <p className="mt-4 text-center text-sm font-inter text-dark-text/80">
            Already have an account?{" "}
            <Link href="/login" className="font-poppins font-semibold text-lavender hover:text-lavender/80 transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
