import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/security/sanitize";
import { getClientIp, rateLimitSensitive } from "@/lib/security/rate-limit";
import { buildAddressHash, buildAddressLine, geocodeAddress } from "@/lib/geo/google";

const addressSchema = z.object({
  addr1: z.string().trim().min(1).max(200),
  addr2: z.string().trim().max(200).optional().or(z.literal("")),
  postcode: z.string().trim().min(1).max(32),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(120),
});

const payloadSchema = z.object({
  userId: z.string().uuid(),
  address: addressSchema,
});

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const supabase = await createServerSupabaseClient({ canSetCookies: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", correlationId },
      { status: 401 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "staff" && profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden", correlationId },
      { status: 403 },
    );
  }

  const ip = getClientIp(request);
  const rate = await rateLimitSensitive(`staff:update-address:${ip}:${user.id}`);
  if (!rate.success) {
    return NextResponse.json(
      { error: "Too many requests", correlationId },
      { status: 429 },
    );
  }

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid payload", correlationId },
      { status: 400 },
    );
  }

  const supabaseAdmin = createAdminSupabaseClient();
  const { data: target, error: targetError } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", payload.userId)
    .single();

  if (targetError || !target) {
    return NextResponse.json(
      { error: "User not found", correlationId },
      { status: 404 },
    );
  }

  if (target.role !== "family" && target.role !== "professor") {
    return NextResponse.json(
      { error: "Invalid role", correlationId },
      { status: 400 },
    );
  }

  const address = {
    addr1: sanitizeText(payload.address.addr1),
    addr2: payload.address.addr2 ? sanitizeText(payload.address.addr2) : "",
    postcode: sanitizeText(payload.address.postcode),
    city: sanitizeText(payload.address.city),
    country: sanitizeText(payload.address.country),
  };

  const addressLine = buildAddressLine(address);
  const addressHash = buildAddressHash(addressLine);

  let lat: number | null = null;
  let lng: number | null = null;
  try {
    const geocoded = await geocodeAddress(addressLine);
    lat = geocoded.location.lat;
    lng = geocoded.location.lng;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Geocode failed";
    return NextResponse.json(
      { error: message, correlationId },
      { status: 422 },
    );
  }

  const now = new Date().toISOString();

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      addr1: address.addr1,
      addr2: address.addr2,
      postcode: address.postcode,
      city: address.city,
      country: address.country,
      lat,
      lng,
      address_hash: addressHash,
      geocoded_at: now,
      updated_at: now,
    })
    .eq("id", payload.userId);

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message, correlationId },
      { status: 500 },
    );
  }

  if (target.role === "family") {
    const { error: familyError } = await supabaseAdmin
      .from("family_profiles")
      .upsert(
        {
          id: payload.userId,
          addr1: address.addr1,
          addr2: address.addr2,
          postcode: address.postcode,
          city: address.city,
          country: address.country,
          address: address.addr1,
          lat,
          lng,
          address_hash: addressHash,
          geocoded_at: now,
          updated_at: now,
        },
        { onConflict: "id" },
      );

    if (familyError) {
      return NextResponse.json(
        { error: familyError.message, correlationId },
        { status: 500 },
      );
    }
  }

  if (target.role === "professor") {
    const { error: professorError } = await supabaseAdmin
      .from("professor_profiles")
      .upsert(
        {
          id: payload.userId,
          addr1: address.addr1,
          addr2: address.addr2,
          postcode: address.postcode,
          city: address.city,
          country: address.country,
          address: address.addr1,
          lat,
          lng,
          address_hash: addressHash,
          geocoded_at: now,
          updated_at: now,
        },
        { onConflict: "id" },
      );

    if (professorError) {
      return NextResponse.json(
        { error: professorError.message, correlationId },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true, data: { lat, lng } });
}
