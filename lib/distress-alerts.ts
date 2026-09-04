import type { Sentiment } from "@/lib/sentiment";

type SupabaseClientLike = {
  from: (table: string) => any;
};

type JournalAlertInput = {
  userId: string;
  entryId?: string | null;
  title?: string | null;
  content?: string | null;
  mood?: string | null;
};

type DistressAlert = {
  severity: "critical" | "medium";
  trigger: string;
};

const mediumAlertMoods = new Set(["Overwhelmed"]);

const buildTrigger = (alert: DistressAlert, entryId?: string | null) => {
  const source = entryId ? `Journal entry ${entryId}` : "Journal entry";
  return `${source}: ${alert.trigger}`;
};

export const getJournalDistressAlert = ({
  mood,
  existingSentiment,
}: Pick<JournalAlertInput, "title" | "content" | "mood"> & {
  existingSentiment?: Sentiment | null | undefined;
}): DistressAlert | null => {
  // Use the ML-predicted sentiment exclusively — no keyword scanning.
  // If the ML result is not yet available, err on the side of caution only
  // when the user explicitly chose the "Overwhelmed" mood.
  if (existingSentiment === "distress") {
    return {
      severity: "critical",
      trigger: "Critical distress detected by ML model",
    };
  }

  if (mood && mediumAlertMoods.has(mood)) {
    return {
      severity: "medium",
      trigger: `${mood} mood selected`,
    };
  }

  return null;
};

export const createDistressAlertForJournalEntry = async (
  supabase: SupabaseClientLike,
  input: JournalAlertInput & { existingSentiment?: Sentiment | null }
) => {
  const alert = getJournalDistressAlert(input);
  if (!alert) return;

  const trigger = buildTrigger(alert, input.entryId);

  if (input.entryId) {
    const { data: existingAlert, error: existingAlertError } = await supabase
      .from("distress_logs")
      .select("id")
      .eq("user_id", input.userId)
      .eq("trigger", trigger)
      .maybeSingle();

    if (existingAlertError) {
      console.error("Error checking distress alert:", existingAlertError);
    }

    if (existingAlert) return;
  }

  const { error } = await supabase.from("distress_logs").insert({
    user_id: input.userId,
    severity: alert.severity,
    trigger,
    notes: null,
  });

  if (error) {
    console.error("Error creating distress alert:", error);
  }
};
