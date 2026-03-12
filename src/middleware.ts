/**
 * middleware.ts
 *
 * Protège les routes /family/* et /professor/* contre les accès non authentifiés.
 * Si l'utilisateur n'est pas connecté → redirect vers la page login adaptée.
 *
 * La vérification du rôle (cross-role blocking) est faite dans chaque layout
 * (Server Components) qui ont accès à la base de données.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Routes protégées et leurs pages de login respectives
  const protectedRoutes: { prefix: string; loginPath: string }[] = [
    { prefix: "/family", loginPath: "/login/famille" },
    { prefix: "/professor", loginPath: "/login/professeur" },
    { prefix: "/staff", loginPath: "/login" },
    { prefix: "/admin", loginPath: "/login" },
  ];

  const matched = protectedRoutes.find((r) => pathname.startsWith(r.prefix));
  if (!matched) return NextResponse.next();

  // Créer un client Supabase qui lit les cookies de la requête
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL(matched.loginPath, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/family/:path*",
    "/professor/:path*",
    "/staff/:path*",
    "/admin/:path*",
  ],
};
