import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// ── S12 (Phase 8): CSRF protection ───────────────────────────────────────────
// The signout endpoint is a state-mutation action (invalidates the session).
// Without a check, a CSRF attack from a malicious third-party site could
// force a logged-in user to sign out simply by tricking their browser into
// submitting a POST to this URL (e.g. via a hidden form or fetch with
// no-cors credentials).
//
// Defence: verify that the request Origin (or Referer as fallback) matches
// the application's own host. Browsers always send Origin on cross-origin
// POSTs. Same-origin requests from the app's own pages will always pass.
//
// Note: this is a lightweight, same-origin check — not a token-based CSRF
// mechanism. It is appropriate here because:
//   1. Supabase auth cookies use SameSite=Lax by default, which already
//      blocks cross-site POSTs from third-party navigations.
//   2. This check adds defence-in-depth for environments where SameSite
//      is not honoured (older browsers, some proxy configs).
//   3. Signing out is a low-severity action (no data is modified); the
//      check prevents annoyance attacks, not data-loss attacks.
function isOriginAllowed(request: NextRequest): boolean {
  const host = request.headers.get("host") ?? "";

  // In development (localhost) we allow any origin to avoid blocking
  // hot-reload and CLI tools.
  if (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    process.env.NODE_ENV === "development"
  ) {
    return true;
  }

  const origin  = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // Prefer Origin header — always present on cross-origin requests.
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }

  // Fallback to Referer when Origin is absent (same-origin browser requests
  // sometimes omit Origin).
  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      return refererHost === host;
    } catch {
      return false;
    }
  }

  // No Origin or Referer — reject to be safe.
  // (Direct API calls with no headers are unlikely from legitimate users.)
  return false;
}

export async function POST(request: NextRequest) {
  // ── CSRF check ────────────────────────────────────────────────────────────
  if (!isOriginAllowed(request)) {
    return NextResponse.json(
      { error: "Forbidden — cross-origin signout not allowed." },
      { status: 403 }
    );
  }

  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );

  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
