import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "features")
      .maybeSingle() as { data: { value: unknown } | null; error: unknown };

    if (error || !data) {
      return NextResponse.json({ maintenanceMode: false });
    }

    const val = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
    return NextResponse.json({
      maintenanceMode: Boolean(val?.maintenanceMode),
    });
  } catch (err) {
    return NextResponse.json({ maintenanceMode: false });
  }
}
