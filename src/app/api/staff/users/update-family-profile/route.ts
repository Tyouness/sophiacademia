/**
 * PATCH /api/staff/users/update-family-profile
 *
 * Allows staff and admin to update the family (employer) dossier fields:
 *   - repFirst / repLast   : representative name (family_profiles.rep_first/last)
 *   - repPhone             : representative phone (family_profiles.rep_phone)
 *   - fiscalConsent        : URSSAF fiscal consent (family_profiles.fiscal_consent)
 *   - mandateConsent       : SAP mandate consent (family_profiles.mandate_consent)
 *   - legalNoticeAccepted  : legal notice accepted (family_profiles.legal_notice_accepted)
 *
 * Access: staff or admin only.
 * All fields are optional — send only the fields you want to update.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/security/sanitize";
import { getClientIp, rateLimitSensitive } from "@/lib/security/rate-limit";
import { logAudit } from "@/lib/audit";

const payloadSchema = z.object({
  /** Target family user id */
  userId: z.string().uuid(),

  repFirst: z.string().trim().min(1).max(120).optional(),
  repLast: z.string().trim().min(1).max(120).optional(),
  repPhone: z.string().trim().max(30).optional(),

  fiscalConsent: z.boolean().optional(),
  mandateConsent: z.boolean().optional(),
  legalNoticeAccepted: z.boolean().optional(),
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
  const rate = await rateLimitSensitive(
    `staff:update-family-profile:${ip}:${user.id}`,
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
    const message = err instanceof Error ? err.message : "invalid_payload";
    return NextResponse.json({ error: message, correlationId }, { status: 400 });
  }

  const supabaseAdmin = createAdminSupabaseClient();

  // Confirm target is a family
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

  if (target.role !== "family") {
    return NextResponse.json(
      {
        error: "Family profile update is only available for family accounts",
        correlationId,
      },
      { status: 400 },
    );
  }

  // Build update object — only include provided fields
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.repFirst !== undefined) {
    update.rep_first = sanitizeText(payload.repFirst);
  }
  if (payload.repLast !== undefined) {
    update.rep_last = sanitizeText(payload.repLast);
  }
  if (payload.repPhone !== undefined) {
    update.rep_phone = sanitizeText(payload.repPhone);
  }
  if (payload.fiscalConsent !== undefined) {
    update.fiscal_consent = payload.fiscalConsent;
    if (payload.fiscalConsent) {
      update.urssaf_consent_at = new Date().toISOString();
    }
  }
  if (payload.mandateConsent !== undefined) {
    update.mandate_consent = payload.mandateConsent;
  }
  if (payload.legalNoticeAccepted !== undefined) {
    update.legal_notice_accepted = payload.legalNoticeAccepted;
  }

  const { error: updateError } = await supabaseAdmin
    .from("family_profiles")
    .upsert({ id: payload.userId, ...update }, { onConflict: "id" });

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message, correlationId },
      { status: 500 },
    );
  }

  await logAudit({
    actorId: user.id,
    action: "family_profile_updated",
    targetUserId: payload.userId,
    metadata: { fields: Object.keys(update).filter((k) => k !== "updated_at") },
  });

  return NextResponse.json({ success: true });
}
