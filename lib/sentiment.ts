export type Sentiment = "positive" | "negative" | "distress";
export type MoodCategory = 
  | "happy" 
  | "calm" 
  | "excited" 
  | "anxious" 
  | "sad" 
  | "frustrated" 
  | "overwhelmed";

// =====================================================
// KEYWORD DATABASES (English + Tagalog/Taglish)
// =====================================================

// 1. Distress Keywords (most severe - highest priority)
const distressKeywords = {
  english: [
    "suicide", "kill myself", "end it all", "can't go on", "no reason to live",
    "i want to die", "life is meaningless", "what's the point", "give up",
    "want to end my life", "don't want to live", "ready to die",
    "better off dead", "wish i was dead", "i'm better off dead",
    "i can't do this anymore", "i'm done", "no way out", "trapped",
    "self harm", "cut myself", "hurt myself", "harm myself"
  ],
  tagalog: [
    "magpakamatay", "mamatay na lang ako", "gusto ko nang mamatay",
    "gusto ko nang magpakamatay", "gusto ko nang matapos ang lahat",
    "gusto ko nang tapusin ang lahat", "gusto ko nang maglaho",
    "gusto ko nang mawala", "walang rason para mabuhay",
    "hindi ko na kaya", "tapos na", "wala ng pag-asa",
    "sugatan ko ang sarili ko", "saktan ko ang sarili ko"
  ]
};

// 2. Mood-Specific Keyword Sets
const moodKeywords = {
  happy: {
    english: [
      "happy", "joy", "love", "grateful", "thankful", "excited", "peaceful",
      "calm", "content", "blessed", "hopeful", "optimistic", "proud", "accomplished",
      "great", "wonderful", "amazing", "fantastic", "beautiful", "cheerful", "delighted",
      "pleased", "glad", "thrilled", "elated", "blissful", "radiant", "vibrant",
      "fortunate", "lucky", "joyful", "merry", "jovial", "jolly",
      "enthusiastic", "eager", "keen", "inspired", "motivated", "determined",
      "confident", "brave", "courageous", "strong", "powerful", "victorious",
      "triumphant", "successful", "prosperous", "thriving", "flourishing",
      "kind", "compassionate", "caring", "gentle", "loving", "affectionate",
      "warm", "friendly", "sociable", "outgoing", "funny", "humorous", "witty",
      "charming", "delightful", "enchanting", "fascinating", "interesting",
      "engaging", "stimulating", "exciting", "thrilling", "exhilarating",
      "refreshing", "rejuvenating", "revitalizing", "restful", "relaxing",
      "soothing", "calming", "tranquil", "serene", "quiet",
      "satisfied", "fulfilled", "contented", "gratified", "pleased",
      "amazed", "astonished", "astounded", "surprised", "impressed",
      "admiring", "respectful", "appreciative", "grateful", "thankful",
      "generous", "giving", "helpful", "supportive", "encouraging",
      "uplifting", "inspiring", "motivating", "empowering", "strengthening",
      "positive", "good", "excellent", "superb", "outstanding", "exceptional",
      "magnificent", "splendid", "grand", "impressive", "remarkable",
      "memorable", "unforgettable", "special", "precious", "treasured",
      "cherished", "loved", "adored", "worshipped", "idolized",
      "valued", "esteemed", "respected", "honored", "recognized",
      "appreciated", "celebrated", "praised", "commended", "acclaimed",
      "nangyari", "nagkasama", "nagkita", "kasama", "nag-usap",
      "naglaro", "nagkain", "naglakad", "nagbasa", "nag-aral",
      "nakasama", "kasama ko", "kasama namin", "kasama tayo"
    ],
    tagalog: [
      "masaya", "maligaya", "pag-asa", "saya", "salamat", "maganda",
      "maginhawa", "masipag", "matagumpay", "mapagmahal", "matiyaga",
      "malakas", "matalino", "nakakatuwa", "nakakagalak", "may pag-asa",
      "magandang buhay", "masigla", "masayahin", "maligayang",
      "pinagpala", "mapalad", "swerte", "masaya ang puso",
      "kuntento", "saya ng araw", "magandang araw", "magandang gabi",
      "nakakamangha", "nakakabilib", "impressive", "ang galing",
      "ang husay", "ang talino", "ang bait",
      "ang sarap", "ang saya", "ang swerte", "ang pogi",
      "ang ganda", "ang cute", "ang sweet", "ang kind",
      "ang generous", "ang helpful", "ang supportive", "ang encouraging",
      "nakakagaan ng loob", "nakakapagpaginhawa", "nakakapagpasaya",
      "nakakapagbigay ng pag-asa", "nakakapagpaganda ng araw",
      "salamat po", "maraming salamat", "salamat sa lahat",
      "may pag-asa pa", "kaya natin to", "laban lang",
      "tiwala lang", "kayang kaya", "masaya ako",
      "masaya kami", "masaya tayo", "masaya silang lahat",
      "ang saya saya", "sobrang saya", "napakasaya",
      "napaka ganda", "napaka bait", "napaka husay",
      "napaka talino", "napaka malakas", "napaka matapang",
      "napaka matiyaga", "napaka masipag", "napaka mapagmahal",
      "ang bait mo", "ang ganda mo", "ang talino mo",
      "ang husay mo", "ang malakas mo", "ang matapang mo",
      "ang matiyaga mo", "ang masipag mo", "ang mapagmahal mo"
    ]
  },
  calm: {
    english: ["calm", "peaceful", "relax", "relaxed", "serene", "tranquil", "quiet", "still"],
    tagalog: ["payapa", "mahinahon", "nakakapagpahinga"]
  },
  excited: {
    english: ["excited", "exciting", "thrilled", "thrilling", "exhilarated", "energized"],
    tagalog: ["sabik", "tuwang-tuwa", "napakasigla"]
  },
  anxious: {
    english: ["anxious", "worried", "anxiety", "nervous", "tense", "on edge"],
    tagalog: ["nababahala", "pangamba", "kaba", "lito"]
  },
  sad: {
    english: ["sad", "depressed", "heartbroken", "sorrowful", "melancholy", "dejected"],
    tagalog: ["malungkot", "lungkot", "pighati", "sawing-palad"]
  },
  frustrated: {
    english: ["frustrated", "angry", "frustration", "irritated", "annoyed", "exasperated"],
    tagalog: ["galit", "inis", "nagagalit", "naiinis"]
  },
  overwhelmed: {
    english: ["overwhelmed", "overwhelming", "swamped", "burdened", "exhausted"],
    tagalog: ["napakapagod", "hirap na hirap", "sobrang bigat"]
  }
};

// General negative keywords (broad)
const negativeKeywords = {
  english: [
    "sad", "depressed", "anxious", "worried", "stressed", "overwhelmed",
    "angry", "frustrated", "hopeless", "worthless", "empty", "lonely",
    "afraid", "scared", "tired", "exhausted", "painful", "hurt", "suffer",
    "sadness", "sorrow", "grief", "heartache", "heartbreak", "anguish",
    "misery", "despair", "desperation", "hopelessness", "despondency",
    "melancholy", "gloom", "glumness", "dejection", "depression",
    "anxiety", "worry", "concern", "apprehension", "fear", "dread",
    "panic", "terror", "horror", "fright", "scare", "alarm",
    "stress", "tension", "pressure", "strain", "burden", "load",
    "anger", "rage", "fury", "wrath", "irritation", "annoyance",
    "frustration", "exasperation", "vexation", "irritability",
    "hatred", "dislike", "disgust", "contempt", "scorn", "disdain",
    "loathing", "abhorrence", "detestation", "revulsion",
    "worthlessness", "uselessness", "pointlessness", "futility",
    "emptiness", "vacancy", "void", "hollowness", "loneliness",
    "isolation", "solitude", "seclusion", "withdrawal", "rejection",
    "abandonment", "neglect", "ignore", "ignored", "forgotten",
    "unloved", "unwanted", "unappreciated", "undervalued",
    "insignificant", "unimportant", "meaningless", "purposeless",
    "failed", "failure", "defeat", "loss", "lose", "lost",
    "disappointed", "disappointment", "let down", "betrayed",
    "betrayal", "trust broken", "broken trust", "hurtful",
    "painful", "suffering", "torment", "agony", "torture",
    "anguish", "wretchedness", "misery", "sorrow", "grief",
    "heartbroken", "broken heart", "heart ache", "cry",
    "crying", "tears", "tearful", "weep", "weeping",
    "sob", "sobbing", "wail", "wailing", "bawl", "bawling"
  ],
  tagalog: [
    "malungkot", "nababahala", "pagod", "hirap", "takot", "sakit",
    "walang pag-asa", "lungkot", "pighati", "pangamba", "kaba",
    "galit", "inis", "kapos sa hininga", "ayoko na",
    "wala nang kwenta", "patay na ako", "lungkot ko",
    "ang lungkot", "sobrang lungkot", "napakalungkot",
    "walang gana", "walang energy", "walang motivation",
    "walang pag-asa", "walang kwenta", "walang silbi",
    "hindi ko kaya", "hindi namin kaya", "hindi nila kaya",
    "hindi ako kaya", "hindi ko na kaya", "hindi na namin kaya",
    "hindi na nila kaya", "hindi na ako kaya", "ayoko na",
    "ayaw ko na", "tamad ako", "tinamad ako",
    "pagod na pagod", "sobrang pagod", "napakapagod",
    "hirap na hirap", "sobrang hirap", "napakahirap",
    "takot na takot", "sobrang takot", "napakatakot",
    "sakit na sakit", "sobrang sakit", "napakasakit",
    "galit na galit", "sobrang galit", "napakagalit",
    "inis na inis", "sobrang inis", "napakainis",
    "lungkot na lungkot", "sobrang lungkot", "napakalungkot",
    "hindi ko gusto", "ayaw ko", "hindi namin gusto",
    "ayaw namin", "hindi nila gusto", "ayaw nila",
    "hindi ako gusto", "ayaw ako", "hindi ako gusto ng tao",
    "walang may gusto sa akin", "walang nagmamahal sa akin",
    "walang nagmamalasakit sa akin", "walang nakakaintindi sa akin",
    "wala akong karamay", "wala akong kaibigan", "wala akong kasama",
    "mag-isa lang ako", "nag-iisa lang ako", "nag-iisa ako",
    "malungkot ako", "malungkot kami", "malungkot tayo",
    "malungkot silang lahat", "ang lungkot ko", "ang lungkot namin",
    "ang lungkot tayo", "ang lungkot silang lahat", "sakit ng ulo",
    "sakit ng tiyan", "sakit ng katawan", "sakit ng puso",
    "broken heart", "heart broken", "nasasaktan", "nasasaktan ako",
    "nasasaktan kami", "nasasaktan tayo", "nasasaktan silang lahat",
    "hindi ako masaya", "hindi kami masaya", "hindi tayo masaya",
    "hindi silang lahat masaya", "wala akong ginawa kundi magmahal",
    "pero niloko lang ako", "iniwan lang ako", "pinagpalit lang ako",
    "hindi ako sapat", "hindi ako enough", "hindi ako worth it",
    "wala akong kwenta", "walang silbi ako", "hindi ako importante",
    "hindi ako mahalaga", "hindi ako pinapansin", "hindi ako pinapahalagahan",
    "hindi ako pinahahalagahan", "hindi ako pinapakinggan", "hindi ako naiintindihan",
    "hindi ako maintindihan", "hindi ako matanggap", "hindi ako tanggap",
    "hindi ako tanggap ng lipunan", "hindi ako tanggap ng pamilya",
    "hindi ako tanggap ng mga kaibigan", "hindi ako tanggap ng kahit sino",
    "gusto ko nang umalis", "gusto ko nang umalis dito",
    "gusto ko nang lumayo", "gusto ko nang magtago", "gusto ko nang maglaho na parang bula"
  ]
};

// =====================================================
// CORE ANALYSIS FUNCTIONS
// =====================================================

export const analyzeSentiment = (text: string | null): Sentiment => {
  if (!text) return "positive";

  const lowerText = text.toLowerCase();
  
  // 1. Distress Check (highest priority)
  const allDistress = [...distressKeywords.english, ...distressKeywords.tagalog];
  for (const word of allDistress) {
    if (lowerText.includes(word)) return "distress";
  }

  // 2. Count general sentiment keywords
  let positiveCount = 0;
  let negativeCount = 0;
  
  // Count from mood keywords (happy/calm/excited count as positive)
  const posMoodWords = [
    ...moodKeywords.happy.english,
    ...moodKeywords.happy.tagalog,
    ...moodKeywords.calm.english,
    ...moodKeywords.calm.tagalog,
    ...moodKeywords.excited.english,
    ...moodKeywords.excited.tagalog
  ];
  
  for (const word of posMoodWords) {
    if (lowerText.includes(word)) positiveCount++;
  }
  
  for (const word of negativeKeywords.english) {
    if (lowerText.includes(word)) negativeCount++;
  }
  for (const word of negativeKeywords.tagalog) {
    if (lowerText.includes(word)) negativeCount++;
  }

  if (negativeCount > positiveCount) return "negative";
  if (positiveCount > negativeCount) return "positive";
  return "positive"; // Default to positive
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
  // 1. If user selected a mood, use that first
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
  
  // 2. Check each mood's keywords in priority order
  const moodPriority: { key: MoodCategory; words: string[] }[] = [
    { key: "overwhelmed", words: [...moodKeywords.overwhelmed.english, ...moodKeywords.overwhelmed.tagalog] },
    { key: "frustrated", words: [...moodKeywords.frustrated.english, ...moodKeywords.frustrated.tagalog] },
    { key: "sad", words: [...moodKeywords.sad.english, ...moodKeywords.sad.tagalog] },
    { key: "anxious", words: [...moodKeywords.anxious.english, ...moodKeywords.anxious.tagalog] },
    { key: "excited", words: [...moodKeywords.excited.english, ...moodKeywords.excited.tagalog] },
    { key: "happy", words: [...moodKeywords.happy.english, ...moodKeywords.happy.tagalog] },
    { key: "calm", words: [...moodKeywords.calm.english, ...moodKeywords.calm.tagalog] }
  ];
  
  for (const { key, words } of moodPriority) {
    for (const word of words) {
      if (lowerText.includes(word)) return key;
    }
  }
  
  return "calm"; // Default to calm
};

// =====================================================
// MOOD TREND DETECTION OVER TIME
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
  averageSentiment: number; // 1 = positive, 0 = negative
  weeklyChange: number; // positive = improving, negative = declining
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
  
  // Sort by date (oldest to newest)
  const sorted = [...entries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  // Calculate sentiment scores (1 for positive/calm/excited, 0 for negative, -1 for distress)
  const scores = sorted.map(entry => {
    const sentiment = analyzeSentiment(entry.content);
    if (sentiment === "distress") return -1;
    if (sentiment === "positive") return 1;
    return 0;
  }) as number[];
  
  // Get mood categories
  const moods = sorted.map(entry => getMoodCategory(entry.content, entry.mood));
  const moodCounts = moods.reduce((acc, mood) => {
    acc[mood] = (acc[mood] || 0) + 1;
    return acc;
  }, {} as Record<MoodCategory, number>);
  
  const mostCommonMood = Object.keys(moodCounts).reduce(
    (a, b) => (moodCounts[a as MoodCategory] > moodCounts[b as MoodCategory] ? a : b),
    "calm"
  ) as MoodCategory;
  
  // Average sentiment
  const averageSentiment = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  // Weekly change (compare first half to second half)
  let weeklyChange = 0;
  if (scores.length >= 2) {
    const mid = Math.floor(scores.length / 2);
    const firstHalf = scores.slice(0, mid);
    const secondHalf = scores.slice(mid);
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    weeklyChange = secondAvg - firstAvg;
  }
  
  // Determine overall trend
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
