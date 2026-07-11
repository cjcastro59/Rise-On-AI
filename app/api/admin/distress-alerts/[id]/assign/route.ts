import { NextResponse } from "next/server";
import { appendActionNote, getAuthorizedAdminClient } from "../../_utils";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthorizedAdminClient();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { adminClient, user, profile } = auth;
  const body = await request.json().catch(() => ({}));
  const requestedCounselorId = typeof body?.counselorId === "string" ? body.counselorId : "";
  const counselorId = requestedCounselorId || (profile.role === "counselor" ? user.id : "");

  if (!counselorId) {
    return NextResponse.json({ error: "Please choose a counselor to assign." }, { status: 400 });
  }

  const { data: counselors, error: counselorError } = await adminClient
    .from("user_profiles")
    .select("id,full_name,username,role")
    .eq("id", counselorId)
    .eq("role", "counselor")
    .limit(1);
  const counselor = counselors?.[0] || null;

  if (counselorError || !counselor) {
    return NextResponse.json({ error: "Selected counselor was not found." }, { status: 404 });
  }

  const { data: alerts, error: alertError } = await adminClient
    .from("distress_logs")
    .select("id,user_id,notes")
    .eq("id", params.id)
    .limit(1);
  const alert = alerts?.[0] || null;

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
          counselor_id: counselorId,
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingConversation.id)
        .select("id,user_id,counselor_id,status,created_at,updated_at")
        .limit(1)
    : await adminClient
        .from("conversations")
        .insert({
          user_id: alert.user_id,
          counselor_id: counselorId,
          status: "open",
        })
        .select("id,user_id,counselor_id,status,created_at,updated_at")
        .limit(1);
  const conversation = conversationResult.data?.[0] || null;

  if (conversationResult.error || !conversation) {
    return NextResponse.json(
      { error: conversationResult.error?.message || "Failed to assign counselor." },
      { status: 500 }
    );
  }

  const assignedAt = new Date().toISOString();
  const counselorName = counselor.full_name || counselor.username || counselor.id.slice(0, 8);
  const notes = appendActionNote(
    alert.notes,
    `Assigned counselor ${counselorName} by staff ${user.id.slice(0, 8)} at ${assignedAt}`
  );

  const { data: log, error: updateError } = await adminClient
    .from("distress_logs")
    .update({ notes })
    .eq("id", alert.id)
    .select("id,notes")
    .limit(1);
  const updatedLog = log?.[0] || null;

  if (updateError) {
    return NextResponse.json({ error: updateError.message || "Failed to update alert notes." }, { status: 500 });
  }

  if (!updatedLog) {
    return NextResponse.json(
      { error: "Counselor was assigned, but the alert note could not be saved. Please check distress log update permissions in Supabase RLS." },
      { status: 403 }
    );
  }

  await adminClient.from("audit_logs").insert({
    admin_id: user.id,
    action: "Counselor Assigned",
    target_id: alert.id,
    target_type: "distress_alert",
    details: `Assigned counselor ${counselor.id.slice(0, 8)} to anonymized alert ${alert.id.slice(0, 8)}`,
  });

  return NextResponse.json({
    conversationId: conversation.id,
    conversation,
    log: updatedLog,
    message: `Assigned to ${counselorName}.`,
  });
}
