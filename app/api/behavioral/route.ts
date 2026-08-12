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
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    let targetUserId = user.id;
    if (userIdParam && userIdParam !== user.id) {
      const isPrivileged =
        profile?.role === "admin" ||
        profile?.role === "owner" ||
        profile?.role === "counselor";
      if (!isPrivileged) {
        return NextResponse.json(
          { error: "Forbidden — cannot view another user's indicators" },
          { status: 403 }
        );
      }
      targetUserId = userIdParam;
    }

    // ---- 4. Fetch stored indicators ----
    const { data: rows, error } = await (supabase
      .from("behavioral_indicators") as any)
      .select("*")
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

    // ---- 5. Optionally include the LATEST computed summary even if not yet stored
    //      (convenience: clients can always see the "most recent" window)
    const latest = (rows ?? [])[0] ?? null;

    return NextResponse.json({
      ok: true,
      targetUserId,
      lookbackDays,
      count: rows?.length ?? 0,
      history: rows ?? [],
      latest,
    });
  } catch (err: any) {
    console.error("[behavioral GET] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message },
      { status: 500 }
    );
  }
}
