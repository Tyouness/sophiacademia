import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user) {
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/family") ||
    pathname.startsWith("/professor")
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, disabled_at, deleted_at")
      .eq("id", user.id)
      .single();

    if (profile?.disabled_at || profile?.deleted_at) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("error", "Compte desactive");
      return NextResponse.redirect(redirectUrl);
    }

    const role = profile?.role ?? "family";

    if (pathname.startsWith("/admin") && role !== "admin") {
      const redirectUrl = new URL("/dashboard", request.url);
      redirectUrl.searchParams.set("notice", "access_denied");
      return NextResponse.redirect(redirectUrl);
    }

    if (
      pathname.startsWith("/staff") &&
      role !== "admin" &&
      role !== "staff"
    ) {
      const redirectUrl = new URL("/dashboard", request.url);
      redirectUrl.searchParams.set("notice", "access_denied");
      return NextResponse.redirect(redirectUrl);
    }

    if (pathname.startsWith("/family") && role !== "family") {
      const redirectUrl = new URL("/dashboard", request.url);
      redirectUrl.searchParams.set("notice", "access_denied");
      return NextResponse.redirect(redirectUrl);
    }

    if (pathname.startsWith("/professor") && role !== "professor") {
      const redirectUrl = new URL("/dashboard", request.url);
      redirectUrl.searchParams.set("notice", "access_denied");
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/staff/:path*",
    "/family/:path*",
    "/professor/:path*",
  ],
};
