import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { decryptSensitive } from "@/lib/security/crypto";
import { maskIban } from "@/lib/payroll/iban";

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

  if (role !== "professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone, addr1, addr2, postcode, city, country, lat, lng")
    .eq("id", user.id)
    .single();

  const { data: professor } = await supabase
    .from("professor_profiles")
    .select("car_hp, addr1, addr2, postcode, city, country, lat, lng, iban_encrypted, bic, gross_hourly_override")
    .eq("id", user.id)
    .single();

  // Decrypt and mask IBAN — never expose the raw value to the front-end
  let ibanMasked: string | null = null;
  if (professor?.iban_encrypted) {
    try {
      ibanMasked = maskIban(decryptSensitive(professor.iban_encrypted));
    } catch {
      // Decryption failure is non-fatal for the profile endpoint
      ibanMasked = null;
    }
  }

  return NextResponse.json({
    data: {
      firstName: profile?.full_name?.split(" ")[0] ?? "",
      lastName: profile?.full_name?.split(" ").slice(1).join(" ") ?? "",
      phone: profile?.phone ?? "",
      carHp: professor?.car_hp ?? null,
      address: {
        addr1: professor?.addr1 ?? profile?.addr1 ?? "",
        addr2: professor?.addr2 ?? profile?.addr2 ?? "",
        postcode: professor?.postcode ?? profile?.postcode ?? "",
        city: professor?.city ?? profile?.city ?? "",
        country: professor?.country ?? profile?.country ?? "France",
      },
      lat: professor?.lat ?? profile?.lat ?? null,
      lng: professor?.lng ?? profile?.lng ?? null,
      /** IBAN masked as "FR76 **** **** **** **** **** 123" — null if not set */
      ibanMasked,
      /** BIC/SWIFT code — null if not set */
      bic: professor?.bic ?? null,
      /**
       * Per-professor gross hourly override in €/h.
       * Null means the payroll engine uses the system default (FR_2026_01: 15.0 €/h).
       */
      grossHourlyOverride: professor?.gross_hourly_override != null
        ? Number(professor.gross_hourly_override)
        : null,
    },
  });
}

export async function POST(request: Request) {
  const { user, role } = await getUserAndRole(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(
    { error: "Profile updates are restricted to staff/admin." },
    { status: 403 },
  );
}
