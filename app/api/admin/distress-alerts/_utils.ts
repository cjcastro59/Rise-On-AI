import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Database } from "@/types/database";

const allowedRoles = new Set(["admin", "owner", "counselor"]);

// UID v4 format validation ─────────────────────────────────
// All admin endpoints accept a `params.id` that must be a valid UUID to prevent
// injection-style payloads being passed to Supabase queries.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

export async function getAuthorizedAdminClient() {
  const authClient = createServerClient() as any;
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return { error: "You must be signed in.", status: 401 as const };
  }

  // Hard fail when service role key is missing ─────────────
  // Baseline: fell back silently to anon client — admin operations would then
  // run under RLS, which may or may not gate correctly depending on policy config.
  // Fix: explicitly fail with a 500 and a clear operational message so the
  // deployment issue surfaces immediately rather than producing silent failures.
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

  if (!serviceRoleKey) {
    console.error(
      "[security] SUPABASE_SERVICE_ROLE_KEY is not set. " +
      "Admin API routes require the service role key to bypass RLS safely. " +
      "Set SUPABASE_SERVICE_ROLE_KEY in your server environment variables."
    );
    return {
      error:
        "Server misconfiguration: admin service key not configured. " +
        "Contact the system administrator.",
      status: 500 as const,
    };
  }

  const adminClient: any = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession:   false,
      },
    }
  );

  // Re-verify the caller's role using the service client (bypasses RLS to
  // prevent a race condition where a user could change their own role just
  // before this check completes on an anon client).
  const { data: profiles, error: profileError } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .limit(1);
  const profile = profiles?.[0] || null;

  if (profileError || !profile || !allowedRoles.has(profile.role)) {
    return {
      error:  "You do not have permission to manage distress alerts.",
      status: 403 as const,
    };
  }

  return { adminClient, user, profile, status: 200 as const };
}

export function appendActionNote(notes: string | null, actionNote: string) {
  return notes?.trim() ? `${notes.trim()}\n${actionNote}` : actionNote;
}
