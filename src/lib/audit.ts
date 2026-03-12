import { createAdminSupabaseClient } from "@/lib/supabase/server";

export type AuditAction =
  | "user_invited"
  | "user_disabled"
  | "user_enabled"
  | "user_deleted"
  | "user_deleted_hard"
  | "role_set"
  | "request_created"
  | "request_coords_sent"
  | "request_approved"
  | "request_rejected"
  | "request_detached"
  | "request_schedule_set"
  | "urssaf_client_registered"
  | "urssaf_invoice_submitted"
  | "urssaf_payment_validated"
  | "course_declared"
  | "course_family_confirmed"
  | "course_family_update_requested"
  | "course_staff_corrected"
  | "course_staff_canceled"
  | "course_paid"
  | "invoice_generated"
  | "monthly_statement_generated"
  | "payslip_generated"
  | "auto_paid"
  | "child_created"
  | "child_updated"
  | "family_profile_updated"
  | "professor_social_updated"
  | "family_urssaf_dossier_updated"
  | "pilot_launched"
  | "pilot_closed"
  | "pilot_abandoned";

export async function logAudit(params: {
  actorId: string;
  action: AuditAction;
  entity?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  targetUserId?: string | null;
  roleSet?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabaseAdmin = createAdminSupabaseClient();
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    actor_id: params.actorId,
    action: params.action,
    entity: params.entity ?? null,
    entity_id: params.entityId ?? null,
    payload: params.payload ?? {},
    target_user_id: params.targetUserId ?? null,
    role_set: params.roleSet ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
}
