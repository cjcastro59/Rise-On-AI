import { NextResponse } from "next/server";
import { appendActionNote, getAuthorizedAdminClient, isValidUUID } from "../../_utils";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // validate UUID format before any DB query
  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: "Invalid alert ID format." }, { status: 400 });
  }

  const auth = await getAuthorizedAdminClient();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { adminClient, user, profile } = auth;
  const body = await request.json().catch(() => ({}));
  const requestedCounselorId = typeof body?.counselorId === "string" ? body.counselorId : "";
  if (profile.role === "counselor" && requestedCounselorId && requestedCounselorId !== user.id) {
    return NextResponse.json({ error: "Counselors can only open cases assigned to themselves." }, { status: 403 });
  }
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

  if (profile.role === "counselor") {
    const { data: assignedUsers, error: assignedError } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("id", alert.user_id)
      .eq("role", "user")
      .eq("assigned_counselor_id", user.id)
      .limit(1);

    if (assignedError || !assignedUsers?.[0]) {
      return NextResponse.json({ error: "You can only manage alerts for users assigned to you." }, { status: 403 });
    }
  }

  const { data: assignedProfile, error: assignmentError } = await adminClient
    .from("user_profiles")
    .update({ assigned_counselor_id: counselorId })
    .eq("id", alert.user_id)
    .eq("role", "user")
    .select("id")
    .maybeSingle();

  if (assignmentError || !assignedProfile) {
    return NextResponse.json(
      { error: assignmentError?.message || "The alert user profile could not be assigned." },
      { status: assignmentError ? 500 : 404 },
    );
  }

  const { data: existingConversations, error: conversationLoadError } = await adminClient
    .from("conversations")
    .select("id")
    .eq("user_id", alert.user_id)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (conversationLoadError) {
    return NextResponse.json({ error: conversationLoadError.message }, { status: 500 });
  }

  const openConversationIds = (existingConversations as { id: string }[] || [])
    .map((conversation) => conversation.id)
    .filter(Boolean);
  const conversationResult = openConversationIds.length
    ? await adminClient
        .from("conversations")
        .update({
          counselor_id: counselorId,
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .in("id", openConversationIds)
        .select("id,user_id,counselor_id,status,created_at,updated_at")
        .order("updated_at", { ascending: false })
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
