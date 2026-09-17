import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import LandingHeader from "@/components/landing/LandingHeader";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <LandingHeader />

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 bg-light-gray rounded-full px-4 py-2 mb-8">
          <span className="text-sm font-poppins font-medium text-dark-text">
             For Students and Young Adults
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-dm-serif text-dark-text mb-6 leading-tight">
          Your{" "}
          <span className="text-lavender italic">
            mind
          </span>{" "}
          deserves
          <br />
          a safe space to grow.
        </h1>
        <p className="text-lg text-dark-text/80 max-w-2xl mx-auto mb-8 font-inter">
          Rise On AI is an intelligent journaling companion that listens, understands, and guides your mental wellness journey — in English and Taglish.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link href="/register">
            <Button size="lg">Start Journaling Free</Button>
          </Link>
          <a href="#how-it-works">
            <Button variant="secondary" size="lg">
              See How It Works →
            </Button>
          </a>
        </div>

        {/* Capability Showcase (Option 1) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {/* Card 1: Taglish & English NLP */}
          <Card className="p-6 bg-white border border-light-gray shadow-sm rounded-2xl hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary-blue/10 rounded-xl flex items-center justify-center text-2xl shrink-0">
                🇵🇭
              </div>
              <div>
                <span className="text-[11px] font-poppins font-semibold uppercase tracking-wider text-primary-blue bg-primary-blue/10 px-2 py-0.5 rounded-full">
                  Bilingual NLP
                </span>
                <h3 className="text-base font-poppins font-semibold text-dark-text mt-1">Taglish & English</h3>
              </div>
            </div>
            <p className="text-xs font-inter text-dark-text/75 leading-relaxed">
              Express yourself naturally in Filipino, English, or Taglish. Our AI detects emotional nuances and expressions accurately.
            </p>
          </Card>

          {/* Card 2: AI Insights */}
          <Card className="p-6 bg-white border border-light-gray shadow-sm rounded-2xl hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-lavender/20 rounded-xl flex items-center justify-center text-2xl shrink-0">
                💡
              </div>
              <div>
                <span className="text-[11px] font-poppins font-semibold uppercase tracking-wider text-lavender bg-lavender/10 px-2 py-0.5 rounded-full">
                  Self-Reflection
                </span>
                <h3 className="text-base font-poppins font-semibold text-dark-text mt-1">Personalized Insights</h3>
              </div>
            </div>
            <p className="text-xs font-inter text-dark-text/75 leading-relaxed">
              Receive gentle, clinically-guided reflections and track your behavioral wellness trajectory over time without judgment.
            </p>
          </Card>

          {/* Card 3: Safe & Confidential */}
          <Card className="p-6 bg-white border border-light-gray shadow-sm rounded-2xl hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-teal/15 rounded-xl flex items-center justify-center text-2xl shrink-0">
                🔒
              </div>
              <div>
                <span className="text-[11px] font-poppins font-semibold uppercase tracking-wider text-teal bg-teal/10 px-2 py-0.5 rounded-full">
                  Privacy First
                </span>
                <h3 className="text-base font-poppins font-semibold text-dark-text mt-1">Safe & Confidential</h3>
              </div>
            </div>
            <p className="text-xs font-inter text-dark-text/75 leading-relaxed">
              A private digital sanctuary for your thoughts, with integrated campus counselor escalation whenever you need human support.
            </p>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-light-gray py-16 scroll-mt-6">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-r from-primary-blue to-teal rounded-full flex items-center justify-center mx-auto mb-3">
                <Image src="/icons/ai-sentiment.svg" alt="AI Sentiment Analysis" width={32} height={32} className="w-8 h-8 object-contain" />
              </div>
              <h3 className="font-poppins font-semibold text-dark-text mb-1 text-sm">AI Sentiment Analysis</h3>
              <p className="text-xs font-inter text-dark-text/70">
                NLP engine detects emotions in every journal entry — in English or Taglish.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-r from-teal to-lavender rounded-full flex items-center justify-center mx-auto mb-3">
                <Image src="/icons/mood-tracking.svg" alt="Mood Tracking" width={32} height={32} className="w-8 h-8 object-contain" />
              </div>
              <h3 className="font-poppins font-semibold text-dark-text mb-1 text-sm">Mood Tracking</h3>
              <p className="text-xs font-inter text-dark-text/70">
                Visualize your emotional patterns over days, weeks, and months.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-r from-lavender to-primary-blue rounded-full flex items-center justify-center mx-auto mb-3">
                <Image src="/icons/reflection-prompts.svg" alt="Reflection Prompts" width={32} height={32} className="w-8 h-8 object-contain" />
              </div>
              <h3 className="font-poppins font-semibold text-dark-text mb-1 text-sm">Reflection Prompts</h3>
              <p className="text-xs font-inter text-dark-text/70">
                Personalized AI prompts guide deeper self-awareness and growth.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-r from-warning-yellow to-success-green rounded-full flex items-center justify-center mx-auto mb-3">
                <Image src="/icons/crisis-support.svg" alt="Crisis Support" width={32} height={32} className="w-8 h-8 object-contain" />
              </div>
              <h3 className="font-poppins font-semibold text-dark-text mb-1 text-sm">Crisis Support</h3>
              <p className="text-xs font-inter text-dark-text/70">
                Instant access to mental health resources when you need them most.
              </p>
            </div>
          </div>

          {/* How It Works */}
          <div id="how-it-works" className="text-center scroll-mt-12">
            <h2 className="text-2xl font-dm-serif text-dark-text mb-8">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-12">
              <div className="bg-white rounded-2xl p-6">
                <div className="w-10 h-10 bg-light-gray rounded-full flex items-center justify-center mx-auto mb-3 border border-teal">
                  <span className="text-sm font-poppins font-bold text-dark-text">1</span>
                </div>
                <h3 className="font-poppins font-semibold text-dark-text mb-2 text-sm">Write Today</h3>
                <p className="text-xs font-inter text-dark-text/70">
                  Express your thoughts in your own words.
                </p>
              </div>
              <div className="bg-white rounded-2xl p-6">
                <div className="w-10 h-10 bg-light-gray rounded-full flex items-center justify-center mx-auto mb-3 border border-primary-blue">
                  <span className="text-sm font-poppins font-bold text-dark-text">2</span>
                </div>
                <h3 className="font-poppins font-semibold text-dark-text mb-2 text-sm">AI Analyzes</h3>
                <p className="text-xs font-inter text-dark-text/70">
                  Our AI reads your entry and your emotional tone.
                </p>
              </div>
              <div className="bg-white rounded-2xl p-6">
                <div className="w-10 h-10 bg-light-gray rounded-full flex items-center justify-center mx-auto mb-3 border border-lavender">
                  <span className="text-sm font-poppins font-bold text-dark-text">3</span>
                </div>
                <h3 className="font-poppins font-semibold text-dark-text mb-2 text-sm">Gain Insights</h3>
                <p className="text-xs font-inter text-dark-text/70">
                  Receive kind, actionable reflections to guide you.
                </p>
              </div>
            </div>

            <h2 className="text-xl font-dm-serif text-dark-text mb-4">Ready to begin your wellness journey?</h2>
            <Link href="/register">
              <Button size="lg">Create Free Account →</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}