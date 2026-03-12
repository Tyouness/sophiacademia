import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { calculateProfPay } from "@/lib/pricing/prof";

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
  } = accessToken
    ? await supabase.auth.getUser(accessToken)
    : await supabase.auth.getUser();

  if (!user) {
    return { user: null, role: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return { user, role: (profile?.role ?? null) as ProfileRole | null };
}

export async function GET(request: Request) {
  const { user, role } = await getUserAndRole(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const distanceAllerKm = Number(url.searchParams.get("distanceAllerKm"));
  const hours = Number(url.searchParams.get("hours"));
  const carCvRaw = url.searchParams.get("carCv");
  const carCv = carCvRaw == null || carCvRaw === "" ? null : Number(carCvRaw);

  try {
    const data = calculateProfPay(distanceAllerKm, carCv, hours);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_input";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
