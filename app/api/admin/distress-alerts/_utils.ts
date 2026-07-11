import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Database } from "@/types/database";

const allowedRoles = new Set(["admin", "owner", "counselor"]);

export async function getAuthorizedAdminClient() {
  const authClient = createServerClient() as any;
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return { error: "You must be signed in.", status: 401 as const };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const adminClient: any = serviceRoleKey
    ? createSupabaseClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      )
    : authClient;

  const { data: profiles, error: profileError } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .limit(1);
  const profile = profiles?.[0] || null;

  if (profileError || !profile || !allowedRoles.has(profile.role)) {
    return { error: "You do not have permission to manage distress alerts.", status: 403 as const };
  }

  return { adminClient, user, profile, status: 200 as const };
}

export function appendActionNote(notes: string | null, actionNote: string) {
  return notes?.trim() ? `${notes.trim()}\n${actionNote}` : actionNote;
}
