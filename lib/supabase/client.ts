import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database";

let clientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (clientInstance) return clientInstance;

  clientInstance = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Use sessionStorage instead of localStorage so the session is
        // automatically cleared when the browser tab or window is closed.
        // Users must log in again on every new browser session.
        storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );

  return clientInstance as any;
}
