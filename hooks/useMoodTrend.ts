"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getMoodScore, clampScore, getMoodEmoji, toDateKey, toMonthKey } from "@/lib/mood";

export type MoodTrendRange = "Week" | "Month" | "3 Months" | "All Time";

export interface MoodTrendPoint {
  key: string;
  date: string; // X-axis tick label
  tooltipLabel: string; // full label for the tooltip's date line
  score: number | null; // 1-5 average, null = no entries in this bucket
  mood: string | null; // representative mood label for the tooltip
  emoji: string;
  count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// This app's week runs Saturday -> Friday. Returns the most recent Saturday
// on/before `now`, at local midnight.
function getWeekStart(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const daysSinceSaturday = (start.getDay() + 1) % 7; // Sun=0..Sat=6 -> offset from Sat
  start.setDate(start.getDate() - daysSinceSaturday);
  return start;
}

interface ScoredRecord {
  date: Date;
  mood: string | null;
  score: number;
}

async function fetchScoredRecords(supabase: any, userId: string, start: Date, endExclusive: Date): Promise<ScoredRecord[]> {
  const [{ data: moodLogRows, error: moodLogError }, { data: journalRows, error: journalError }] = await Promise.all([
    supabase
      .from("mood_logs")
      .select("mood, score, created_at")
      .eq("user_id", userId)
      .gte("created_at", start.toISOString())
      .lt("created_at", endExclusive.toISOString()),
    supabase
      .from("journal_entries")
      .select("mood, created_at")
      .eq("user_id", userId)
      .gte("created_at", start.toISOString())
      .lt("created_at", endExclusive.toISOString()),
  ]);

  if (moodLogError) console.error("useMoodTrend mood_logs error:", moodLogError);
  if (journalError) console.error("useMoodTrend journal_entries error:", journalError);

  // mood_logs.score is authoritative when present; journal_entries only has
  // a mood label, resolved to a score via the shared mood map.
  const records: ScoredRecord[] = [];
  (moodLogRows || []).forEach((row: { mood: string | null; score: number | null; created_at: string }) => {
    const score = clampScore(row.score) ?? getMoodScore(row.mood);
    if (score === null) return;
    records.push({ date: new Date(row.created_at), mood: row.mood, score });
  });
  (journalRows || []).forEach((row: { mood: string | null; created_at: string }) => {
    const score = getMoodScore(row.mood);
    if (score === null) return;
    records.push({ date: new Date(row.created_at), mood: row.mood, score });
  });
  return records;
}

// "All Time" has no natural start bound, so find the earliest record instead
// of downloading the whole table just to discover its range.
async function fetchEarliestDate(supabase: any, userId: string): Promise<Date | null> {
  const [{ data: earliestMoodLog }, { data: earliestJournal }] = await Promise.all([
    supabase.from("mood_logs").select("created_at").eq("user_id", userId).order("created_at", { ascending: true }).limit(1),
    supabase.from("journal_entries").select("created_at").eq("user_id", userId).order("created_at", { ascending: true }).limit(1),
  ]);
  const candidates: Date[] = [];
  if (earliestMoodLog?.[0]?.created_at) candidates.push(new Date(earliestMoodLog[0].created_at));
  if (earliestJournal?.[0]?.created_at) candidates.push(new Date(earliestJournal[0].created_at));
  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates.map((d) => d.getTime())));
}

function summarizeBucket(entries: { mood: string | null; score: number }[]) {
  if (entries.length === 0) return { score: null as number | null, mood: null as string | null };
  const total = entries.reduce((sum, e) => sum + e.score, 0);
  const avg = Math.round((total / entries.length) * 10) / 10;
  const representative = entries.reduce((closest, e) => (Math.abs(e.score - avg) < Math.abs(closest.score - avg) ? e : closest));
  return { score: avg, mood: representative.mood };
}

function groupBy(records: ScoredRecord[], keyFn: (d: Date) => string) {
  const map = new Map<string, { mood: string | null; score: number }[]>();
  records.forEach((r) => {
    const key = keyFn(r.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({ mood: r.mood, score: r.score });
  });
  return map;
}

export function useMoodTrend(range: MoodTrendRange) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient() as any, []);
  const [data, setData] = useState<MoodTrendPoint[]>([]);
  const [ticks, setTicks] = useState<string[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const fetchTrend = useCallback(async () => {
    if (!user) {
      setData([]);
      setTicks(undefined);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const now = new Date();

      if (range === "Week") {
        // Fixed Saturday -> Friday week. Always emits exactly 7 points, in
        // order, regardless of data — missing days get score: null rather
        // than being dropped from the array.
        const start = getWeekStart(now);
        const endExclusive = new Date(start.getTime() + 7 * DAY_MS);
        const records = await fetchScoredRecords(supabase, user.id, start, endExclusive);
        const byDay = groupBy(records, toDateKey);

        const points: MoodTrendPoint[] = [];
        for (let i = 0; i < 7; i++) {
          const day = new Date(start.getTime() + i * DAY_MS);
          const key = toDateKey(day);
          const bucket = byDay.get(key) || [];
          const { score, mood } = summarizeBucket(bucket);
          points.push({
            key,
            date: day.toLocaleDateString("en-US", { weekday: "short" }),
            tooltipLabel: day.toLocaleDateString("en-US", { weekday: "long" }),
            score,
            mood,
            emoji: getMoodEmoji(mood),
            count: bucket.length,
          });
        }
        setData(points);
        setTicks(undefined); // always show all 7 weekday ticks
      } else if (range === "Month") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const records = await fetchScoredRecords(supabase, user.id, start, endExclusive);
        const byDay = groupBy(records, toDateKey);
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        const points: MoodTrendPoint[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const day = new Date(now.getFullYear(), now.getMonth(), d);
          const key = toDateKey(day);
          const bucket = byDay.get(key) || [];
          const { score, mood } = summarizeBucket(bucket);
          points.push({
            key,
            date: String(d),
            tooltipLabel: day.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
            score,
            mood,
            emoji: getMoodEmoji(mood),
            count: bucket.length,
          });
        }
        setData(points);
        const candidates = [1, 5, 10, 15, 20, 25, daysInMonth];
        setTicks(Array.from(new Set(candidates.filter((n) => n >= 1 && n <= daysInMonth))).map(String));
      } else if (range === "3 Months") {
        // Daily buckets for a smooth trend line, sparse month-boundary ticks
        // ("May", "Jun", "Jul") so the X-axis stays readable.
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const records = await fetchScoredRecords(supabase, user.id, start, endExclusive);
        const byDay = groupBy(records, toDateKey);
        const totalDays = Math.round((endExclusive.getTime() - start.getTime()) / DAY_MS);

        const points: MoodTrendPoint[] = [];
        const monthTicks: string[] = [];
        for (let i = 0; i < totalDays; i++) {
          const day = new Date(start.getTime() + i * DAY_MS);
          const key = toDateKey(day);
          const bucket = byDay.get(key) || [];
          const { score, mood } = summarizeBucket(bucket);
          const label = day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          points.push({
            key,
            date: label,
            tooltipLabel: day.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
            score,
            mood,
            emoji: getMoodEmoji(mood),
            count: bucket.length,
          });
          if (day.getDate() === 1 || i === 0) monthTicks.push(label);
        }
        setData(points);
        setTicks(monthTicks);
      } else {
        // All Time: one point per calendar month from the earliest record.
        const earliest = await fetchEarliestDate(supabase, user.id);
        if (!earliest) {
          setData([]);
          setTicks(undefined);
          setLoading(false);
          return;
        }
        const start = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
        const endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const records = await fetchScoredRecords(supabase, user.id, start, endExclusive);
        const byMonth = groupBy(records, toMonthKey);
        const spansMultipleYears = start.getFullYear() !== now.getFullYear();

        const points: MoodTrendPoint[] = [];
        let cursor = new Date(start);
        while (cursor.getTime() < endExclusive.getTime()) {
          const key = toMonthKey(cursor);
          const bucket = byMonth.get(key) || [];
          const { score, mood } = summarizeBucket(bucket);
          points.push({
            key,
            date: cursor.toLocaleDateString("en-US", { month: "short" }) + (spansMultipleYears ? ` '${String(cursor.getFullYear()).slice(2)}` : ""),
            tooltipLabel: cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
            score,
            mood,
            emoji: getMoodEmoji(mood),
            count: bucket.length,
          });
          cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        }
        setData(points);
        setTicks(undefined); // monthly points are already sparse; show them all
      }
    } catch (error) {
      console.error("useMoodTrend error:", error);
    } finally {
      setLoading(false);
    }
  }, [user, supabase, range]);

  useEffect(() => {
    fetchTrend();
  }, [fetchTrend]);

  const validPoints = data.filter((p) => p.score !== null);
  const hasData = validPoints.length > 0;
  const avgScore = hasData
    ? Math.round((validPoints.reduce((sum, p) => sum + (p.score as number), 0) / validPoints.length) * 10) / 10
    : null;

  return { data, loading, hasData, avgScore, ticks, refetch: fetchTrend };
}
