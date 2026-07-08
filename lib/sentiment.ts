export type Sentiment = "positive" | "neutral" | "negative";

// Keyword-based sentiment analysis
export const analyzeSentiment = (text: string | null): Sentiment => {
  if (!text) return "neutral";

  const positiveKeywords = [
    // English positive words
    "happy", "joy", "love", "grateful", "thankful", "excited", "peaceful",
    "calm", "content", "blessed", "hopeful", "optimistic", "proud", "accomplished",
    "great", "wonderful", "amazing", "fantastic", "beautiful", "cheerful", "delighted",
    "pleased", "glad", "thrilled", "elated", "blissful", "radiant", "vibrant",
    "blessed", "fortunate", "lucky", "joyful", "merry", "jovial", "jolly",
    "enthusiastic", "eager", "keen", "inspired", "motivated", "determined",
    "confident", "brave", "courageous", "strong", "powerful", "victorious",
    "triumphant", "successful", "prosperous", "thriving", "flourishing",
    "kind", "compassionate", "caring", "gentle", "loving", "affectionate",
    "warm", "friendly", "sociable", "outgoing", "funny", "humorous", "witty",
    "charming", "delightful", "enchanting", "fascinating", "interesting",
    "engaging", "stimulating", "exciting", "thrilling", "exhilarating",
    "refreshing", "rejuvenating", "revitalizing", "restful", "relaxing",
    "soothing", "calming", "tranquil", "serene", "quiet", "peaceful",
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
    
    // Tagalog/Taglish positive words
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
  ];

  const negativeKeywords = [
    // English negative words
    "sad", "depressed", "anxious", "worried", "stressed", "overwhelmed",
    "angry", "frustrated", "hopeless", "worthless", "empty", "lonely",
    "afraid", "scared", "tired", "exhausted", "painful", "hurt", "suffer",
    "suicide", "kill myself", "end it all", "can't go on", "no reason to live",
    "i want to die", "life is meaningless", "what's the point", "give up",
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
    "sob", "sobbing", "wail", "wailing", "bawl", "bawling",
    
    // Tagalog/Taglish negative words
    "malungkot", "nababahala", "pagod", "hirap", "takot", "sakit",
    "walang pag-asa", "lungkot", "pighati", "pangamba", "kaba",
    "galit", "inis", "kapos sa hininga", "hindi na kaya", "ayoko na",
    "wala nang kwenta", "patay na ako", "magpakamatay", "lungkot ko",
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
    "magpakamatay na lang ako", "mamatay na lang ako", "gusto ko nang mamatay",
    "gusto ko nang magpakamatay", "gusto ko nang matapos ang lahat",
    "gusto ko nang tapusin ang lahat", "gusto ko nang maglaho",
    "gusto ko nang mawala", "gusto ko nang umalis", "gusto ko nang umalis dito",
    "gusto ko nang lumayo", "gusto ko nang magtago", "gusto ko nang maglaho na parang bula"
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
