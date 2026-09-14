import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { validatePasswordStrength } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChangePasswordRequest {
  currentPassword?: string;
  newPassword?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "You must be signed in to change your password." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as ChangePasswordRequest;
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current password and new password are required." }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: "New password must be different from your current password." }, { status: 400 });
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const email = user.email;
    if (!email) {
      return NextResponse.json({ error: "This account does not have an email address." }, { status: 400 });
    }

    const verifier = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const { error: verifyError } = await verifier.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (verifyError) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      return NextResponse.json({ error: updateError.message || "Password could not be updated." }, { status: 500 });
    }

    await (supabase.from("audit_logs") as any).insert({
      admin_id: user.id,
      action: "Password Changed",
      target_id: user.id,
      target_type: "user_profile",
      details: "User changed their own password.",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/change-password] unexpected error:", error);
    return NextResponse.json({ error: "Password could not be changed right now." }, { status: 500 });
  }
}
