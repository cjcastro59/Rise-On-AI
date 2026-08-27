import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // ---- 1. Auth check ----
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ---- 2. Parse query params ----
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get("userId");
    const lookbackParam = searchParams.get("lookbackDays");
    const limitParam = searchParams.get("limit");

    const lookbackDays = lookbackParam
      ? Math.min(365, Math.max(1, parseInt(lookbackParam, 10) || 30))
      : 30;
    const limit = limitParam
      ? Math.min(90, Math.max(1, parseInt(limitParam, 10) || 10))
      : 10;

    // ---- 3. Resolve targetUserId with role check ----
    const { data: profile } = await (supabase
      .from("user_profiles") as any)
      .select("role")
      .eq("id", user.id)
      .single();

    let targetUserId = user.id;
    if (userIdParam && userIdParam !== user.id) {
      const isPrivileged =
        (profile as any)?.role === "admin" ||
        (profile as any)?.role === "owner" ||
        (profile as any)?.role === "counselor";
      if (!isPrivileged) {
        return NextResponse.json(
          { error: "Forbidden — cannot view another user's indicators" },
          { status: 403 }
        );
      }
      targetUserId = userIdParam;
    }

    // ---- 4. Fetch stored indicators ----
    // O4 (Phase 7): Narrowed from select("*") to only the columns needed by
    // the UI (useBehavioralIndicators hook). Large JSONB detail columns
    // (_details, _streak, wellness_score_details) are excluded here since the
    // hook's BehavioralIndicatorsRow interface only uses the scalar fields for
    // display. This reduces payload size by ~60-70% per row.
    // If a caller needs the full JSONB details they should use POST /api/behavioral/compute.
    const { data: rows, error } = await (supabase
      .from("behavioral_indicators") as any)
      .select(
        "id, user_id, window_end_date, lookback_days, " +
        "behavioral_trend_score, " +
        "journaling_frequency_score, total_entries_window, unique_days_journaled, " +
        "mood_consistency_score, sentiment_scores_variance, sentiment_scores_std, " +
        "consecutive_negative_count, " +
        "entries_analyzed, computed_at, updated_at, " +
        "wellness_score, wellness_level, wellness_score_details"
      )
      .eq("user_id", targetUserId)
      .eq("lookback_days", lookbackDays)
      .order("window_end_date", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[behavioral GET] fetch failed:", error);
      return NextResponse.json(
        { error: "Failed to fetch behavioral indicators", details: error.message },
        { status: 500 }
      );
    }

    const latest = (rows ?? [])[0] ?? null;

    // O5 (Phase 7): short-lived private cache for user-specific behavioral data.
    // max-age=30s: browser can serve cached response instantly within 30s.
    // stale-while-revalidate=60s: browser re-fetches silently for up to 60s more.
    // private: never cached by CDN/shared proxy (data is auth-gated).
    // Safety: indicators only change after a journal save (fire-and-forget, seconds later).
    // 30s stale window is acceptable — users won't see stale data for more than 30s.
    const cacheHeader = "private, max-age=30, stale-while-revalidate=60";

    return NextResponse.json(
      {
        ok: true,
        targetUserId,
        lookbackDays,
        count: rows?.length ?? 0,
        history: rows ?? [],
        latest,
      },
      { headers: { "Cache-Control": cacheHeader } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[behavioral GET] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: message },
      { status: 500 }
    );
  }
}
