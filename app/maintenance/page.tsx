import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Under Maintenance | Rise On AI",
  description: "Rise On AI is currently undergoing scheduled maintenance.",
};

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-[#EEF2F6] flex flex-col items-center justify-center px-4 py-12 text-dark-text">
      <div className="max-w-xl w-full text-center space-y-6">
        {/* Brand Logo */}
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-white rounded-3xl p-3 shadow-md border border-light-gray flex items-center justify-center">
            <Image
              src="/logo/Without Text.png"
              alt="Rise On AI Logo"
              width={60}
              height={60}
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Maintenance Badge */}
        <div className="inline-flex items-center gap-2 bg-primary-blue/10 text-primary-blue rounded-full px-4 py-1.5 text-xs font-poppins font-semibold">
          <span className="w-2 h-2 rounded-full bg-primary-blue animate-pulse" />
          Scheduled Platform Maintenance
        </div>

        {/* Main Heading */}
        <h1 className="text-3xl sm:text-4xl font-dm-serif text-dark-text tracking-tight leading-tight">
          We&apos;re taking a mindful pause.
        </h1>

        {/* Explanation */}
        <p className="text-sm sm:text-base font-inter text-dark-text/75 max-w-md mx-auto leading-relaxed">
          Rise On AI is temporarily offline for scheduled system updates and improvements.
          Rest assured, your journal entries and personal data remain safe and private.
        </p>

        {/* Status Card & Actions */}
        <Card className="p-6 bg-white border border-light-gray shadow-sm rounded-2xl text-left space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-poppins font-medium text-dark-text/60">System Status</span>
            <span className="text-xs font-poppins font-semibold text-warning-yellow bg-warning-yellow/10 px-2.5 py-1 rounded-full">
              Maintenance Active
            </span>
          </div>

          <div className="border-t border-light-gray/60 pt-4 space-y-2">
            <p className="text-xs font-poppins font-semibold text-dark-text">Need immediate support?</p>
            <p className="text-xs font-inter text-dark-text/70">
              If you or someone you know needs urgent emotional support, free 24/7 crisis hotlines are always available:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-light-gray">
                <p className="text-[11px] font-poppins font-semibold text-dark-text">NCMH Crisis Hotline</p>
                <p className="text-xs font-poppins font-bold text-primary-blue">1553 (Toll-Free)</p>
              </div>
              <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-light-gray">
                <p className="text-[11px] font-poppins font-semibold text-dark-text">Hopeline Philippines</p>
                <p className="text-xs font-poppins font-bold text-primary-blue">0917-558-4673</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-2">
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="secondary" size="md" className="w-full sm:w-auto font-poppins text-xs">
              ↻ Check Again
            </Button>
          </Link>
          <Link href="/login" className="text-xs font-poppins text-dark-text/60 hover:text-primary-blue transition-colors underline">
            Owner Sign In →
          </Link>
        </div>
      </div>
    </div>
  );
}
