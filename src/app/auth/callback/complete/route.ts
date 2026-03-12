import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { bootstrapAdminRole } from "@/lib/auth/bootstrap-admin";
import { getRoleRedirectPath } from "@/lib/auth/redirects";

async function finalizeSession(params: {
  request: Request;
  nextPath?: string | null;
}) {
  const supabase = await createServerSupabaseClient({ canSetCookies: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=Session%20manquante", params.request.url));
  }

  await bootstrapAdminRole({ id: user.id, email: user.email });

  const adminSupabase = createAdminSupabaseClient();
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("role, disabled_at, deleted_at")
    .eq("id", user.id)
    .single();

  if (profile?.disabled_at || profile?.deleted_at) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=Compte%20desactive", params.request.url));
  }

  if (params.nextPath && params.nextPath.startsWith("/")) {
    return NextResponse.redirect(new URL(params.nextPath, params.request.url));
  }

  const role = (profile?.role ?? "family") as
    | "admin"
    | "staff"
    | "professor"
    | "family";

  return NextResponse.redirect(
    new URL(getRoleRedirectPath(role), params.request.url),
  );
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = requestUrl.searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=Session%20manquante", request.url));
  }

  const supabase = await createServerSupabaseClient({ canSetCookies: true });
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=Lien%20invalide%20ou%20expire", request.url));
  }

  return finalizeSession({ request, nextPath });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    accessToken?: string;
    refreshToken?: string;
    next?: string | null;
  };

  if (!body?.accessToken || !body?.refreshToken) {
    return NextResponse.json({ error: "Missing session" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient({ canSetCookies: true });
  const { error } = await supabase.auth.setSession({
    access_token: body.accessToken,
    refresh_token: body.refreshToken,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return finalizeSession({ request, nextPath: body.next });
}
