import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { parseLoginInput } from "@/lib/security/validation";
import { sanitizeText } from "@/lib/security/sanitize";
import { getClientIp, rateLimitLogin } from "@/lib/security/rate-limit";
import { getRoleRedirectPath } from "@/lib/auth/redirects";

export async function POST(request: Request) {
  const formData = await request.formData();
  let email = "";
  let password = "";

  try {
    const input = parseLoginInput(formData);
    email = sanitizeText(input.email).toLowerCase();
    password = input.password;
  } catch {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("error", "Email invalide");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const ip = getClientIp(request);
  const rate = await rateLimitLogin(`login:${ip}:${email}`);

  if (!rate.success) {
    return NextResponse.json(
      { error: "Trop de tentatives. Reessayez plus tard." },
      { status: 429 },
    );
  }

  const supabase = await createServerSupabaseClient({ canSetCookies: true });
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("error", "Email ou mot de passe invalide");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("error", "Session manquante");
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

  const role = (profile?.role ?? "family") as "admin" | "staff" | "professor" | "family";

  // Vérification du role_hint : bloquer si l'utilisateur utilise la mauvaise page
  const roleHint = formData.get("role_hint") as string | null;
  if (roleHint === "famille" && role !== "family") {
    await supabase.auth.signOut();
    const redirectUrl = new URL("/login/famille", request.url);
    redirectUrl.searchParams.set("error", "Ce compte n\u2019est pas un compte Famille");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }
  if (roleHint === "professeur" && role !== "professor") {
    await supabase.auth.signOut();
    const redirectUrl = new URL("/login/professeur", request.url);
    redirectUrl.searchParams.set("error", "Ce compte n\u2019est pas un compte Professeur");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const redirectPath = getRoleRedirectPath(role);
  return NextResponse.redirect(new URL(redirectPath, request.url), { status: 303 });
}
