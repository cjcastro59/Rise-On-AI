import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-5xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row-reverse">
        {/* Right Section - Form */}
        <div className="md:w-1/2 p-8 md:p-12">
          <div className="mb-8">
            <h2 className="text-3xl font-dm-serif text-dark-text mb-1">Create your account</h2>
            <p className="text-dark-text/80 text-sm font-inter">Join thousands of students and adults on their wellness journey.</p>
          </div>
          
          <RegisterForm />

          <p className="mt-4 text-center text-sm font-inter text-dark-text/80">
            Already have an account?{" "}
            <Link href="/login" className="font-poppins font-semibold text-lavender hover:text-lavender/80">
              Log in
            </Link>
          </p>
        </div>
        
        {/* Left Section - Steps */}
        <div className="md:w-1/2 p-8 md:p-12 bg-gradient-to-br from-header-bg to-lavender/30">
          <div className="h-full flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 bg-white/70 rounded-full px-3 py-1 text-xs font-poppins text-dark-text/70 mb-6">
              step 1 of 3
            </div>
            <h1 className="text-3xl font-dm-serif text-dark-text mb-2">Begin your journey to <span className="text-lavender italic">self-clarity</span>.</h1>
            <p className="text-xs font-inter text-dark-text/70 mb-4 flex items-start gap-2">
              <span className="text-lg">🔒</span>
              Your journal entries are private and encrypted. Only you and the AI can see your reflections.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-primary-blue to-teal rounded-full flex items-center justify-center">
                  <span className="text-white text-lg font-bold">1</span>
                </div>
                <span className="text-sm font-poppins text-dark-text font-medium">Create Account</span>
              </div>
              <div className="flex items-center gap-3 opacity-60">
                <div className="w-10 h-10 bg-light-gray rounded-full flex items-center justify-center">
                  <span className="text-dark-text text-lg font-bold">2</span>
                </div>
                <span className="text-sm font-poppins text-dark-text">Set Preferences</span>
              </div>
              <div className="flex items-center gap-3 opacity-60">
                <div className="w-10 h-10 bg-light-gray rounded-full flex items-center justify-center">
                  <span className="text-dark-text text-lg font-bold">3</span>
                </div>
                <span className="text-sm font-poppins text-dark-text">You&apos;re Ready!</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}