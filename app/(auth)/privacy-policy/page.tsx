"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-dm-serif text-dark-text">Privacy Policy</h1>
          <Link href="/register">
            <Button variant="ghost">← Back to Register</Button>
          </Link>
        </div>

        <div className="space-y-4 text-sm font-inter text-dark-text/80">
          <p>Last updated: {new Date().toLocaleDateString()}</p>

          <section>
            <h2 className="text-lg font-poppins font-semibold text-dark-text mb-2">1. Information We Collect</h2>
            <p>We collect information you provide directly to us, such as your name, email address, username, and any journal entries you create.</p>
          </section>

          <section>
            <h2 className="text-lg font-poppins font-semibold text-dark-text mb-2">2. How We Use Your Information</h2>
            <p>Your information is used solely to provide and improve our service to you.</p>
          </section>

          <section>
            <h2 className="text-lg font-poppins font-semibold text-dark-text mb-2">3. Data Encryption</h2>
            <p>Your mental health data is encrypted and stored securely.</p>
          </section>

          <section>
            <h2 className="text-lg font-poppins font-semibold text-dark-text mb-2">4. Data Sharing</h2>
            <p>We never share your personal data without your explicit consent.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
