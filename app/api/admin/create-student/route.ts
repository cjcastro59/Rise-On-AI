import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function generatePassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "@#$!";
  const all = upper + lower + digits + special;
  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  const rest = Array.from({ length: length - 4 }, () =>
    all[Math.floor(Math.random() * all.length)]
  );
  const combined = [...required, ...rest];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join("");
}

export async function POST(request: Request) {
  try {
    const authClient = createServerClient() as any;
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: callerProfile } = await authClient
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!["admin", "owner"].includes(callerProfile?.role)) {
      return NextResponse.json({ error: "Only admins and owners can create student accounts." }, { status: 403 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Server misconfiguration." }, { status: 500 });
    }

    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await request.json();
    const { firstName, lastName, email } = body;

    if (!firstName || !email) {
      return NextResponse.json({ error: "First name and email are required." }, { status: 400 });
    }

    const { data: existing } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const tempPassword = generatePassword(12);

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName || "" },
    });

    if (createError || !newUser.user) {
      return NextResponse.json({ error: createError?.message || "Failed to create account." }, { status: 500 });
    }

    await adminClient
      .from("user_profiles")
      .update({
        first_name: firstName,
        last_name: lastName || null,
        full_name: lastName ? `${firstName} ${lastName}` : firstName,
        email,
        role: "user",
        updated_at: new Date().toISOString(),
      })
      .eq("id", newUser.user.id);

    await adminClient.from("audit_logs").insert({
      admin_id: user.id,
      action: "User Created",
      target_id: newUser.user.id,
      target_type: "user",
      details: `Created student account for ${firstName} ${lastName || ""} (${email})`,
    });

    const siteUrl = "https://rise-on-ai.vercel.app";

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:32px 16px;">
    <div style="background:linear-gradient(135deg,#A8DADC,#CDB4DB);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
      <h1 style="color:#1e293b;font-size:24px;font-weight:700;margin:0 0 4px 0;">Rise On AI</h1>
      <p style="color:#334155;font-size:14px;margin:0;">Your Mental Wellness Account Has Been Created</p>
    </div>
    <div style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
      <p style="font-size:15px;color:#1e293b;margin:0 0 16px 0;">Hello <strong>${firstName}</strong>,</p>
      <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 24px 0;">Your student wellness account for <strong>Rise On AI</strong> at Pamantasan ng Lungsod ng Pasig has been created. You can now log in and start your wellness journey.</p>
      <div style="background:#f0f9ff;border:2px solid #A8DADC;border-radius:12px;padding:24px;margin-bottom:24px;">
        <p style="font-size:13px;color:#64748b;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Your Login Credentials</p>
        <table style="width:100%;">
          <tr><td style="font-size:13px;color:#64748b;padding-bottom:8px;">Email Address</td><td style="font-size:13px;color:#1e293b;font-weight:600;text-align:right;padding-bottom:8px;">${email}</td></tr>
          <tr><td style="font-size:13px;color:#64748b;">Temporary Password</td><td style="text-align:right;"><span style="font-size:18px;font-family:monospace;font-weight:700;color:#0f172a;background:#e2e8f0;padding:4px 12px;border-radius:6px;letter-spacing:2px;">${tempPassword}</span></td></tr>
        </table>
      </div>
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${siteUrl}/login" style="display:inline-block;background:linear-gradient(135deg,#A8DADC,#CDB4DB);color:#1e293b;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;">Log In to Rise On AI →</a>
      </div>
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px;margin-bottom:24px;">
        <p style="font-size:13px;color:#92400e;margin:0;line-height:1.5;">⚠️ <strong>Important:</strong> Please change your password after your first login. Go to <strong>Settings → Security → Change Password</strong>. Do not share your credentials with anyone.</p>
      </div>
      <h3 style="font-size:14px;color:#1e293b;margin:0 0 12px 0;">What You Can Do in Rise On AI</h3>
      <ul style="font-size:13px;color:#475569;line-height:1.8;padding-left:20px;margin:0 0 24px 0;">
        <li>Write private digital journal entries</li>
        <li>Track your mood and emotional wellness</li>
        <li>View AI-powered sentiment analysis of your entries</li>
        <li>Monitor your wellness score and behavioral trends</li>
        <li>Connect with your assigned guidance counselor</li>
      </ul>
      <div style="text-align:center;padding-top:24px;border-top:1px solid #e2e8f0;">
        <p style="font-size:12px;color:#94a3b8;margin:0;">Rise On AI — Pamantasan ng Lungsod ng Pasig</p>
        <p style="font-size:12px;color:#94a3b8;margin:4px 0 0 0;">College of Arts and Sciences Mental Wellness Support System</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const { error: emailError } = await resend.emails.send({
      from: "Rise On AI <onboarding@resend.dev>",
      to: [email],
      subject: "Welcome to Rise On AI — Your Account Credentials",
      html: htmlBody,
    });

    if (emailError) {
      return NextResponse.json({
        success: true,
        userId: newUser.user.id,
        emailSent: false,
        warning: "Account created but email could not be sent. Please share credentials manually.",
        tempPassword,
      });
    }

    return NextResponse.json({ success: true, userId: newUser.user.id, emailSent: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
