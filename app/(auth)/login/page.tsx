import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";

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
                <span className="text-2xl">🌱</span>
                <div>
                  <p className="text-xs font-poppins font-semibold text-dark-text">Platform Impact</p>
                  <p className="text-xs font-inter text-dark-text/70">1,247+ students and young adults journaling daily</p>
                </div>
              </Card>
              <Card className="p-4 bg-white/90 flex items-center gap-3">
                <span className="text-2xl">⭐</span>
                <div>
                  <p className="text-xs font-poppins font-semibold text-dark-text">Today&apos;s Vibe</p>
                  <p className="text-xs font-inter text-dark-text/70">Just checking in ✨</p>
                </div>
              </Card>
            </div>
          </div>
        </div>
        
        {/* Right Section */}
        <div className="md:w-1/2 p-8 md:p-12">
          <div className="mb-8">
            <h2 className="text-3xl font-dm-serif text-dark-text mb-1">Log in</h2>
            <p className="text-dark-text/80 text-sm font-inter">Sign in to continue your wellness journey.</p>
          </div>
          
          <LoginForm />

          <div className="my-8 flex items-center gap-4">
            <div className="flex-1 h-px bg-light-gray" />
            <span className="text-xs font-poppins text-dark-text/60">Or sign in with</span>
            <div className="flex-1 h-px bg-light-gray" />
          </div>

          <button className="w-full py-3 border border-light-gray bg-light-gray rounded-xl flex items-center justify-center gap-2 text-sm font-poppins text-dark-text hover:opacity-90 mb-4">
            <span className="text-xl">🔵</span>
            Log in with Google
          </button>
          
          <div className="flex items-center justify-between">
            <Link href="#" className="text-xs font-poppins text-dark-text/60 hover:text-primary-blue">
              Forgot password?
            </Link>
          </div>

          <p className="mt-4 text-center text-sm font-inter text-dark-text/80">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-poppins font-semibold text-lavender hover:text-lavender/80">
              Sign up
            </Link>
          </p>
          
          <div className="mt-6 bg-error-red/10 border border-error-red/30 rounded-xl p-4 flex items-center gap-2">
            <span className="text-base">🆘</span>
            <p className="text-xs font-inter text-error-red">Need immediate help? Reach out.</p>
          </div>
        </div>
      </div>
    </div>
  );
}