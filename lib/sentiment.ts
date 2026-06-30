export type Sentiment = "positive" | "neutral" | "negative";

// Keyword-based sentiment analysis
export const analyzeSentiment = (text: string | null): Sentiment => {
  if (!text) return "neutral";

  const positiveKeywords = [
    "happy", "joy", "love", "grateful", "thankful", "excited", "peaceful",
    "calm", "content", "blessed", "hopeful", "optimistic", "proud", "accomplished",
    "great", "wonderful", "amazing", "fantastic", "beautiful", "cheerful", "delighted",
    "pleased", "glad", "thrilled", "elated", "blissful", "radiant", "vibrant",
    "masaya", "maligaya", "pag-asa", "saya", "salamat", "maganda", "maginhawa",
    "masipag", "matagumpay", "mapagmahal", "matiyaga", "malakas", "matalino",
    "nakakatuwa", "nakakagalak", "may pag-asa", "magandang buhay"
  ];

  const negativeKeywords = [
    "sad", "depressed", "anxious", "worried", "stressed", "overwhelmed",
    "angry", "frustrated", "hopeless", "worthless", "empty", "lonely",
    "afraid", "scared", "tired", "exhausted", "painful", "hurt", "suffer",
    "suicide", "kill myself", "end it all", "can't go on", "no reason to live",
    "i want to die", "life is meaningless", "what's the point", "give up",
    "malungkot", "nababahala", "pagod", "hirap", "takot", "sakit", "walang pag-asa",
    "lungkot", "pighati", "pangamba", "kaba", "galit", "inis", "kapos sa hininga",
    "hindi na kaya", "ayoko na", "wala nang kwenta", "patay na ako", "magpakamatay",
    "lungkot ko", "ang lungkot" // Add the specific phrase user used!
  ];

  const lowerText = text.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of positiveKeywords) {
    if (lowerText.includes(word)) positiveCount++;
  }
  for (const word of negativeKeywords) {
    if (lowerText.includes(word)) negativeCount++;
  }

  if (negativeCount > positiveCount) return "negative";
  if (positiveCount > negativeCount) return "positive";
  return "neutral";
};

// Mood-based sentiment (since we have mood field)
export const getSentimentFromMood = (mood: string | null): Sentiment => {
  const positiveMoods = ["Happy", "Calm", "Excited"];
  const negativeMoods = ["Anxious", "Sad", "Frustrated", "Overwhelmed"];
  if (!mood) return "neutral";
  if (positiveMoods.includes(mood)) return "positive";
  if (negativeMoods.includes(mood)) return "negative";
  return "neutral";
};

// Check for negative trend (last N entries)
export const checkNegativeTrend = (
  entries: Array<{ content: string | null; mood: string | null }>,
  threshold: number = 0.5, // 50% or more negative
  minEntries: number = 5, // At least 5 entries
  lookback: number = 10 // Last 10 entries
): { hasNegativeTrend: boolean; negativeCount: number; totalCount: number } => {
  const recentEntries = entries.slice(0, lookback);
  
  if (recentEntries.length < minEntries) {
    return { hasNegativeTrend: false, negativeCount: 0, totalCount: recentEntries.length };
  }

  let negativeCount = 0;
  
  for (const entry of recentEntries) {
    // First analyze text content
    let sentiment = analyzeSentiment(entry.content);
    // If text is neutral, check mood
    if (sentiment === "neutral" && entry.mood) {
      sentiment = getSentimentFromMood(entry.mood);
    }
    
    if (sentiment === "negative") {
      negativeCount++;
    }
  }

  const hasNegativeTrend = negativeCount / recentEntries.length >= threshold;
  
  return {
    hasNegativeTrend,
    negativeCount,
    totalCount: recentEntries.length
  };
};
