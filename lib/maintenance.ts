import { createClient } from "@/lib/supabase/server";

/**
 * Check if the platform is currently in maintenance mode.
 * Returns true if maintenanceMode is set to true in system_settings.features.
 */
export async function isMaintenanceModeActive(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "features")
      .maybeSingle() as { data: { value: unknown } | null };

    if (!data?.value) return false;
    const features = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
    return Boolean(features?.maintenanceMode);
  } catch {
    return false;
  }
}
