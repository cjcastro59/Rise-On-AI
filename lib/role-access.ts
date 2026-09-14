import type { createClient } from "@/lib/supabase/server";

export type RoleAccessResult =
  | { ok: true; userId: string; role: string; currentUserId: string }
  | { ok: false; status: number; error: string };

export async function resolveScopedTargetUser(
  supabase: ReturnType<typeof createClient>,
  requestedUserId: string | null | undefined,
  forbiddenMessage: string,
): Promise<RoleAccessResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const { data: profile } = await (supabase.from("user_profiles") as any)
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile as any)?.role ?? "user";
  const targetUserId = requestedUserId || user.id;

  if (targetUserId === user.id) {
    return { ok: true, userId: user.id, role, currentUserId: user.id };
  }

  if (role === "admin" || role === "owner") {
    return { ok: true, userId: targetUserId, role, currentUserId: user.id };
  }

  if (role === "counselor") {
    const { data: assignedProfile } = await (supabase.from("user_profiles") as any)
      .select("id")
      .eq("id", targetUserId)
      .eq("role", "user")
      .eq("assigned_counselor_id", user.id)
      .maybeSingle();

    if (assignedProfile) {
      return { ok: true, userId: targetUserId, role, currentUserId: user.id };
    }
  }

  return { ok: false, status: 403, error: forbiddenMessage };
}
