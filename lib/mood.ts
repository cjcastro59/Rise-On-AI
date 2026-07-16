// Single source of truth for turning a mood label into a 1-5 score and an
// emoji, shared by every widget that visualizes mood_logs / journal_entries
// mood data (Dashboard, Mood Insights) so they never compute divergent values.
export interface MoodOption {
  label: string;
  emoji: string;
  score: number; // 1 (lowest) - 5 (highest)
}

export const MOOD_OPTIONS: MoodOption[] = [
  { label: "Happy", emoji: "😊", score: 5 },
  { label: "Excited", emoji: "🎉", score: 5 },
  { label: "Calm", emoji: "😌", score: 4 },
  { label: "Confused", emoji: "😕", score: 3 },
  { label: "Frustrated", emoji: "😤", score: 2 },
  { label: "Anxious", emoji: "😰", score: 2 },
  { label: "Sad", emoji: "😢", score: 1 },
  { label: "Overwhelmed", emoji: "😵", score: 1 },
];

const SCORE_BY_LABEL = new Map(MOOD_OPTIONS.map((m) => [m.label.toLowerCase(), m.score]));
const EMOJI_BY_LABEL = new Map(MOOD_OPTIONS.map((m) => [m.label.toLowerCase(), m.emoji]));

// mood_logs.score is stored directly; journal_entries only has a mood label,
// so it's resolved through MOOD_OPTIONS. Unknown/missing moods return null
// rather than guessing, so callers can render a gap instead of fake data.
export function getMoodScore(mood: string | null | undefined): number | null {
  if (!mood) return null;
  const known = SCORE_BY_LABEL.get(mood.toLowerCase());
  return known ?? null;
}

export function clampScore(score: number | null | undefined): number | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  return Math.min(5, Math.max(1, score));
}

export function getMoodEmoji(mood: string | null | undefined): string {
  if (!mood) return "🙂";
  return EMOJI_BY_LABEL.get(mood.toLowerCase()) ?? "🙂";
}

// Local (not UTC) calendar-day / calendar-month keys, shared by every mood
// aggregation query so records are always bucketed the same way.
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
