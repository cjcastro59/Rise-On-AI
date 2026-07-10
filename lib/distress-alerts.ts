import { analyzeSentiment } from "@/lib/sentiment";

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
  title,
  content,
  mood,
}: Pick<JournalAlertInput, "title" | "content" | "mood">): DistressAlert | null => {
  const textToAnalyze = [title, content].filter(Boolean).join("\n");

  if (analyzeSentiment(textToAnalyze) === "distress") {
    return {
      severity: "critical",
      trigger: "Critical distress language detected",
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
  input: JournalAlertInput
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
