import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const supabase = createClient() as any;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: counselorProfile } = await supabase
      .from("user_profiles")
      .select("role, full_name, first_name, last_name, username")
      .eq("id", user.id)
      .single();

    if (!["counselor", "admin", "owner"].includes(counselorProfile?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      studentUserId,
      studentEmail,
      studentName,
      reportDate,
      counselorNotes,
      ...reportPayload
    } = body;

    if (!studentEmail || !studentName || !studentUserId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const counselorName =
      counselorProfile?.full_name ||
      (counselorProfile?.first_name && counselorProfile?.last_name
        ? `${counselorProfile.first_name} ${counselorProfile.last_name}`
        : counselorProfile?.username || "Your Counselor");

    // Generate a secure random token (32 bytes = 64 hex chars)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Use service role to insert (bypasses RLS insert policy issues)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminClient = serviceKey
      ? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : supabase;

    const { error: insertError } = await adminClient.from("student_reports").insert({
      token,
      student_user_id: studentUserId,
      counselor_id: user.id,
      report_data: {
        studentName,
        studentEmail,
        reportDate,
        counselorName,
        ...reportPayload,
      },
      counselor_notes: counselorNotes || null,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      console.error("Failed to save report token:", insertError);
      return NextResponse.json({ error: "Failed to generate report link." }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rise-on-ai.vercel.app";
    const reportUrl = `${siteUrl}/report/${token}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:32px 16px;">
    <div style="background:linear-gradient(135deg,#A8DADC,#CDB4DB);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
      <h1 style="color:#1e293b;font-size:24px;font-weight:700;margin:0 0 4px 0;">Rise On AI</h1>
      <p style="color:#334155;font-size:14px;margin:0;">Your Wellness Progress Report is Ready</p>
    </div>
    <div style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
      <p style="font-size:15px;color:#1e293b;margin:0 0 16px 0;">Hello <strong>${studentName}</strong>,</p>
      <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 24px 0;">
        Your guidance counselor <strong>${counselorName}</strong> has prepared a wellness progress report for you.
        This report contains your emotional wellness assessment based on your journal activity.
      </p>

      <!-- Lock Icon + Password Protection Notice -->
      <div style="background:#f0f9ff;border:2px solid #A8DADC;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
        <p style="font-size:32px;margin:0 0 8px 0;">🔒</p>
        <p style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 8px 0;">Password-Protected Report</p>
        <p style="font-size:13px;color:#475569;margin:0 0 16px 0;">
          This report is confidential. You will need to enter your <strong>Rise On AI login password</strong> to access it.
        </p>
        <a href="${reportUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#A8DADC,#CDB4DB);color:#1e293b;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;">
          View My Report →
        </a>
      </div>

      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px;margin-bottom:24px;">
        <p style="font-size:12px;color:#92400e;margin:0;line-height:1.5;">
          ⚠️ <strong>Security Notice:</strong> This link expires in <strong>7 days</strong> on ${expiresAt.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.
          Do not share this link with anyone. Only you should access this report.
        </p>
      </div>

      <p style="font-size:13px;color:#94a3b8;margin:0;">If you did not expect this email, please contact your guidance counselor.</p>

      <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;">
        <p style="font-size:12px;color:#94a3b8;margin:0;">Rise On AI — Pamantasan ng Lungsod ng Pasig</p>
        <p style="font-size:12px;color:#94a3b8;margin:4px 0 0 0;">College of Arts and Sciences Mental Wellness Support System</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const { error: emailError } = await resend.emails.send({
      from: "Rise On AI <onboarding@resend.dev>",
      to: [studentEmail],
      subject: `Your Wellness Progress Report — ${reportDate}`,
      html: htmlBody,
    });

    if (emailError) {
      console.error("Email send error:", emailError);
      // Token was saved — return URL so counselor can share manually
      return NextResponse.json({
        success: true,
        emailSent: false,
        reportUrl,
        warning: "Report link created but email failed. Share the link manually.",
      });
    }

    return NextResponse.json({ success: true, emailSent: true });
  } catch (err: any) {
    console.error("Send report error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
