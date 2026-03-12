import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient({ canSetCookies: true });

  // Lire le rôle avant de déconnecter
  const { data: { user } } = await supabase.auth.getUser();

  let loginPath = "/login/famille";
  if (user) {
    const adminSupabase = createAdminSupabaseClient();
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "professor") loginPath = "/login/professeur";
    else if (profile?.role === "staff" || profile?.role === "admin") loginPath = "/login";
  }

  await supabase.auth.signOut();

  return NextResponse.redirect(new URL(loginPath, request.url), { status: 303 });
}
