/**
 * PATCH /api/staff/users/update-urssaf-dossier
 *
 * Allows staff and admin to update the URSSAF-specific fields of a family dossier:
 *   - birthDate      : representative birth date (profiles.birth_date)
 *   - fiscalNumber   : SPI / numéro fiscal (urssaf_clients.fiscal_number, AES-encrypted)
 *
 * The fiscal_number is always stored encrypted. It is never returned in API responses.
 * If a urssaf_clients row does not yet exist for this family, it is created with status='pending'.
 *
 * Access: staff or admin only. Target user must have role='family'.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";
import { encryptSensitive } from "@/lib/security/crypto";
import { getClientIp, rateLimitSensitive } from "@/lib/security/rate-limit";
import { logAudit } from "@/lib/audit";

const payloadSchema = z.object({
  /** Target family user id */
  userId: z.string().uuid(),

  /**
   * Date de naissance du représentant légal (YYYY-MM-DD).
   * Stocké dans profiles.birth_date.
   */
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : YYYY-MM-DD")
    .optional(),

  /**
   * Numéro fiscal SPI (13 chiffres, format URSSAF Avance Immédiate).
   * Stocké chiffré dans urssaf_clients.fiscal_number.
   */
  fiscalNumber: z
    .string()
    .regex(/^\d{13}$/, "Le numéro fiscal doit comporter exactement 13 chiffres")
    .optional(),
});

export async function PATCH(request: Request) {
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

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (actorProfile?.role !== "staff" && actorProfile?.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden", correlationId },
      { status: 403 },
    );
  }

  const ip = getClientIp(request);
  const rate = await rateLimitSensitive(
    `staff:update-urssaf-dossier:${ip}:${user.id}`,
  );
  if (!rate.success) {
    return NextResponse.json(
      { error: "Too many requests", correlationId },
      { status: 429 },
    );
  }

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        details: err instanceof Error ? err.message : undefined,
        correlationId,
      },
      { status: 400 },
    );
  }

  const { userId, birthDate, fiscalNumber } = payload;

  if (!birthDate && !fiscalNumber) {
    return NextResponse.json(
      { error: "At least one field (birthDate or fiscalNumber) is required", correlationId },
      { status: 400 },
    );
  }

  const supabaseAdmin = createAdminSupabaseClient();

  // Verify target user is a family
  const { data: targetProfile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!targetProfile || targetProfile.role !== "family") {
    return NextResponse.json(
      { error: "Target user not found or not a family", correlationId },
      { status: 404 },
    );
  }

  // — Update birth_date on profiles —
  if (birthDate) {
    const { error: bdError } = await supabaseAdmin
      .from("profiles")
      .update({ birth_date: birthDate })
      .eq("id", userId);

    if (bdError) {
      return NextResponse.json(
        { error: bdError.message, correlationId },
        { status: 500 },
      );
    }
  }

  // — Upsert fiscal_number into urssaf_clients (encrypted) —
  if (fiscalNumber) {
    const encryptedFiscal = encryptSensitive(fiscalNumber);
    const now = new Date().toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from("urssaf_clients")
      .upsert(
        {
          family_id: userId,
          fiscal_number: encryptedFiscal,
          status: "pending",
          updated_at: now,
          created_at: now,
        },
        { onConflict: "family_id" },
      );

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message, correlationId },
        { status: 500 },
      );
    }
  }

  await logAudit({
    actorId: user.id,
    action: "family_urssaf_dossier_updated",
    entity: "profiles",
    entityId: userId,
    targetUserId: userId,
    payload: {
      birthDateUpdated: Boolean(birthDate),
      fiscalNumberUpdated: Boolean(fiscalNumber),
    },
  });

  return NextResponse.json({
    ok: true,
    birthDateUpdated: Boolean(birthDate),
    fiscalNumberUpdated: Boolean(fiscalNumber),
    correlationId,
  });
}
