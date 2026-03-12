import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseForgotInput } from "@/lib/security/validation";
import { sanitizeText } from "@/lib/security/sanitize";
import { getClientIp, rateLimitLogin } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const formData = await request.formData();
  let email = "";

  try {
    const input = parseForgotInput(formData);
    email = sanitizeText(input.email).toLowerCase();
  } catch {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("error", "Email invalide");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const ip = getClientIp(request);
  const rate = await rateLimitLogin(`forgot:${ip}:${email}`);

  if (!rate.success) {
    return NextResponse.json(
      { error: "Trop de tentatives. Reessayez plus tard." },
      { status: 429 },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("error", "NEXT_PUBLIC_SITE_URL manquant");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const supabase = await createServerSupabaseClient({ canSetCookies: true });
  const redirectTo = `${siteUrl.replace(/\/$/, "")}/auth/callback?next=/auth/set-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("error", "Email indisponible");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("sent", "1");
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
