import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options) {
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // If user is not signed in and trying to access protected routes, redirect to login
  if (
    !user &&
    (request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/journal") ||
    request.nextUrl.pathname.startsWith("/insights") ||
    request.nextUrl.pathname.startsWith("/analysis") ||
    request.nextUrl.pathname.startsWith("/profile") ||
    request.nextUrl.pathname.startsWith("/settings") ||
    request.nextUrl.pathname.startsWith("/support") ||
    request.nextUrl.pathname.startsWith("/admin"))
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If user is signed in, check their role for all protected routes
  if (user) {
    // Get user profile to check role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    // If user is trying to access login/register, redirect based on role
    if (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register") {
      if (profile && ["admin", "owner", "researcher", "counselor"].includes(profile.role)) {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // If user is trying to access regular dashboard but is admin/owner/researcher/counselor, redirect to admin dashboard
    if (request.nextUrl.pathname === "/dashboard" && profile && ["admin", "owner", "researcher", "counselor"].includes(profile.role)) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }

    // Check if user is trying to access admin routes
    if (request.nextUrl.pathname.startsWith("/admin")) {
      // If not admin/owner/researcher/counselor, redirect to regular dashboard
      if (!profile || !["admin", "owner", "researcher", "counselor"].includes(profile.role)) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/journal/:path*", "/insights/:path*", "/analysis/:path*", "/profile/:path*", "/settings/:path*", "/support/:path*", "/admin/:path*", "/login", "/register"],
};
