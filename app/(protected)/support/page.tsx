"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function SupportPage() {
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<"inhale" | "hold1" | "exhale" | "hold2">("inhale");
  const [phaseCounter, setPhaseCounter] = useState(0);
  const [showBanner, setShowBanner] = useState(true);

  // Breathing exercise cycle
  const breathingCycle = [
    { phase: "inhale" as const, duration: 4, text: "Inhale 4s" },
    { phase: "hold1" as const, duration: 7, text: "Hold 7s" },
    { phase: "exhale" as const, duration: 8, text: "Exhale 8s" },
    { phase: "hold2" as const, duration: 1, text: "" }
  ];

  const startBreathing = () => {
    setBreathingActive(true);
    let currentPhaseIndex = 0;
    let currentPhaseCount = 0;

    const interval = setInterval(() => {
      currentPhaseCount++;
      setPhaseCounter(currentPhaseCount);
      
      if (currentPhaseCount >= breathingCycle[currentPhaseIndex].duration) {
        currentPhaseCount = 0;
        setPhaseCounter(0);
        currentPhaseIndex = (currentPhaseIndex + 1) % breathingCycle.length;
        setBreathingPhase(breathingCycle[currentPhaseIndex].phase);
      }
    }, 1000);

    setTimeout(() => {
      clearInterval(interval);
      setBreathingActive(false);
    }, 20000);
  };

  const crisisHotlines = [
    {
      name: "National Center for Mental Health",
      phone: "1553",
      description: "24/7 Crisis Hotline",
      icon: "📞"
    },
    {
      name: "In Touch Crisis Lines",
      phone: "(02) 8893-7603",
      description: "Mon-Sun, 10AM-10PM",
      icon: "💬"
    },
    {
      name: "Your University Counselor",
      phone: "guidance@up.edu.ph",
      description: "UP Guidance Center",
      icon: "🏫"
    },
    {
      name: "Hopeline Philippines",
      phone: "2919",
      description: "24/7 Text & Call Support",
      icon: "💙"
    }
  ];

  const groundingSteps = [
    "5 things you can see",
    "4 things you can touch",
    "3 things you can hear",
    "2 things you can smell",
    "1 thing you can taste"
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      {showBanner && (
        <div className="bg-soft-red/10 border-2 border-soft-red/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">💙</div>
            <div className="flex-1">
              <h2 className="text-lg font-dm-serif text-dark-text mb-2">
                Your recent journal entry showed signs of emotional distress.
              </h2>
              <p className="text-sm font-poppins text-dark-text/70 mb-4">
                You&apos;re not alone. Here are some resources that can help - you don&apos;t have to go through this by yourself.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button className="bg-soft-red hover:bg-soft-red/90">
                  Call a Crisis Line Now
                </Button>
                <Button variant="secondary">
                  Chat with a Counselor
                </Button>
              </div>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="text-dark-text/40 hover:text-dark-text"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text">Emergency Support</h1>
          <p className="text-sm text-dark-text/60 font-poppins">
            A safe space with grounding exercises, hotlines, and resources.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="ghost" className="text-sm">← Return to Dashboard</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Breathing & Grounding */}
        <div className="space-y-6">
          {/* Breathing Exercise Card */}
          <Card className="p-6 bg-gradient-to-br from-primary-blue/5 to-lavender/10">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
              <span>🌬️</span>
              Breathing Exercise
            </h3>
            <p className="text-sm font-poppins text-dark-text/70 mb-6">
              Take a moment. This 4-7-8 breathing technique can help calm your nervous system.
            </p>
            <div className="flex flex-col items-center gap-6">
              <div className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-1000 ${
                breathingPhase === "inhale" 
                  ? "bg-primary-blue/30 scale-100" 
                  : breathingPhase === "hold1" 
                  ? "bg-primary-blue/40 scale-110" 
                  : breathingPhase === "exhale" 
                  ? "bg-lavender/30 scale-100" 
                  : "bg-lavender/20 scale-90"
              }`}>
                <div className="text-center">
                  {breathingActive ? (
                    <>
                      <div className="text-3xl font-dm-serif text-dark-text">{phaseCounter}</div>
                      <div className="text-xs font-poppins text-dark-text/60">
                        {breathingCycle.find(c => c.phase === breathingPhase)?.text}
                      </div>
                    </>
                  ) : (
                    <div className="text-2xl">Tap to start</div>
                  )}
                </div>
              </div>
              {!breathingActive && (
                <Button onClick={startBreathing}>
                  Start Breathing Exercise
                </Button>
              )}
            </div>
          </Card>

          {/* 5-4-3-2-1 Grounding Technique */}
          <Card className="p-6">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
              <span>🧘</span>
              5-4-3-2-1 Grounding Technique
            </h3>
            <p className="text-sm font-poppins text-dark-text/70 mb-4">
              Bring yourself back to the present by noticing your surroundings.
            </p>
            <div className="space-y-3">
              {groundingSteps.map((step, index) => (
                <div
                  key={index}
                  className="p-4 bg-light-gray/30 rounded-xl flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-blue/10 text-primary-blue flex items-center justify-center text-sm font-bold">
                    {5 - index}
                  </div>
                  <div className="text-sm font-poppins text-dark-text">
                    {step}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Crisis Hotlines */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
              <span>📞</span>
              Philippine Crisis Hotlines
            </h3>
            <div className="space-y-3">
              {crisisHotlines.map((hotline, index) => (
                <a
                  key={index}
                  href={`tel:${hotline.phone}`}
                  className="block p-4 bg-light-gray/30 rounded-xl hover:bg-light-gray/50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{hotline.icon}</div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold font-poppins text-dark-text">
                        {hotline.name}
                      </h4>
                      <p className="text-xs text-dark-text/60 font-inter">
                        {hotline.description}
                      </p>
                    </div>
                    <Button variant="secondary" className="text-xs flex-shrink-0 bg-soft-red text-white hover:bg-soft-red/90">
                      Call Now
                    </Button>
                  </div>
                  <div className="mt-2 pl-12 text-lg font-semibold text-primary-blue font-poppins">
                    {hotline.phone}
                  </div>
                </a>
              ))}
            </div>
          </Card>

          {/* Quick Coping Tips */}
          <Card className="p-6 bg-gradient-to-br from-lavender/10 to-success-green/10">
            <h3 className="text-xs font-poppins uppercase tracking-wider text-dark-text/60 mb-4 flex items-center gap-2">
              <span>💡</span>
              Quick Coping Tips
            </h3>
            <div className="space-y-2 text-sm font-poppins text-dark-text/70">
              <p>• Drink a glass of cold water</p>
              <p>• Step outside for fresh air</p>
              <p>• Text a trusted friend</p>
              <p>• Listen to calming music</p>
              <p>• Squeeze a stress ball or pillow</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6">
        <p className="text-sm font-poppins text-dark-text/60 italic">
          &quot;Ikaw ay may halaga. Ang bawat araw ay isang bagong simula.&quot;
        </p>
        <p className="text-xs text-dark-text/40 font-inter mt-2">
          &quot;You have worth. Every day is a new beginning.&quot;
        </p>
      </div>
    </div>
  );
}
