export type DisplayIdFormat = "anonymized" | "short" | "full_uuid";
export type DisplayIdKind = "user" | "entry" | "alert" | "conversation";

const DEFAULT_FORMAT: DisplayIdFormat = "anonymized";

const PREFIXES: Record<DisplayIdKind, { anonymized: string; short: string }> = {
  user: { anonymized: "USER", short: "U" },
  entry: { anonymized: "ENTRY", short: "E" },
  alert: { anonymized: "ALERT", short: "A" },
  conversation: { anonymized: "CHAT", short: "C" },
};

export function normalizeDisplayIdFormat(value: unknown): DisplayIdFormat {
  const raw =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && "display_id_format" in value
        ? String((value as { display_id_format?: unknown }).display_id_format)
        : "";

  const normalized = raw.toLowerCase().replace(/[\s-]+/g, "_");

  if (["full", "full_uuid", "uuid", "raw_uuid"].includes(normalized)) {
    return "full_uuid";
  }

  if (["short", "id_only", "short_id", "anonymized_short_id"].includes(normalized)) {
    return "short";
  }

  return DEFAULT_FORMAT;
}

export function formatDisplayId(
  id: string | null | undefined,
  kind: DisplayIdKind,
  format: DisplayIdFormat = DEFAULT_FORMAT
) {
  if (!id) return "Unassigned";
  if (format === "full_uuid") return id;

  const shortId = id.replace(/-/g, "").slice(0, 4).toUpperCase();
  const prefix = PREFIXES[kind][format === "short" ? "short" : "anonymized"];
  return `${prefix}-${shortId}`;
}

export async function loadDisplayIdFormat(supabase: any): Promise<DisplayIdFormat> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("key,value")
    .in("key", [
      "display_id_format",
      "display_settings",
      "privacy_settings",
      "privacy",
      "features",
    ])
    .limit(20);

  if (error) {
    console.error("[display-ids] Failed to load display ID settings:", error);
    return DEFAULT_FORMAT;
  }

  const rows = (data || []) as { key: string; value: unknown }[];
  const direct = rows.find((row) => row.key === "display_id_format");
  if (direct) return normalizeDisplayIdFormat(direct.value);

  const nested = rows.find((row) => {
    return !!(
      row.value &&
      typeof row.value === "object" &&
      "display_id_format" in row.value
    );
  });

  return nested ? normalizeDisplayIdFormat(nested.value) : DEFAULT_FORMAT;
}
