import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware — auth guard only.
 *
 * IMPORTANT: middleware runs on the Vercel Edge runtime which has a very short
 * wall-clock budget (~10 ms for network calls). Making multiple Supabase DB
 * queries here causes 504 MIDDLEWARE_INVOCATION_TIMEOUT for all users.
 *
 * Rule: ONE network call maximum — supabase.auth.getUser() to verify the
 * session. Role-based redirects (admin vs counselor vs member) are handled
 * inside the relevant layout / page server components where there is no
 * timeout constraint.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Single auth check — reads the JWT from the cookie, handles chunked tokens properly.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.warn("[middleware] auth.getUser failed:", err);
  }

  const { pathname } = request.nextUrl;

  // ── 1. Unauthenticated user trying to access protected routes → /login ──
  const protectedPrefixes = [
    "/dashboard", "/journal", "/insights", "/mood-trends",
    "/analysis", "/profile", "/settings", "/support",
    "/admin", "/counselor", "/setup-2fa",
  ];
  const isProtected = protectedPrefixes.some(p => pathname.startsWith(p));

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ── 2. Authenticated user on login/register → let page handle redirect ──
  // The login page itself redirects to the right dashboard after sign-in.
  // No redirect here avoids an extra DB round-trip in middleware.

  // ── 3. Allow everything else through ────────────────────────────────────
  // Role-based routing (admin vs counselor vs member) is handled in each
  // layout/page server component which runs on Node.js with no timeout limit.
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/journal/:path*",
    "/insights/:path*",
    "/mood-trends/:path*",
    "/analysis/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/support/:path*",
    "/admin/:path*",
    "/counselor/:path*",
    "/login",
    "/register",
    "/setup-2fa",
    "/forgot-password",
    "/reset-password",
  ],
};
