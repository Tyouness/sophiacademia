import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ProfileRole = "admin" | "staff" | "family" | "professor";

async function getUserAndRole(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  const supabase = await createServerSupabaseClient({
    canSetCookies: true,
    accessToken,
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, role: null };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, disabled_at, deleted_at")
    .eq("id", user.id)
    .single();

  if (error || !profile || profile.disabled_at || profile.deleted_at) {
    return { supabase, user, role: null };
  }

  return { supabase, user, role: profile.role as ProfileRole };
}

export async function GET(request: Request) {
  const { supabase, user, role } = await getUserAndRole(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "family") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone, addr1, addr2, postcode, city, country, lat, lng")
    .eq("id", user.id)
    .single();

  const { data: family } = await supabase
    .from("family_profiles")
    .select("rep_first, rep_last, rep_phone, addr1, addr2, postcode, city, country, lat, lng")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    data: {
      firstName: family?.rep_first ?? "",
      lastName: family?.rep_last ?? "",
      phone: family?.rep_phone ?? profile?.phone ?? "",
      address: {
        addr1: family?.addr1 ?? profile?.addr1 ?? "",
        addr2: family?.addr2 ?? profile?.addr2 ?? "",
        postcode: family?.postcode ?? profile?.postcode ?? "",
        city: family?.city ?? profile?.city ?? "",
        country: family?.country ?? profile?.country ?? "France",
      },
      lat: family?.lat ?? profile?.lat ?? null,
      lng: family?.lng ?? profile?.lng ?? null,
    },
  });
}

export async function POST(request: Request) {
  const { user, role } = await getUserAndRole(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "family") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(
    { error: "Profile updates are restricted to staff/admin." },
    { status: 403 },
  );
}
