/**
 * PATCH /api/staff/users/update-social
 *
 * Allows staff and admin to set or update sensitive social/banking data for professors:
 *   - nir: French social security number (NIR) — validated then AES-256-GCM encrypted before storage
 *   - iban: Banking IBAN — validated then AES-256-GCM encrypted before storage
 *   - bic: BIC/SWIFT code — stored as plain text (public bank identifier)
 *   - grossHourlyOverride: per-professor base gross hourly rate in EUR (nullable to reset to system default)
 *   - birthDate: date of birth ISO string (YYYY-MM-DD) — written to profiles.birth_date
 *
 * Access: staff or admin only.
 * All fields are optional — send only the fields you want to update.
 * Send explicit null for grossHourlyOverride to reset to the system default (FR_2026_01: 15.0 €/h).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";
import { encryptSensitive } from "@/lib/security/crypto";
import { validateNir } from "@/lib/payroll/nir";
import { validateIban, normaliseIban } from "@/lib/payroll/iban";
import { getClientIp, rateLimitSensitive } from "@/lib/security/rate-limit";

const payloadSchema = z.object({
  /** Target professor user id */
  userId: z.string().uuid(),

  /**
   * 15-digit French social security number (NIR), no spaces.
   * Will be validated then encrypted.
   */
  nir: z.string().trim().min(15).max(15).optional(),

  /**
   * IBAN (spaces allowed — will be normalised).
   * Will be validated then encrypted.
   */
  iban: z.string().trim().min(15).max(34).optional(),

  /** BIC/SWIFT code (8 or 11 alphanumeric characters). */
  bic: z.string().trim().regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/).optional(),

  /**
   * Per-professor gross hourly override in EUR.
   * Null resets to the system-wide default (FR_2026_01: 15.0 €/h).
   */
  grossHourlyOverride: z.number().min(0).max(500).nullable().optional(),

  /**
   * Date of birth in ISO format (YYYY-MM-DD).
   * Written to profiles.birth_date (visible to payroll engine).
   */
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function PATCH(request: Request) {
  const correlationId = crypto.randomUUID();
  const supabase = await createServerSupabaseClient({ canSetCookies: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", correlationId }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "staff" && profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden", correlationId }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rate = await rateLimitSensitive(`staff:update-social:${ip}:${user.id}`);
  if (!rate.success) {
    return NextResponse.json({ error: "Too many requests", correlationId }, { status: 429 });
  }

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid_payload";
    return NextResponse.json({ error: message, correlationId }, { status: 400 });
  }

  const supabaseAdmin = createAdminSupabaseClient();

  // Confirm target is a professor
  const { data: target, error: targetError } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", payload.userId)
    .single();

  if (targetError || !target) {
    return NextResponse.json({ error: "User not found", correlationId }, { status: 404 });
  }

  if (target.role !== "professor") {
    return NextResponse.json(
      { error: "Social data update is only available for professors", correlationId },
      { status: 400 },
    );
  }

  // Build the update object — only include provided fields
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (payload.nir !== undefined) {
    const normalised = payload.nir.replace(/\s+/g, "");
    const nirValidation = validateNir(normalised);
    if (!nirValidation.valid) {
      return NextResponse.json(
        { error: nirValidation.error ?? "nir_invalid", correlationId },
        { status: 422 },
      );
    }
    update.nir_encrypted = encryptSensitive(normalised);
  }

  if (payload.iban !== undefined) {
    const normalised = normaliseIban(payload.iban);
    const ibanValidation = validateIban(normalised);
    if (!ibanValidation.valid) {
      return NextResponse.json(
        { error: ibanValidation.error ?? "iban_invalid", correlationId },
        { status: 422 },
      );
    }
    update.iban_encrypted = encryptSensitive(normalised);
  }

  if (payload.bic !== undefined) {
    update.bic = payload.bic.toUpperCase();
  }

  if (payload.grossHourlyOverride !== undefined) {
    // null is accepted → clears the override (payroll engine returns to 15.0 default)
    update.gross_hourly_override = payload.grossHourlyOverride;
  }

  const { error: updateError } = await supabaseAdmin
    .from("professor_profiles")
    .upsert({ id: payload.userId, ...update }, { onConflict: "id" });

  if (updateError) {
    return NextResponse.json({ error: updateError.message, correlationId }, { status: 500 });
  }

  // birthDate is stored on profiles (not professor_profiles)
  if (payload.birthDate !== undefined) {
    const { error: profileBirthError } = await supabaseAdmin
      .from("profiles")
      .update({ birth_date: payload.birthDate, updated_at: new Date().toISOString() })
      .eq("id", payload.userId);

    if (profileBirthError) {
      return NextResponse.json(
        { error: profileBirthError.message, correlationId },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true });
}
