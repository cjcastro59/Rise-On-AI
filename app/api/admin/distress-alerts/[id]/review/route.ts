import { NextResponse } from "next/server";
import { appendActionNote, getAuthorizedAdminClient, isValidUUID } from "../../_utils";

export async function POST(
  _request: Request,
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
  const { data: existingLogs, error: loadError } = await adminClient
    .from("distress_logs")
    .select("id,user_id,notes")
    .eq("id", params.id)
    .limit(1);
  const existingLog = existingLogs?.[0] || null;

  if (loadError || !existingLog) {
    return NextResponse.json({ error: "Distress alert not found." }, { status: 404 });
  }

  if (profile.role === "counselor") {
    const { data: assignedUsers, error: assignedError } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("id", existingLog.user_id)
      .eq("role", "user")
      .eq("assigned_counselor_id", user.id)
      .limit(1);

    if (assignedError || !assignedUsers?.[0]) {
      return NextResponse.json({ error: "You can only review alerts for users assigned to you." }, { status: 403 });
    }
  }

  const reviewedAt = new Date().toISOString();
  const notes = appendActionNote(
    existingLog.notes,
    `Acknowledged by staff ${user.id.slice(0, 8)} at ${reviewedAt}`
  );

  const { data: log, error: updateError } = await adminClient
    .from("distress_logs")
    .update({ notes })
    .eq("id", params.id)
    .select("id,user_id,notes")
    .limit(1);

  const updatedLog = log?.[0] || null;

  if (updateError) {
    return NextResponse.json({ error: updateError.message || "Failed to review alert." }, { status: 500 });
  }

  if (!updatedLog) {
    return NextResponse.json(
      { error: "Review could not be saved. Please check that counselors are allowed to update distress logs in Supabase RLS." },
      { status: 403 }
    );
  }

  await adminClient.from("audit_logs").insert({
    admin_id: user.id,
    action: "Distress Alert Reviewed",
    target_id: params.id,
    target_type: "distress_alert",
    details: `Reviewed anonymized alert ${params.id.slice(0, 8)}`,
  });

  return NextResponse.json({
    log: updatedLog,
    message: "Case marked as done reviewed.",
  });
}
