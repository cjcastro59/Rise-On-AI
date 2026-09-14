import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveScopedTargetUser } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    const auth = await resolveScopedTargetUser(
      supabase,
      searchParams.get("userId"),
      "Forbidden - cannot view another user's indicators",
    );
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const lookbackParam = searchParams.get("lookbackDays");
    const limitParam = searchParams.get("limit");
    const lookbackDays = lookbackParam
      ? Math.min(365, Math.max(1, parseInt(lookbackParam, 10) || 30))
      : 30;
    const limit = limitParam
      ? Math.min(90, Math.max(1, parseInt(limitParam, 10) || 10))
      : 10;

    const { data: rows, error } = await (supabase
      .from("behavioral_indicators") as any)
      .select(
        "id, user_id, window_end_date, lookback_days, " +
          "behavioral_trend_score, " +
          "journaling_frequency_score, total_entries_window, unique_days_journaled, " +
          "mood_consistency_score, sentiment_scores_variance, sentiment_scores_std, " +
          "consecutive_negative_count, " +
          "entries_analyzed, computed_at, updated_at, " +
          "wellness_score, wellness_level, wellness_score_details",
      )
      .eq("user_id", auth.userId)
      .eq("lookback_days", lookbackDays)
      .order("window_end_date", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[behavioral GET] fetch failed:", error);
      return NextResponse.json(
        { error: "Failed to fetch behavioral indicators", details: error.message },
        { status: 500 },
      );
    }

    const latest = (rows ?? [])[0] ?? null;

    return NextResponse.json(
      {
        ok: true,
        targetUserId: auth.userId,
        lookbackDays,
        count: rows?.length ?? 0,
        history: rows ?? [],
        latest,
      },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[behavioral GET] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: message },
      { status: 500 },
    );
  }
}
