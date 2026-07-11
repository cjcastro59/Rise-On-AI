export type Sentiment = "positive" | "negative" | "distress";
export type MoodCategory = 
  | "happy" 
  | "calm" 
  | "excited" 
  | "anxious" 
  | "sad" 
  | "frustrated" 
  | "overwhelmed";

export interface AnalysisResult {
  sentiment: Sentiment;
  sentimentScore: number; // 0-100 (overall score)
  positivePercentage: number; // 0-100
  negativePercentage: number; // 0-100
  distressPercentage: number; // 0-100
  emotions: string[];
  keyPhrases: string[];
  feedback: string;
  reflection: string;
  suggestions: string[];
}

// =====================================================
// KEYWORD DATABASES WITH WEIGHTS (English + Tagalog/Taglish)
// =====================================================

interface WeightedKeyword {
  word: string;
  weight: number; // 1-10, higher = more impact
}

// 1. Distress Keywords (most severe - highest priority)
const distressKeywords: WeightedKeyword[] = [
  // Highest severity
  { word: "suicide", weight: 10 },
  { word: "kill myself", weight: 10 },
  { word: "end it all", weight: 10 },
  { word: "can't go on", weight: 10 },
  { word: "no reason to live", weight: 10 },
  { word: "i want to die", weight: 10 },
  { word: "life is meaningless", weight: 10 },
  { word: "what's the point", weight: 10 },
  { word: "give up", weight: 9 },
  { word: "want to end my life", weight: 10 },
  { word: "don't want to live", weight: 10 },
  { word: "ready to die", weight: 10 },
  { word: "better off dead", weight: 10 },
  { word: "wish i was dead", weight: 10 },
  { word: "i'm better off dead", weight: 10 },
  { word: "self harm", weight: 10 },
  { word: "cut myself", weight: 10 },
  { word: "hurt myself", weight: 9 },
  { word: "harm myself", weight: 9 },
  { word: "magpakamatay", weight: 10 },
  { word: "mamatay na lang ako", weight: 10 },
  { word: "gusto ko nang mamatay", weight: 10 },
  { word: "gusto ko na mamatay", weight: 10 },
  { word: "gusto kong mamatay", weight: 10 },
  { word: "gusto ko nang magpakamatay", weight: 10 },
  { word: "gusto ko magpakamatay", weight: 10 },
  { word: "gusto ko nang matapos ang lahat", weight: 9 },
  { word: "gusto ko nang tapusin ang lahat", weight: 9 },
  { word: "gusto ko nang maglaho", weight: 8 },
  { word: "gusto ko nang mawala", weight: 8 },
  { word: "walang rason para mabuhay", weight: 9 },
  { word: "hindi ko na kaya", weight: 8 },
  { word: "tapos na", weight: 7 },
  { word: "wala ng pag-asa", weight: 8 },
  { word: "sugatan ko ang sarili ko", weight: 10 },
  { word: "saktan ko ang sarili ko", weight: 9 },
  // High severity
  { word: "i can't do this anymore", weight: 9 },
  { word: "i'm done", weight: 8 },
  { word: "no way out", weight: 9 },
  { word: "trapped", weight: 8 },
  { word: "desperate", weight: 8 },
  { word: "desperado", weight: 8 },
  { word: "napaka desperado", weight: 8 },
  { word: "suko na", weight: 8 },
  { word: "ayoko na buhay", weight: 9 },
  { word: "patayin ko ang sarili ko", weight: 10 }
];

// 2. Negative keywords with weights
const negativeKeywords: WeightedKeyword[] = [
  // High weight
  { word: "hopeless", weight: 8 },
  { word: "worthless", weight: 8 },
  { word: "empty", weight: 7 },
  { word: "depressed", weight: 8 },
  { word: "misery", weight: 8 },
  { word: "despair", weight: 8 },
  { word: "desperation", weight: 8 },
  { word: "suicidal", weight: 10 },
  { word: "walang pag-asa", weight: 8 },
  { word: "wala nang kwenta", weight: 8 },
  { word: "wala akong silbi", weight: 8 },
  { word: "malungkot na malungkot", weight: 8 },
  { word: "unfair", weight: 6 },
  { word: "ang unfair", weight: 7 },
  { word: "pagsubok", weight: 3 },
  // Medium weight
  { word: "sad", weight: 5 },
  { word: "anxious", weight: 5 },
  { word: "worried", weight: 5 },
  { word: "stressed", weight: 6 },
  { word: "overwhelmed", weight: 7 },
  { word: "angry", weight: 5 },
  { word: "frustrated", weight: 5 },
  { word: "lonely", weight: 6 },
  { word: "afraid", weight: 5 },
  { word: "scared", weight: 5 },
  { word: "tired", weight: 4 },
  { word: "exhausted", weight: 6 },
  { word: "painful", weight: 6 },
  { word: "hurt", weight: 5 },
  { word: "suffer", weight: 6 },
  { word: "malungkot", weight: 5 },
  { word: "nababahala", weight: 5 },
  { word: "pagod", weight: 4 },
  { word: "pagod na pagod", weight: 6 },
  { word: "hirap", weight: 5 },
  { word: "hirap na hirap", weight: 7 },
  { word: "takot", weight: 5 },
  { word: "sakit", weight: 5 },
  { word: "lungkot", weight: 5 },
  { word: "pighati", weight: 6 },
  { word: "pangamba", weight: 5 },
  { word: "kaba", weight: 5 },
  { word: "galit", weight: 5 },
  { word: "inis", weight: 4 },
  // Low weight
  { word: "down", weight: 3 },
  { word: "blue", weight: 3 },
  { word: "bummed", weight: 3 },
  { word: "bad day", weight: 4 },
  { word: "exams", weight: 4 },
  { word: "exam", weight: 4 },
  { word: "pagsusulit", weight: 4 },
  { word: "kapos sa hininga", weight: 5 },
  { word: "ayoko na", weight: 5 }
];

// 3. Positive keywords with weights
const positiveKeywords: WeightedKeyword[] = [
  // High weight
  { word: "happy", weight: 6 },
  { word: "joy", weight: 7 },
  { word: "love", weight: 7 },
  { word: "grateful", weight: 7 },
  { word: "thankful", weight: 7 },
  { word: "blessed", weight: 7 },
  { word: "hopeful", weight: 7 },
  { word: "optimistic", weight: 7 },
  { word: "proud", weight: 6 },
  { word: "accomplished", weight: 7 },
  { word: "masaya", weight: 6 },
  { word: "maligaya", weight: 7 },
  { word: "saya", weight: 6 },
  { word: "salamat", weight: 7 },
  { word: "may pag-asa", weight: 7 },
  { word: "pinagpala", weight: 7 },
  { word: "matagumpay", weight: 7 },
  { word: "kakayanin", weight: 8 },
  { word: "kakayanin natin", weight: 8 },
  { word: "kaya natin", weight: 7 },
  { word: "kaya ko", weight: 7 },
  { word: "kayang kaya", weight: 8 },
  // Medium weight
  { word: "excited", weight: 5 },
  { word: "peaceful", weight: 5 },
  { word: "calm", weight: 5 },
  { word: "content", weight: 5 },
  { word: "great", weight: 5 },
  { word: "wonderful", weight: 5 },
  { word: "amazing", weight: 6 },
  { word: "fantastic", weight: 6 },
  { word: "beautiful", weight: 5 },
  { word: "cheerful", weight: 5 },
  { word: "maganda", weight: 5 },
  { word: "maginhawa", weight: 5 },
  { word: "masipag", weight: 5 },
  { word: "matiyaga", weight: 5 },
  { word: "malakas", weight: 5 },
  { word: "matalino", weight: 5 },
  { word: "nakakatuwa", weight: 5 },
  { word: "nakakagalak", weight: 5 },
  // Low weight
  { word: "good", weight: 4 },
  { word: "okay", weight: 3 },
  { word: "fine", weight: 3 },
  { word: "nice", weight: 4 },
  { word: "okay lang", weight: 3 }
];

// Negation words
const negationWords = ["not", "no", "never", "don't", "didn't", "won't", "can't", "cannot", "hindi", "hindi ako", "wala akong"];

// Feedback templates
const feedbackTemplates = {
  positive: [
    "Your entry radiates positivity! It's wonderful to see you in such a good place.",
    "I love the optimistic tone in your writing. Keep shining bright!",
    "Your gratitude and positive energy are truly inspiring. Well done!",
    "This entry reflects a beautiful mindset. I'm so happy for you!",
    "Your positive spirit is contagious! Great job focusing on the good things."
  ],
  negative: [
    "Your entry suggests you're going through a tough time. Remember, it's okay to not be okay.",
    "It sounds like you're carrying a heavy load. You don't have to go through this alone.",
    "Your feelings are valid. Thank you for being honest about what you're experiencing.",
    "I hear you, and I'm here with you. This difficult moment won't last forever.",
    "Your journal entry suggests signs of stress or emotional exhaustion. Be gentle with yourself."
  ],
  distress: [
    "I'm concerned about what you've shared. Please reach out to someone you trust immediately.",
    "Your safety is the top priority. Please talk to a mental health professional or a trusted person right away.",
    "You matter, and there is help available. Please don't hesitate to reach out for support.",
    "I'm worried about you. Please contact a crisis hotline or someone who can help you right now.",
    "You're not alone in this. Please reach out to a trusted friend, family member, or professional immediately."
  ]
};

const reflectionTemplates = {
  positive: [
    "Reflect on what brought you this joy and hold onto those moments.",
    "Take pride in how far you've come and celebrate your wins, big or small.",
    "Consider how you can carry this positive energy forward into tomorrow.",
    "Think about the people or things that contributed to your good mood today.",
    "Remember to acknowledge and appreciate the positives in your life, no matter how small."
  ],
  negative: [
    "Consider taking short breaks and identifying the situations that contributed to these feelings.",
    "Reflect on what you need right now - rest, comfort, or someone to talk to.",
    "Think about small steps you can take to ease your burden, even just a little.",
    "Remember that asking for help is a sign of strength, not weakness.",
    "Regular reflection may help you recognize patterns in your emotional well-being."
  ],
  distress: [
    "Please seek immediate support. You don't have to face this by yourself.",
    "Your life matters. Reach out to someone who can help you through this crisis.",
    "Crisis situations require immediate attention. Please contact a professional right away.",
    "There is hope and help available. Please reach out to a trusted person or hotline now.",
    "You deserve support and care. Please don't wait to ask for help."
  ]
};

const suggestionTemplates = {
  positive: [
    "Do something nice for yourself today to celebrate this positive mood!",
    "Share your joy with someone you care about - it might make their day too.",
    "Try a 5-minute gratitude journal to keep this positive momentum going.",
    "Plan a fun activity for tomorrow to look forward to.",
    "Take a moment to appreciate how far you've come on your journey."
  ],
  negative: [
    "Try a 5-minute deep breathing exercise to help calm your mind.",
    "Reach out to a trusted friend or family member and let them know how you're feeling.",
    "Take a short walk outside to get some fresh air and clear your head.",
    "Practice self-compassion - speak to yourself as you would to a good friend.",
    "Write down three things that went well today, no matter how small."
  ],
  distress: [
    "Call a crisis hotline right away - you are not alone.",
    "Go to the nearest emergency room or call emergency services if you feel unsafe.",
    "Reach out to a mental health professional immediately for urgent support.",
    "Contact a trusted friend or family member and stay with them until you feel safe.",
    "Call your local emergency number or a suicide prevention hotline right now."
  ]
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

// Check if text is negated before a keyword
function isNegated(text: string, keywordIndex: number): boolean {
  const wordsBefore = text.substring(0, keywordIndex).toLowerCase().split(/\s+/);
  for (const negation of negationWords) {
    if (wordsBefore.slice(-5).includes(negation.toLowerCase())) {
      return true;
    }
  }
  return false;
}

// Calculate weighted scores
function calculateScores(text: string): { positiveScore: number; negativeScore: number; distressScore: number } {
  const lowerText = text.toLowerCase();
  let positiveScore = 0;
  let negativeScore = 0;
  let distressScore = 0;

  // Calculate distress score (highest priority)
  for (const keyword of distressKeywords) {
    let index = lowerText.indexOf(keyword.word.toLowerCase());
    while (index !== -1) {
      const negated = isNegated(text, index);
      if (!negated) {
        distressScore += keyword.weight;
      }
      index = lowerText.indexOf(keyword.word.toLowerCase(), index + 1);
    }
  }

  // Calculate positive score
  for (const keyword of positiveKeywords) {
    let index = lowerText.indexOf(keyword.word.toLowerCase());
    while (index !== -1) {
      const negated = isNegated(text, index);
      if (!negated) {
        positiveScore += keyword.weight;
      } else {
        negativeScore += keyword.weight * 0.5; // Negated positive adds to negative
      }
      index = lowerText.indexOf(keyword.word.toLowerCase(), index + 1);
    }
  }

  // Calculate negative score
  for (const keyword of negativeKeywords) {
    let index = lowerText.indexOf(keyword.word.toLowerCase());
    while (index !== -1) {
      const negated = isNegated(text, index);
      if (!negated) {
        negativeScore += keyword.weight;
      } else {
        positiveScore += keyword.weight * 0.5; // Negated negative adds to positive
      }
      index = lowerText.indexOf(keyword.word.toLowerCase(), index + 1);
    }
  }

  return { positiveScore, negativeScore, distressScore };
}

// Extract key phrases
function extractKeyPhrases(text: string): string[] {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  const phrases: string[] = [];
  
  for (const sentence of sentences) {
    if (sentence.length > 10 && sentence.length < 200) {
      phrases.push(sentence);
    }
  }
  
  if (phrases.length === 0) {
    return sentences.slice(0, 3);
  }
  
  return phrases.slice(0, 4);
}

// Detect emotions
function detectEmotions(text: string, sentiment: Sentiment): string[] {
  const lowerText = text.toLowerCase();
  const emotions: string[] = [];
  
  const emotionMap: Record<string, { words: string[]; label: string }> = {
    joy: { words: ["happy", "joy", "love", "grateful", "thankful", "masaya", "maligaya", "saya", "salamat"], label: "Joy" },
    hope: { words: ["hope", "hopeful", "pag-asa", "may pag-asa"], label: "Hope" },
    anxiety: { words: ["anxious", "worried", "anxiety", "nervous", "nababahala", "pangamba", "kaba"], label: "Anxiety" },
    stress: { words: ["stress", "stressed", "pagod", "pagod na pagod", "exams", "exam", "pagsusulit", "overwhelmed"], label: "Stress" },
    sadness: { words: ["sad", "depressed", "heartbroken", "malungkot", "lungkot", "pighati"], label: "Sadness" },
    calm: { words: ["calm", "peaceful", "relax", "payapa", "mahinahon"], label: "Calm" }
  };
  
  for (const [, data] of Object.entries(emotionMap)) {
    for (const word of data.words) {
      if (lowerText.includes(word.toLowerCase())) {
        if (!emotions.includes(data.label)) {
          emotions.push(data.label);
        }
        break;
      }
    }
  }
  
  if (sentiment === "distress") {
    emotions.unshift("Distress");
  } else if (emotions.length === 0) {
    emotions.push("Calm");
  }
  
  return emotions;
}

// =====================================================
// MAIN ANALYSIS FUNCTION
// =====================================================

export function analyzeEntry(text: string | null, mood: string | null = null): AnalysisResult {
  if (!text || text.trim().length === 0) {
    return {
      sentiment: "positive",
      sentimentScore: 75,
      positivePercentage: 75,
      negativePercentage: 20,
      distressPercentage: 5,
      emotions: ["Calm"],
      keyPhrases: [],
      feedback: "Your entry is empty. Try writing about your day!",
      reflection: "Start with a few sentences about how you're feeling right now.",
      suggestions: ["Take a moment to jot down your thoughts.", "Try using the writing prompt for inspiration."]
    };
  }
  
  let { positiveScore, negativeScore, distressScore } = calculateScores(text);
  
  // Adjust scores based on selected mood
  if (mood) {
    const lowerMood = mood.toLowerCase();
    switch (lowerMood) {
      case "happy":
        positiveScore += 8;
        break;
      case "calm":
        positiveScore += 4;
        break;
      case "excited":
        positiveScore += 6;
        break;
      case "anxious":
        negativeScore += 6;
        break;
      case "sad":
        negativeScore += 8;
        break;
      case "frustrated":
        negativeScore += 7;
        break;
      case "overwhelmed":
        negativeScore += 8;
        break;
    }
  }
  
  // Calculate percentages
  const totalScore = positiveScore + negativeScore + distressScore;
  let positivePercentage: number, negativePercentage: number, distressPercentage: number;
  
  if (totalScore === 0) {
    positivePercentage = 60;
    negativePercentage = 35;
    distressPercentage = 5;
  } else {
    positivePercentage = Math.round((positiveScore / totalScore) * 100);
    negativePercentage = Math.round((negativeScore / totalScore) * 100);
    distressPercentage = Math.round((distressScore / totalScore) * 100);
    // Adjust rounding errors to make total 100%
    const total = positivePercentage + negativePercentage + distressPercentage;
    if (total !== 100) {
      if (total < 100) {
        positivePercentage += 100 - total;
      } else {
        if (positivePercentage > total - 100) {
          positivePercentage -= total - 100;
        } else if (negativePercentage > total - 100) {
          negativePercentage -= total - 100;
        } else {
          distressPercentage -= total - 100;
        }
      }
    }
  }
  
  // Determine sentiment
  let sentiment: Sentiment;
  let sentimentScore: number;
  
  if (distressScore >= 8) {
    sentiment = "distress";
    sentimentScore = Math.max(5, 20 - distressScore);
  } else if (negativeScore > positiveScore) {
    sentiment = "negative";
    const netScore = negativeScore - positiveScore;
    sentimentScore = Math.max(10, 50 - netScore * 3);
  } else if (positiveScore > negativeScore) {
    sentiment = "positive";
    const netScore = positiveScore - negativeScore;
    sentimentScore = Math.min(95, 50 + netScore * 3);
  } else {
    sentiment = "positive"; // Default to positive if tied
    sentimentScore = 60;
  }
  
  // Generate feedback, reflection, suggestions
  const feedback = feedbackTemplates[sentiment][Math.floor(Math.random() * feedbackTemplates[sentiment].length)];
  const reflection = reflectionTemplates[sentiment][Math.floor(Math.random() * reflectionTemplates[sentiment].length)];
  const shuffledSuggestions = [...suggestionTemplates[sentiment]].sort(() => Math.random() - 0.5);
  const suggestions = shuffledSuggestions.slice(0, 3);
  
  return {
    sentiment,
    sentimentScore,
    positivePercentage,
    negativePercentage,
    distressPercentage,
    emotions: detectEmotions(text, sentiment),
    keyPhrases: extractKeyPhrases(text),
    feedback,
    reflection,
    suggestions
  };
}

export const analyzeSentiment = (text: string | null): Sentiment => {
  return analyzeEntry(text).sentiment;
};

export const getSentimentFromMood = (mood: string | null): Sentiment => {
  const positiveMoods = ["Happy", "Calm", "Excited"];
  const negativeMoods = ["Anxious", "Sad", "Frustrated", "Overwhelmed"];
  if (!mood) return "positive";
  if (positiveMoods.includes(mood)) return "positive";
  if (negativeMoods.includes(mood)) return "negative";
  return "positive";
};

export const getMoodCategory = (text: string | null, mood: string | null): MoodCategory => {
  if (mood) {
    const lowerMood = mood.toLowerCase();
    if (lowerMood === "happy") return "happy";
    if (lowerMood === "calm") return "calm";
    if (lowerMood === "excited") return "excited";
    if (lowerMood === "anxious") return "anxious";
    if (lowerMood === "sad") return "sad";
    if (lowerMood === "frustrated") return "frustrated";
    if (lowerMood === "overwhelmed") return "overwhelmed";
  }
  
  if (!text) return "calm";
  const lowerText = text.toLowerCase();
  
  const moodPriority: { key: MoodCategory; words: string[] }[] = [
    { key: "overwhelmed", words: ["overwhelmed", "napakapagod", "hirap na hirap", "sobrang bigat", "pagod na pagod"] },
    { key: "frustrated", words: ["frustrated", "angry", "galit", "inis", "nagagalit", "naiinis"] },
    { key: "sad", words: ["sad", "depressed", "malungkot", "lungkot", "pighati"] },
    { key: "anxious", words: ["anxious", "worried", "nababahala", "pangamba", "kaba"] },
    { key: "excited", words: ["excited", "sabik", "tuwang-tuwa", "napakasigla"] },
    { key: "happy", words: ["happy", "joy", "masaya", "maligaya", "saya"] },
    { key: "calm", words: ["calm", "peaceful", "payapa", "mahinahon"] }
  ];
  
  for (const { key, words } of moodPriority) {
    for (const word of words) {
      if (lowerText.includes(word.toLowerCase())) return key;
    }
  }
  
  return "calm";
};

// =====================================================
// MOOD TREND DETECTION
// =====================================================

export interface JournalEntry {
  id: string;
  content: string | null;
  mood: string | null;
  created_at: string;
}

export interface MoodTrendResult {
  overall: "improving" | "declining" | "stable";
  mostCommonMood: MoodCategory;
  averageSentiment: number;
  weeklyChange: number;
}

export interface NegativeTrendResult {
  hasNegativeTrend: boolean;
  negativeCount: number;
  totalCount: number;
}

export const checkNegativeTrend = (
  entries: JournalEntry[],
  threshold: number,
  minEntries: number,
  maxEntries: number
): NegativeTrendResult => {
  if (entries.length < minEntries) {
    return { hasNegativeTrend: false, negativeCount: 0, totalCount: entries.length };
  }

  const entriesToCheck = entries.slice(0, maxEntries);
  let negativeCount = 0;

  for (const entry of entriesToCheck) {
    const sentiment = analyzeSentiment(entry.content);
    if (sentiment === "negative" || sentiment === "distress") {
      negativeCount++;
    }
  }

  const negativeRatio = negativeCount / entriesToCheck.length;
  const hasNegativeTrend = negativeRatio >= threshold;

  return {
    hasNegativeTrend,
    negativeCount,
    totalCount: entriesToCheck.length
  };
};

export const analyzeMoodTrend = (entries: JournalEntry[]): MoodTrendResult => {
  if (entries.length === 0) {
    return {
      overall: "stable",
      mostCommonMood: "calm",
      averageSentiment: 1,
      weeklyChange: 0
    };
  }
  
  const sorted = [...entries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  const scores = sorted.map(entry => {
    const sentiment = analyzeSentiment(entry.content);
    if (sentiment === "distress") return -1;
    if (sentiment === "positive") return 1;
    return 0;
  }) as number[];
  
  const moods = sorted.map(entry => getMoodCategory(entry.content, entry.mood));
  const moodCounts = moods.reduce((acc, mood) => {
    acc[mood] = (acc[mood] || 0) + 1;
    return acc;
  }, {} as Record<MoodCategory, number>);
  
  const mostCommonMood = Object.keys(moodCounts).reduce(
    (a, b) => (moodCounts[a as MoodCategory] > moodCounts[b as MoodCategory] ? a : b),
    "calm"
  ) as MoodCategory;
  
  const averageSentiment = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  let weeklyChange = 0;
  if (scores.length >= 2) {
    const mid = Math.floor(scores.length / 2);
    const firstHalf = scores.slice(0, mid);
    const secondHalf = scores.slice(mid);
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    weeklyChange = secondAvg - firstAvg;
  }
  
  let overall: "improving" | "declining" | "stable" = "stable";
  if (weeklyChange > 0.2) overall = "improving";
  if (weeklyChange < -0.2) overall = "declining";
  
  return {
    overall,
    mostCommonMood,
    averageSentiment,
    weeklyChange
  };
};

// Quick test function
export function runTests() {
  const testEntries = [
    "Another day, may pagsubok ulit but kakayanin natin to",
    "Gusto ko na mamatay",
    "So ito na masaya ako umuwi ngayon dahil nahatid ko na frustra natin",
    "Bakit kaya ang unfair ng mundo"
  ];

  for (const entry of testEntries) {
    console.log("\n=== Testing entry ===");
    console.log(entry);
    const analysis = analyzeEntry(entry);
    console.log("Analysis:", JSON.stringify(analysis, null, 2));
  }
}

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runTests();
}
if (typeof process !== 'undefined' && process.argv[1] === __filename) {
  runTests();
}
