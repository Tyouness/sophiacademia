import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { decryptSensitive } from "@/lib/security/crypto";
import { registerClient } from "@/lib/urssaf/client";
import { logAudit } from "@/lib/audit";
import { rateLimitSensitive } from "@/lib/security/rate-limit";
import { runPreliveChecks } from "@/lib/prelive/runner";
import { checkOperationalGuard } from "@/lib/locks/operationalGuard";

const payloadSchema = z.object({
  familyId: z.string().uuid(),
});

type ProfileRole = "admin" | "staff" | "family" | "professor";

async function getUserAndRole(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  const supabase = await createServerSupabaseClient({ canSetCookies: true, accessToken });
  const {
    data: { user },
  } = accessToken ? await supabase.auth.getUser(accessToken) : await supabase.auth.getUser();

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

export async function POST(request: Request) {
  const { user, role } = await getUserAndRole(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (role !== "staff" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = request.headers.get("x-forwarded-for") ?? "";
  const rate = await rateLimitSensitive(`urssaf:register:${ip}:${user.id}`);
  if (!rate.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // ── Operational lock: block if prelive checks fail ────────────────────────
  const prelive = await runPreliveChecks();
  const guard = checkOperationalGuard(prelive);
  if (!guard.allowed) {
    return NextResponse.json(
      {
        error: "system_locked",
        reason: guard.reason,
        details: guard.details,
        actionLink: guard.actionLink,
      },
      { status: 423 },
    );
  }

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabaseAdmin = createAdminSupabaseClient();
  const [{ data: profile }, { data: family }, { data: urssafClient }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone, birth_date")
      .eq("id", payload.familyId)
      .single(),
    supabaseAdmin
      .from("family_profiles")
      .select("rep_first, rep_last, rep_phone, addr1, addr2, postcode, city, country, fiscal_consent, mandate_consent, legal_notice_accepted")
      .eq("id", payload.familyId)
      .single(),
    supabaseAdmin
      .from("urssaf_clients")
      .select("id, fiscal_number, status")
      .eq("family_id", payload.familyId)
      .maybeSingle(),
  ]);

  if (!profile || !family) {
    return NextResponse.json({ error: "family_not_found" }, { status: 404 });
  }

  // Guard: already registered — relaunching a 'registered' client is not allowed.
  // Relaunching a 'pending' client (status set by update-urssaf-dossier) is permitted.
  if (urssafClient?.status === "registered") {
    return NextResponse.json({ error: "already_registered" }, { status: 409 });
  }

  // Guard: individual field completeness (mirrors employerReadiness() checks).
  if (!profile.birth_date) {
    return NextResponse.json({ error: "missing_birth_date" }, { status: 422 });
  }
  if (!family.addr1) {
    return NextResponse.json({ error: "missing_address" }, { status: 422 });
  }
  if (!family.rep_first || !family.rep_last) {
    return NextResponse.json({ error: "missing_representative" }, { status: 422 });
  }

  if (!urssafClient?.fiscal_number || !family.fiscal_consent || !family.mandate_consent || !family.legal_notice_accepted) {
    return NextResponse.json({ error: "missing_legal_requirements" }, { status: 409 });
  }

  const fiscalNumber = decryptSensitive(urssafClient.fiscal_number);

  let result: { customerId: string; status: string };
  try {
    result = await registerClient({
    familyId: profile.id,
    firstName: family.rep_first ?? "",
    lastName: family.rep_last ?? "",
    birthDate: profile.birth_date,
    email: profile.email ?? "",
    // Prefer family_profiles.rep_phone (edited in dossier staff) with fallback to profiles.phone.
    // Both are in sync when the staff uses the dossier form; fallback covers old accounts.
    phone: family.rep_phone ?? profile.phone ?? "",
    fiscalNumber,
      address: {
        addr1: family.addr1 ?? "",
        addr2: family.addr2,
        postcode: family.postcode ?? "",
        city: family.city ?? "",
        country: family.country ?? "France",
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "unknown_error";
    // Best-effort: trace the error in urssaf_clients.last_error so staff can see it.
    if (urssafClient) {
      await supabaseAdmin
        .from("urssaf_clients")
        .update({ last_error: errorMessage.slice(0, 500), updated_at: new Date().toISOString() })
        .eq("id", urssafClient.id);
    }
    await logAudit({
      actorId: user.id,
      action: "urssaf_client_registered",
      entity: "urssaf_client",
      entityId: urssafClient?.id ?? null,
      payload: { familyId: payload.familyId, success: false, error: errorMessage },
      targetUserId: payload.familyId,
    });
    return NextResponse.json({ error: "urssaf_api_failed", detail: errorMessage }, { status: 502 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("urssaf_clients")
    .upsert(
      {
        family_id: profile.id,
        urssaf_customer_id: result.customerId,
        status: result.status,
        fiscal_number: urssafClient.fiscal_number,
        last_error: null,
        ...(result.status === "registered" ? { registered_at: now } : {}),
        updated_at: now,
      },
      { onConflict: "family_id" },
    )
    .select("id, family_id, urssaf_customer_id, status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "persist_failed" }, { status: 500 });
  }

  await logAudit({
    actorId: user.id,
    action: "urssaf_client_registered",
    entity: "urssaf_client",
    entityId: data.id,
    payload: { familyId: data.family_id, urssafCustomerId: data.urssaf_customer_id, status: data.status },
  });

  return NextResponse.json({ data });
}
