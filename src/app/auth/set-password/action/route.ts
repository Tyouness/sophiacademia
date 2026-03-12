import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { parseSetPasswordInput } from "@/lib/security/validation";
import { getRoleRedirectPath } from "@/lib/auth/redirects";

export async function POST(request: Request) {
  const formData = await request.formData();
  let password = "";

  try {
    const input = parseSetPasswordInput(formData);
    password = input.password;
  } catch {
    const redirectUrl = new URL("/auth/set-password", request.url);
    redirectUrl.searchParams.set("error", "Mot de passe invalide");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const supabase = await createServerSupabaseClient({ canSetCookies: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const redirectUrl = new URL("/auth/set-password", request.url);
    redirectUrl.searchParams.set("error", "Impossible de definir le mot de passe");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const adminSupabase = createAdminSupabaseClient();
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("role, disabled_at, deleted_at")
    .eq("id", user.id)
    .single();

  if (profile?.disabled_at || profile?.deleted_at) {
    await supabase.auth.signOut();
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("error", "Compte desactive");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const role = (profile?.role ?? "family") as
    | "admin"
    | "staff"
    | "professor"
    | "family";

  return NextResponse.redirect(
    new URL(getRoleRedirectPath(role), request.url),
    { status: 303 },
  );
}
