"use client";

import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-5xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        {/* Left Section */}
        <div className="md:w-1/2 p-8 md:p-12 bg-gradient-to-br from-header-bg to-lavender/30">
          <div className="h-full flex flex-col justify-center">
            <p className="text-xs font-poppins text-dark-text/70 mb-2 tracking-wider">WELCOME BACK</p>
            <h1 className="text-3xl font-dm-serif text-dark-text mb-4">Your emotions deserve to be <span className="text-lavender italic">heard</span>.</h1>
            
            <div className="mt-12 space-y-4">
              <Card className="p-4 bg-white/90">
                <p className="text-xs font-inter text-dark-text/70">Continue your journey into journaling, emotional wellness, and self-discovery.</p>
              </Card>
              <Card className="p-4 bg-white/90 flex items-center gap-3">
                <img src="/icons/platform-impact.svg" alt="Platform Impact" className="w-6 h-6" />
                <div>
                  <p className="text-xs font-poppins font-semibold text-dark-text">Platform Impact</p>
                  <p className="text-xs font-inter text-dark-text/70">1,247+ students and young adults journaling daily</p>
                </div>
              </Card>
              <Card className="p-4 bg-white/90 flex items-center gap-3">
                <img src="/icons/todays-vibe.svg" alt="Today's Vibe" className="w-6 h-6" />
                <div>
                  <p className="text-xs font-poppins font-semibold text-dark-text">Today's Vibe</p>
                  <p className="text-xs font-inter text-dark-text/70">Just checking in</p>
                </div>
              </Card>
            </div>
          </div>
        </div>
        
        {/* Right Section */}
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
            <h2 className="text-3xl font-dm-serif text-dark-text mb-1">Log in</h2>
            <p className="text-dark-text/80 text-sm font-inter">Sign in to continue your wellness journey.</p>
          </div>
          
          <LoginForm />

          <p className="mt-4 text-center text-sm font-inter text-dark-text/80">
            Don't have an account?{" "}
            <Link href="/register" className="font-poppins font-semibold text-lavender hover:text-lavender/80">
              Sign up
            </Link>
          </p>
          

        </div>
      </div>
    </div>
  );
}
