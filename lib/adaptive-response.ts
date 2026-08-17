// =====================================================================
// lib/adaptive-response.ts  —  Phase 4.4
// Adaptive Conversational Intelligence (ACI)
// =====================================================================
//
// DOCUMENTED MODULE (README §10)
// ──────────────────────────────
// Inputs:
//   - Predicted Sentiment (positive / negative / distress)
//   - Behavioral Trend Score
//   - Wellness Score
//   - Distress Risk Level
//
// Response categories (3 only, NO Neutral):
//   - Positive Response
//   - Negative Response
//   - Distress Response
//
// Constraints (README §10):
//   - Be supportive
//   - Encourage reflection
//   - Encourage healthy coping practices
//   - Avoid clinical diagnosis
//   - Avoid claiming to replace professional counseling
//
// IMPORTANT DISCLAIMER
// ────────────────────
// This module generates supportive, reflective responses only.
// It does NOT diagnose mental health conditions.
// It does NOT replace a therapist, psychiatrist, or any healthcare professional.
// It does NOT provide medical advice or clinical assessments.
//
// ── STRATEGY SELECTION ───────────────────────────────────────────────
//
// Three response categories correspond directly to the three sentiment classes.
// Each category has sub-tones driven by behavioral/wellness/risk context.
//
// CATEGORY 1 — POSITIVE RESPONSE
//   Triggers: sentiment === "positive"
//   Sub-tones:
//     "sustained_growth"    BTS ≥ 20 AND wellness ≥ 6
//     "positive_vigilant"   wellness < 6 despite positive sentiment
//     "positive_default"    all other positive
//
// CATEGORY 2 — NEGATIVE RESPONSE
//   Triggers: sentiment === "negative"
//   Sub-tones:
//     "extended_streak"     consecutiveNegativeCount ≥ 5
//     "declining_trend"     BTS ≤ −20 AND wellness < 6
//     "at_risk_wellness"    wellness < 4
//     "negative_default"    all other negative
//
// CATEGORY 3 — DISTRESS RESPONSE
//   Triggers: sentiment === "distress"
//   OR: riskLevel === "Critical Risk" (safety override)
//   Sub-tones:
//     "critical_safety"     riskLevel === "Critical Risk"  [HIGHEST PRIORITY]
//     "high_risk_urgent"    riskLevel === "High Risk"
//     "distress_support"    Moderate/Low Risk with distress sentiment
//
// SAFETY HIERARCHY (always applied before output):
//   1. distress sentiment → always Category 3, no override possible
//   2. Critical Risk (any sentiment) → always Category 3 sub-tone "critical_safety"
//   3. High Risk (any sentiment) → minimum Category 3 sub-tone "high_risk_urgent"
//   4. All other cases → determined by sentiment + context
// =====================================================================

import type { SentimentLabel } from "@/lib/behavioral-analytics";
import type { DistressRiskLevel } from "@/lib/distress-risk";
import type { WellnessLevel } from "@/lib/wellness-assessment";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ACIResponseCategory = "positive" | "negative" | "distress";

export type ACIResponseTone =
  // Positive
  | "sustained_growth"
  | "positive_vigilant"
  | "positive_default"
  // Negative
  | "extended_streak"
  | "declining_trend"
  | "at_risk_wellness"
  | "negative_default"
  // Distress
  | "critical_safety"
  | "high_risk_urgent"
  | "distress_support";

export interface ACIContextInput {
  // Step 1 — Sentiment classification (required)
  sentiment: SentimentLabel;

  // Step 2 — Behavioral indicators (from behavioral_indicators row)
  behavioralTrendScore: number;        // −100 to +100
  consecutiveNegativeCount: number;       // 0 → unbounded
  journalingFrequencyScore: number;       // 0–100

  // Step 3 — Wellness Assessment
  wellnessScore: number | null; // 0.00–10.00
  wellnessLevel: WellnessLevel | null;

  // Step 4 — Distress Risk Indicator
  distressRiskLevel: DistressRiskLevel | null;

  // Step 5 — Optional journal context
  entryMood?: string | null;
  recentEmotions?: string[];
}

export interface ACIResponse {
  // Which of the 3 documented categories was applied
  responseCategory: ACIResponseCategory;
  // Sub-tone for transparency / Capstone documentation
  tone: ACIResponseTone;
  // Response content
  greeting: string;
  message: string;
  reflection: string;
  suggestions: string[];
  // Crisis resource line — populated only for distress/high-risk
  crisisNote: string | null;
  // Always present — system disclaimer per README
  disclaimer: string;
  // Full context snapshot used (for Capstone transparency)
  contextUsed: {
    sentiment: SentimentLabel;
    wellnessScore: number | null;
    wellnessLevel: WellnessLevel | null;
    distressRiskLevel: DistressRiskLevel | null;
    behavioralTrendScore: number;
    consecutiveNegativeCount: number;
  };
}

// ── Disclaimer (always appended) ─────────────────────────────────────────────

const DISCLAIMER =
  "This is an AI-generated supportive response for self-reflection purposes only. " +
  "It does not constitute medical advice, a clinical diagnosis, or professional counseling. " +
  "If you are experiencing serious distress, please speak with a qualified mental health professional.";

// ── Crisis resource line ──────────────────────────────────────────────────────

const CRISIS_NOTE_CRITICAL =
  "🆘 If you are in immediate danger or having thoughts of harming yourself, " +
  "please contact emergency services (911 or your local emergency number), " +
  "the National Crisis Hotline (988 in the US), or go to your nearest emergency room. " +
  "You are not alone — help is available right now.";

const CRISIS_NOTE_HIGH =
  "📞 Please consider reaching out to a counselor, trusted adult, or a mental health helpline. " +
  "In the Philippines: HOPELINE 0917-558-4673 | NCMH 1553. " +
  "You deserve support and you do not have to face this alone.";

const CRISIS_NOTE_DISTRESS =
  "💙 We encourage you to talk to someone you trust or a school/community counselor. " +
  "Support is available, and sharing what you're feeling is a brave and important step.";

// ── Response pools ────────────────────────────────────────────────────────────
// Each pool contains arrays for: greeting[], message[], reflection[], suggestions[][]
// Selection is deterministic based on context hash — no randomness in production.

type ResponsePool = {
  greetings: string[];
  messages: string[];
  reflections: string[];
  suggestions: string[][];
};

const POOLS: Record<ACIResponseTone, ResponsePool> = {

  // ── POSITIVE CATEGORY ─────────────────────────────────────────────────────

  sustained_growth: {
    greetings: [
      "That's wonderful to see! 🌱",
      "Your progress really shows. ✨",
      "Keep going — you're building something real. 🌟",
    ],
    messages: [
      "Your journal reflects both a positive outlook and a meaningful upward trend over time. " +
      "Moments like these are worth recognizing — not just for how you feel today, " +
      "but because they represent consistent emotional growth worth protecting.",
      "There's a clear pattern of improvement in your entries lately, and today's positive reflection " +
      "adds to that. This kind of sustained progress is built one journal entry at a time.",
      "Both today's entry and your recent emotional history suggest you're in a genuinely good place. " +
      "Acknowledging that fully — rather than rushing past it — can help you hold on to these moments.",
    ],
    reflections: [
      "What specific habits or choices do you think contributed most to this positive period? " +
      "Writing them down makes them easier to return to when things feel harder.",
      "Looking back on the last few weeks, what has shifted most for you? " +
      "Understanding the 'why' behind growth helps sustain it.",
      "Is there someone in your life who has supported you recently? " +
      "Acknowledging that connection — even privately — can deepen it.",
    ],
    suggestions: [
      [
        "Write a short gratitude note for one specific thing that went well this week.",
        "Share something positive with a friend or family member today.",
        "Plan one small activity that continues this positive momentum tomorrow.",
      ],
      [
        "Start a 'wins journal' to track moments of growth — big or small.",
        "Reflect on one challenge you've overcome recently and what it taught you.",
        "Set a simple intention for the next week that builds on what's working.",
      ],
    ],
  },

  positive_vigilant: {
    greetings: [
      "It's good to see a positive entry today. 😊",
      "Your positivity today is real — hold on to it. 🌼",
    ],
    messages: [
      "Today's entry reflects a positive outlook, which is genuinely good to see. " +
      "At the same time, your recent wellness indicators suggest some ongoing challenges. " +
      "It's okay — and healthy — to feel positive even while navigating difficult stretches. " +
      "Celebrate today's feeling without pressure to sustain it perfectly.",
      "There's real value in a positive entry, especially when the bigger picture has had its rough spots. " +
      "Today's mood is valid and worth acknowledging fully. " +
      "Keep journaling consistently — it's one of the most reliable ways to support your own wellbeing.",
    ],
    reflections: [
      "What made today feel different from the harder days recently? " +
      "Even a small observation here can be a useful guide for future difficult moments.",
      "Is there something specific you did or avoided today that contributed to feeling better? " +
      "Noticing those patterns is a genuinely useful skill.",
    ],
    suggestions: [
      [
        "Try to identify and repeat one small thing that helped you feel positive today.",
        "Keep your journaling habit going — consistency matters more than perfect entries.",
        "If you have a counselor or trusted person, consider sharing a positive update with them.",
      ],
    ],
  },

  positive_default: {
    greetings: [
      "Great to hear from you today! 😊",
      "Thank you for sharing — your entry today is encouraging. 🌟",
    ],
    messages: [
      "Your journal entry today reflects a positive emotional state. " +
      "Taking time to notice and write about what's going well is an important part of emotional self-awareness. " +
      "Keep recognizing these moments — they matter more than they might seem.",
      "It's clear from today's writing that you're approaching things with a constructive mindset. " +
      "That kind of perspective is genuinely valuable and worth acknowledging.",
    ],
    reflections: [
      "What is one thing you are grateful for from today, even something small? " +
      "Noting it here can help reinforce the pattern.",
      "How does today's mood compare to how you've been feeling overall lately? " +
      "Tracking those shifts is part of understanding your emotional rhythms.",
    ],
    suggestions: [
      [
        "Do something kind for yourself today — you deserve to celebrate the positive moments.",
        "Share your good mood with someone close to you.",
        "Spend a few minutes outside or in a space that feels calming.",
      ],
    ],
  },

  // ── NEGATIVE CATEGORY ─────────────────────────────────────────────────────

  extended_streak: {
    greetings: [
      "I see you're going through a difficult period. 💙",
      "Thank you for continuing to journal even when it's hard. 💙",
    ],
    messages: [
      "Your recent entries show a pattern of difficult days, and today continues that. " +
      "First — the fact that you are still writing is important. Journaling when things are hard " +
      "takes real effort, and it's a meaningful form of self-care. " +
      "You don't have to resolve everything at once. Right now, just being honest in your writing is enough.",
      "Several consecutive entries reflect a challenging emotional period. " +
      "This is a pattern worth paying attention to — not as a judgment, but as information. " +
      "Reaching out to someone you trust, or to a counselor, doesn't mean you've failed. " +
      "It means you're taking your wellbeing seriously.",
    ],
    reflections: [
      "Is there one thing — however small — that has felt even slightly easier or better recently? " +
      "Finding it doesn't minimize the difficulty; it just gives you a foothold.",
      "Have you been able to tell anyone close to you how you've been feeling lately? " +
      "Sometimes naming it to another person makes it feel a little less heavy.",
    ],
    suggestions: [
      [
        "Consider speaking with a school counselor, therapist, or trusted adult about what you've been experiencing.",
        "Try one simple self-care action today: a short walk, a meal, or a few minutes of rest.",
        "You don't need to solve everything — focus on just today, one small step at a time.",
      ],
    ],
  },

  declining_trend: {
    greetings: [
      "Thank you for writing today. 💙",
      "Your honesty in writing matters. 💙",
    ],
    messages: [
      "Your journal entry reflects a negative emotional state, and your recent emotional trend " +
      "has been moving in a difficult direction. This kind of awareness — noticing the pattern " +
      "rather than just the individual feeling — is actually a strength. " +
      "Please know that emotional downturns are something that can be supported. " +
      "You do not have to navigate this entirely on your own.",
      "There's a real downward shift in your recent emotional indicators alongside today's negative entry. " +
      "Acknowledging that takes courage. The next step is to bring another person — a friend, " +
      "a family member, or a counselor — into what you're going through, even briefly.",
    ],
    reflections: [
      "What feels like the heaviest part of things right now? " +
      "Writing it out — even in fragments — can help make it feel more manageable.",
      "Is there one small thing you could do today to ease even a fraction of what you're carrying? " +
      "It doesn't need to be a solution — just a direction.",
    ],
    suggestions: [
      [
        "Reach out to one trusted person today — a message, a call, or just sitting with them.",
        "Try a short breathing exercise: 4 counts in, hold for 4, 4 counts out. Repeat 3 times.",
        "Consider speaking with a counselor, especially if this feeling has persisted for more than a week.",
      ],
    ],
  },

  at_risk_wellness: {
    greetings: [
      "I'm glad you're here and still writing. 💙",
    ],
    messages: [
      "Today's entry reflects difficult feelings, and your current wellness indicators suggest " +
      "you've been managing a challenging period for some time. " +
      "Please consider speaking with a counselor or mental health professional — " +
      "not because something is 'wrong' with you, but because you deserve more support than journaling alone can provide. " +
      "Seeking help is a sign of self-awareness, not weakness.",
      "Your emotional wellbeing metrics and today's writing together suggest you would benefit " +
      "from additional support right now. " +
      "A counselor, a therapist, or even a trusted person in your life can offer something this journal cannot: " +
      "a real human connection to help you through.",
    ],
    reflections: [
      "Have you been able to rest, eat, and sleep reasonably well this week? " +
      "Basic physical care has a real effect on emotional state, even when it doesn't feel like enough.",
      "What would it take for you to feel even a small amount better tomorrow? " +
      "Starting there — tiny and concrete — can sometimes be enough.",
    ],
    suggestions: [
      [
        "Speak with a counselor or mental health professional — your school, community, or online services may offer this.",
        "Tell one trusted person how you have genuinely been feeling, not just 'I'm fine'.",
        "Prioritize sleep tonight, even if other things feel unresolved.",
      ],
    ],
  },

  negative_default: {
    greetings: [
      "Thank you for being honest about how you're feeling. 💙",
      "Your feelings are valid. 💙",
    ],
    messages: [
      "Today's entry reflects a difficult emotional state, and that's completely valid to acknowledge. " +
      "Difficult days are a real part of life, and writing about them is genuinely useful — " +
      "it externalizes what you're carrying and gives you something to reflect on later. " +
      "Be gentle with yourself today.",
      "It sounds like you're going through something hard right now. " +
      "Thank you for writing it down rather than just pushing through in silence. " +
      "Your feelings deserve to be acknowledged, even if they don't have a neat resolution yet.",
    ],
    reflections: [
      "What is one thing you could do right now to take care of yourself, even in a small way? " +
      "It doesn't need to fix anything — just be a kind gesture toward yourself.",
      "Is there anyone you feel comfortable talking to about what's been going on? " +
      "Sometimes saying it out loud helps in ways that writing alone can't.",
    ],
    suggestions: [
      [
        "Take a short break from whatever is causing stress — even 10 minutes outside can help.",
        "Write down one thing that you're looking forward to, however small.",
        "Reach out to a friend, family member, or counselor if the feeling persists.",
      ],
    ],
  },

  // ── DISTRESS CATEGORY ─────────────────────────────────────────────────────

  critical_safety: {
    greetings: [
      "We are concerned about you and want you to be safe. 🆘",
    ],
    messages: [
      "Your journal entry and recent patterns together indicate serious distress signals. " +
      "Your safety is the most important priority right now. " +
      "Please reach out to someone you trust — a family member, teacher, counselor, " +
      "or a crisis support line — as soon as possible. " +
      "You do not have to face this alone, and help is available right now.",
      "What you are experiencing right now is serious, and it deserves immediate support — " +
      "not tomorrow, not later — now. " +
      "Please contact a counselor, trusted adult, or crisis hotline. " +
      "Your life has value and there are people who want to help you through this.",
    ],
    reflections: [
      "Can you identify one person you could contact right now — a family member, a friend, a counselor? " +
      "Just one person. That is the most important next step.",
    ],
    suggestions: [
      [
        "Contact a crisis hotline or emergency services immediately if you feel unsafe.",
        "Tell someone you trust — in person, by text, or by call — how you are truly feeling right now.",
        "Go to a safe place where you are not alone while you seek support.",
      ],
    ],
  },

  high_risk_urgent: {
    greetings: [
      "We hear you, and we're concerned. 💙",
      "Thank you for writing today — your wellbeing matters. 💙",
    ],
    messages: [
      "Your entry and recent emotional patterns show multiple indicators of serious distress. " +
      "This level of emotional difficulty deserves proper support — more than journaling alone. " +
      "Please reach out to a counselor, a mental health helpline, or a trusted adult today. " +
      "You do not have to resolve this by yourself.",
      "Several signs across your recent entries and wellness indicators suggest you're struggling significantly. " +
      "That is real, and it deserves real support. " +
      "Speaking with a counselor or a mental health professional is not an overreaction — " +
      "it is exactly the right step when things feel this heavy.",
    ],
    reflections: [
      "Is there someone in your life — a family member, counselor, or friend — " +
      "who you could reach out to today, even just to let them know how you've been feeling?",
    ],
    suggestions: [
      [
        "Reach out to a counselor or mental health helpline today.",
        "Tell one trusted person the truth about how you have been feeling recently.",
        "If things feel urgent, please do not stay alone — go somewhere safe with others around you.",
      ],
    ],
  },

  distress_support: {
    greetings: [
      "Thank you for having the courage to write today. 💙",
      "We're here with you. 💙",
    ],
    messages: [
      "Your entry reflects feelings of significant distress, and we want you to know: " +
      "what you're experiencing is real, and you deserve support for it. " +
      "This journal is a safe space, but it works best alongside a real human connection — " +
      "a counselor, a trusted friend, or a family member who can truly be there with you.",
      "Writing about distress takes courage, and we want to honor that. " +
      "At the same time, journaling has its limits — some feelings need to be heard by another person. " +
      "Please consider reaching out to someone who can offer that kind of presence and support.",
    ],
    reflections: [
      "Is there one person — even someone you haven't spoken to in a while — " +
      "that you think might understand what you're going through? " +
      "Sometimes a small connection can make a real difference.",
    ],
    suggestions: [
      [
        "Reach out to a school counselor, community mental health resource, or trusted adult.",
        "Try to stay in contact with at least one person today — even a short message counts.",
        "If the distress feels overwhelming, please contact a helpline. You don't have to manage this alone.",
      ],
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Deterministic selection from a pool array using a simple context hash. */
function selectFromPool<T>(pool: T[], seed: number): T {
  return pool[Math.abs(seed) % pool.length];
}

/** Produce a stable integer seed from context values. */
function contextSeed(input: ACIContextInput): number {
  const btsInt = Math.round(input.behavioralTrendScore);
  const wInt = Math.round((input.wellnessScore ?? 5) * 10);
  const streakN = Math.min(input.consecutiveNegativeCount, 20);
  return Math.abs(btsInt * 31 + wInt * 17 + streakN * 7);
}

// ── Strategy selection ────────────────────────────────────────────────────────

function selectTone(input: ACIContextInput): ACIResponseTone {
  const { sentiment, behavioralTrendScore: bts, wellnessScore, consecutiveNegativeCount, distressRiskLevel } = input;
  const ws = wellnessScore ?? 5;

  // Safety override: Critical Risk always triggers critical_safety
  if (distressRiskLevel === "Critical Risk") 
    return "critical_safety";

  // Safety override: distress sentiment always triggers a distress tone
  if (sentiment === "distress") {
    if (distressRiskLevel === "High Risk")    
      return "high_risk_urgent";
    return "distress_support";
  }

  // Safety override: High Risk regardless of sentiment
  if (distressRiskLevel === "High Risk") return "high_risk_urgent";

  // Negative category
  if (sentiment === "negative") {
    if (consecutiveNegativeCount >= 5)        
      return "extended_streak";
    if (bts <= -20 && ws < 6)                 
      return "declining_trend";
    if (ws < 4)                               
      return "at_risk_wellness";
    return "negative_default";
  }

  // Positive category
  if (bts >= 20 && ws >= 6)                   
    return "sustained_growth";
  if (ws < 6)                                 
    return "positive_vigilant";
  return "positive_default";
}

function toneToCategory(tone: ACIResponseTone): ACIResponseCategory {
  if (tone.startsWith("positive") || tone === "sustained_growth" || tone === "positive_vigilant") return "positive";
  if (tone.startsWith("critical") || tone.startsWith("high_risk") || tone.startsWith("distress")) return "distress";
  return "negative";
}

function selectCrisisNote(tone: ACIResponseTone): string | null {
  if (tone === "critical_safety")  return CRISIS_NOTE_CRITICAL;
  if (tone === "high_risk_urgent") return CRISIS_NOTE_HIGH;
  if (tone === "distress_support") return CRISIS_NOTE_DISTRESS;
  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate an adaptive supportive response from full emotional context.
 *
 * This is NOT an AI language model. Responses are selected from curated,
 * clinically-aware pools based on the documented strategy rules.
 * Output is deterministic for the same context inputs.
 *
 * DISCLAIMER: Output is for reflection support only, not clinical care.
 */
export function generateAdaptiveResponse(input: ACIContextInput): ACIResponse {
  const tone = selectTone(input);
  const category = toneToCategory(tone);
  const pool = POOLS[tone];
  const seed = contextSeed(input);

  const greeting = selectFromPool(pool.greetings, seed);
  const message = selectFromPool(pool.messages, seed + 1);
  const reflection  = selectFromPool(pool.reflections, seed + 2);
  const suggestions = selectFromPool(pool.suggestions, seed + 3);
  const crisisNote  = selectCrisisNote(tone);

  return {
    responseCategory: category,
    tone,
    greeting,
    message,
    reflection,
    suggestions,
    crisisNote,
    disclaimer: DISCLAIMER,
    contextUsed: {
      sentiment: input.sentiment,
      wellnessScore: input.wellnessScore,
      wellnessLevel: input.wellnessLevel,
      distressRiskLevel: input.distressRiskLevel,
      behavioralTrendScore: input.behavioralTrendScore,
      consecutiveNegativeCount: input.consecutiveNegativeCount,
    },
  };
}

// ── UI configuration ──────────────────────────────────────────────────────────

export const ACI_CATEGORY_CONFIG: Record<
  ACIResponseCategory,
  { color: string; bgColor: string; borderColor: string; emoji: string; label: string }
> = {
  positive: {
    color: "#2D6A4F",
    bgColor: "#B7E4C7",
    borderColor: "#52B788",
    emoji: "😊",
    label: "Positive Response",
  },
  negative: {
    color: "#7B5E2A",
    bgColor: "#FFE8A1",
    borderColor: "#E9C46A",
    emoji: "💙",
    label: "Supportive Response",
  },
  distress: {
    color: "#7B1C1C",
    bgColor: "#FECACA",
    borderColor: "#EF4444",
    emoji: "🆘",
    label: "Crisis-Aware Response",
  },
};
