import { NextResponse } from "next/server";
import { appendActionNote, getAuthorizedAdminClient } from "../../_utils";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthorizedAdminClient();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { adminClient, user } = auth;
  const { data: alert, error: alertError } = await adminClient
    .from("distress_logs")
    .select("id,user_id,notes")
    .eq("id", params.id)
    .single();

  if (alertError || !alert) {
    return NextResponse.json({ error: "Distress alert not found." }, { status: 404 });
  }

  const { data: existingConversation, error: conversationLoadError } = await adminClient
    .from("conversations")
    .select("id")
    .eq("user_id", alert.user_id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (conversationLoadError) {
    return NextResponse.json({ error: conversationLoadError.message }, { status: 500 });
  }

  const conversationResult = existingConversation
    ? await adminClient
        .from("conversations")
        .update({
          counselor_id: user.id,
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingConversation.id)
        .select("id")
        .single()
    : await adminClient
        .from("conversations")
        .insert({
          user_id: alert.user_id,
          counselor_id: user.id,
          status: "open",
        })
        .select("id")
        .single();

  if (conversationResult.error || !conversationResult.data) {
    return NextResponse.json(
      { error: conversationResult.error?.message || "Failed to assign counselor." },
      { status: 500 }
    );
  }

  const assignedAt = new Date().toISOString();
  const notes = appendActionNote(
    alert.notes,
    `Assigned staff ${user.id.slice(0, 8)} at ${assignedAt}`
  );

  const { data: log, error: updateError } = await adminClient
    .from("distress_logs")
    .update({ notes })
    .eq("id", alert.id)
    .select("id,notes")
    .single();

  if (updateError || !log) {
    return NextResponse.json({ error: updateError?.message || "Failed to update alert notes." }, { status: 500 });
  }

  await adminClient.from("audit_logs").insert({
    admin_id: user.id,
    action: "Counselor Assigned",
    target_id: alert.id,
    target_type: "distress_alert",
    details: `Assigned counselor to anonymized alert ${alert.id.slice(0, 8)}`,
  });

  return NextResponse.json({
    conversationId: conversationResult.data.id,
    log,
    message: "Counselor assigned to alert.",
  });
}
