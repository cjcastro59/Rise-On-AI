import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-header-bg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/logo/Without Text.png"
              alt="Rise On Logo"
              className="w-10 h-10 object-contain"
            />
            <span className="font-poppins font-bold text-dark-text text-xl">Rise On</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/features" className="text-dark-text hover:text-primary-blue text-sm font-poppins font-medium">Features</Link>
            <Link href="/how-it-works" className="text-dark-text hover:text-primary-blue text-sm font-poppins font-medium">How It Works</Link>
            <Link href="/support" className="text-dark-text hover:text-primary-blue text-sm font-poppins font-medium">Support</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-dark-text hover:text-primary-blue text-sm font-poppins font-medium">
              Log In
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started Free</Button>
            </Link>
          </div>
        </div>
      </header>

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
          <Button variant="secondary" size="lg">
            See How It Works →
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 text-left bg-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-warning-yellow/50 rounded-xl flex items-center justify-center">
                <span className="text-3xl">😊</span>
              </div>
              <div>
                <p className="text-lg font-poppins font-semibold text-dark-text">Hopeful</p>
                <div className="w-full h-2 bg-light-gray rounded-full overflow-hidden">
                  <div className="h-full bg-teal w-4/5 rounded-full"></div>
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-6 text-left bg-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-light-gray rounded-xl flex items-center justify-center">
                <span className="text-3xl">💡</span>
              </div>
              <div>
                <p className="text-xs font-poppins text-dark-text/70 mb-1">AI Insights</p>
                <p className="text-sm font-poppins text-dark-text">“You’ve shown resilience this week. Your positive entries have increased by 24%.”</p>
              </div>
            </div>
          </Card>
          <Card className="p-6 text-left bg-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-light-gray rounded-xl flex items-center justify-center">
                <span className="text-3xl">🔥</span>
              </div>
              <div className="text-center">
                <p className="text-2xl font-dm-serif text-dark-text">12</p>
                <p className="text-xs font-poppins text-dark-text/70">Day streak</p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-light-gray py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-r from-primary-blue to-teal rounded-full flex items-center justify-center mx-auto mb-3">
                <img src="/icons/ai-sentiment.svg" alt="AI Sentiment Analysis" className="w-8 h-8" />
              </div>
              <h3 className="font-poppins font-semibold text-dark-text mb-1 text-sm">AI Sentiment Analysis</h3>
              <p className="text-xs font-inter text-dark-text/70">
                NLP engine detects emotions in every journal entry — in English or Taglish.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-r from-teal to-lavender rounded-full flex items-center justify-center mx-auto mb-3">
                <img src="/icons/mood-tracking.svg" alt="Mood Tracking" className="w-8 h-8" />
              </div>
              <h3 className="font-poppins font-semibold text-dark-text mb-1 text-sm">Mood Tracking</h3>
              <p className="text-xs font-inter text-dark-text/70">
                Visualize your emotional patterns over days, weeks, and months.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-r from-lavender to-primary-blue rounded-full flex items-center justify-center mx-auto mb-3">
                <img src="/icons/reflection-prompts.svg" alt="Reflection Prompts" className="w-8 h-8" />
              </div>
              <h3 className="font-poppins font-semibold text-dark-text mb-1 text-sm">Reflection Prompts</h3>
              <p className="text-xs font-inter text-dark-text/70">
                Personalized AI prompts guide deeper self-awareness and growth.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-r from-warning-yellow to-success-green rounded-full flex items-center justify-center mx-auto mb-3">
                <img src="/icons/crisis-support.svg" alt="Crisis Support" className="w-8 h-8" />
              </div>
              <h3 className="font-poppins font-semibold text-dark-text mb-1 text-sm">Crisis Support</h3>
              <p className="text-xs font-inter text-dark-text/70">
                Instant access to mental health resources when you need them most.
              </p>
            </div>
          </div>

          {/* How It Works */}
          <div className="text-center">
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