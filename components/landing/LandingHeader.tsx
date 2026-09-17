"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-header-bg border-b border-light-gray/50 sticky top-0 z-50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between relative">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/logo/Without Text.png"
            alt="Rise On Logo"
            width={38}
            height={38}
            className="object-contain"
            priority
          />
          <span className="font-poppins font-bold text-dark-text text-xl tracking-tight">Rise On</span>
        </Link>

        {/* Desktop Centered Nav */}
        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          <Link
            href="#features"
            className="text-dark-text hover:text-primary-blue text-sm font-poppins font-medium transition-colors"
          >
            Features
          </Link>
          <Link
            href="#how-it-works"
            className="text-dark-text hover:text-primary-blue text-sm font-poppins font-medium transition-colors"
          >
            How It Works
          </Link>
        </nav>

        {/* Desktop CTA Buttons */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/login"
            className="text-dark-text hover:text-primary-blue text-sm font-poppins font-medium transition-colors whitespace-nowrap"
          >
            Log In
          </Link>
          <Link href="/register">
            <Button size="sm" className="whitespace-nowrap font-poppins">
              Get Started Free
            </Button>
          </Link>
        </div>

        {/* Mobile Action Area: Clean Log In + Hamburger Toggle */}
        <div className="flex md:hidden items-center gap-2">
          <Link
            href="/login"
            className="text-dark-text hover:text-primary-blue text-xs font-poppins font-medium px-2.5 py-1.5 rounded-lg border border-light-gray whitespace-nowrap"
          >
            Log In
          </Link>

          <button
            type="button"
            aria-label="Toggle Menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="p-2 rounded-lg text-dark-text hover:bg-light-gray transition-colors focus:outline-none focus:ring-2 focus:ring-primary-blue"
          >
            {mobileMenuOpen ? (
              // Close icon
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // Hamburger icon
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Slide-Down Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-light-gray bg-white px-6 py-5 shadow-lg animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col gap-4">
            <Link
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="text-dark-text font-poppins font-medium text-base py-2 border-b border-light-gray/60 hover:text-primary-blue transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="text-dark-text font-poppins font-medium text-base py-2 border-b border-light-gray/60 hover:text-primary-blue transition-colors"
            >
              How It Works
            </Link>
            <div className="pt-2 flex flex-col gap-2.5">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 font-poppins text-sm font-medium rounded-xl border border-light-gray text-dark-text hover:bg-light-gray transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full"
              >
                <Button size="lg" className="w-full font-poppins text-sm">
                  Get Started Free →
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
