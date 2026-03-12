import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getClientStatus, getPaymentStatus, submitInvoice } from "@/lib/urssaf/client";
import { logAudit } from "@/lib/audit";
import { handleCoursePaid } from "@/lib/billing/course-paid";

function formatCourseInvoiceNumber(date: Date, seq: number) {
  const year = date.getUTCFullYear();
  return `CI-${year}-${String(seq).padStart(6, "0")}`;
}

export async function createAndSubmitUrssafInvoice(params: {
  courseId: string;
  familyId: string;
  professorId: string;
  amount: number;
  description: string;
  actorId: string;
}) {
  const supabase = createAdminSupabaseClient();
  const now = new Date();

  const { data: seqData } = await supabase
    .rpc("nextval", { sequence_name: "public.invoice_seq" })
    .single();
  const seq = seqData ? Number(Object.values(seqData)[0]) : 1;
  const number = formatCourseInvoiceNumber(now, seq || 1);

  const { data: client, error: clientError } = await supabase
    .from("urssaf_clients")
    .select("id, urssaf_customer_id, status")
    .eq("family_id", params.familyId)
    .maybeSingle();

  if (clientError || !client?.urssaf_customer_id) {
    throw new Error("urssaf_client_missing");
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("course_invoices")
    .insert({
      course_id: params.courseId,
      family_id: params.familyId,
      professor_id: params.professorId,
      number,
      amount: params.amount,
      issued_at: now.toISOString(),
      sent_at: now.toISOString(),
      status: "issued",
    })
    .select("id, number")
    .single();

  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message ?? "invoice_create_failed");
  }

  const submitResult = await submitInvoice({
    invoiceId: invoice.id,
    familyUrssafCustomerId: client.urssaf_customer_id,
    amount: params.amount,
    issuedAt: now.toISOString(),
    description: params.description,
  });

  const { data: urssafInvoice, error: urssafInvoiceError } = await supabase
    .from("urssaf_invoices")
    .insert({
      invoice_id: invoice.id,
      urssaf_payment_id: submitResult.paymentId,
      status: submitResult.status,
      submitted_at: now.toISOString(),
    })
    .select("id, urssaf_payment_id, status")
    .single();

  if (urssafInvoiceError || !urssafInvoice) {
    throw new Error(urssafInvoiceError?.message ?? "urssaf_invoice_failed");
  }

  await logAudit({
    actorId: params.actorId,
    action: "urssaf_invoice_submitted",
    entity: "urssaf_invoice",
    entityId: urssafInvoice.id,
    payload: {
      courseId: params.courseId,
      invoiceId: invoice.id,
      urssafPaymentId: urssafInvoice.urssaf_payment_id,
      status: urssafInvoice.status,
    },
  });

  return {
    invoiceId: invoice.id,
    urssafInvoiceId: urssafInvoice.id,
    urssafPaymentId: urssafInvoice.urssaf_payment_id,
  };
}

export async function syncUrssafPaymentStatus(params: { actorId: string }) {
  const supabase = createAdminSupabaseClient();

  const { data: pending, error } = await supabase
    .from("urssaf_invoices")
    .select("id, invoice_id, urssaf_payment_id, status")
    .in("status", ["submitted", "pending_validation"])
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  let updated = 0;

  for (const item of pending ?? []) {
    if (!item.urssaf_payment_id) {
      continue;
    }

    const status = await getPaymentStatus(item.urssaf_payment_id);

    const nextStatus =
      status.status === "validated" || status.status === "paid"
        ? "paid_by_urssaf"
        : status.status;

    const { error: upError } = await supabase
      .from("urssaf_invoices")
      .update({
        status: nextStatus,
        validated_at: status.validatedAt ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (upError) {
      continue;
    }

    if (nextStatus === "paid_by_urssaf") {
      const { data: invoice } = await supabase
        .from("course_invoices")
        .select("id, course_id, professor_id, family_id")
        .eq("id", item.invoice_id)
        .maybeSingle();

      if (invoice?.course_id) {
        const paidAt = new Date().toISOString();
        const { data: course } = await supabase
          .from("courses")
          .update({ status: "paid_by_urssaf", paid_at: paidAt, updated_at: paidAt })
          .eq("id", invoice.course_id)
          .select("id, professor_id, family_id")
          .single();

        if (course) {
          await handleCoursePaid(
            {
              id: course.id,
              professor_id: course.professor_id,
              family_id: course.family_id,
              paid_at: paidAt,
            },
            params.actorId,
          );

          await logAudit({
            actorId: params.actorId,
            action: "urssaf_payment_validated",
            entity: "urssaf_invoice",
            entityId: item.id,
            payload: {
              courseId: course.id,
              paymentId: item.urssaf_payment_id,
            },
          });
        }
      }
    }

    updated += 1;
  }

  return { synced: updated };
}

/**
 * Re-fetch the registration status of a single URSSAF client from the URSSAF API
 * and persist the result in urssaf_clients.
 *
 * Only applies when:
 *  - a urssaf_clients row exists for this family
 *  - urssaf_customer_id is set (the initial registration call succeeded)
 *  - current status is NOT already 'registered'
 *
 * On success: updates status, sets registered_at if newly registered, clears last_error.
 * On URSSAF API error: writes the error to last_error, does NOT change status.
 */
export async function syncUrssafClientStatus(params: {
  familyId: string;
  actorId: string;
}): Promise<{
  previousStatus: string | null;
  newStatus: string;
  changed: boolean;
}> {
  const supabase = createAdminSupabaseClient();

  const { data: client } = await supabase
    .from("urssaf_clients")
    .select("id, urssaf_customer_id, status")
    .eq("family_id", params.familyId)
    .maybeSingle();

  if (!client) {
    throw new Error("urssaf_client_not_found");
  }
  if (!client.urssaf_customer_id) {
    throw new Error("urssaf_customer_id_missing");
  }
  if (client.status === "registered") {
    // Already confirmed — no API call needed.
    return { previousStatus: "registered", newStatus: "registered", changed: false };
  }

  const now = new Date().toISOString();
  let newStatus: string;

  try {
    const result = await getClientStatus(client.urssaf_customer_id);
    newStatus = result.status;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "unknown_error";
    await supabase
      .from("urssaf_clients")
      .update({ last_error: errorMessage.slice(0, 500), updated_at: now })
      .eq("id", client.id);

    await logAudit({
      actorId: params.actorId,
      action: "urssaf_client_registered",
      entity: "urssaf_client",
      entityId: client.id,
      payload: { familyId: params.familyId, syncAction: "status_check", success: false, error: errorMessage },
      targetUserId: params.familyId,
    });

    throw new Error(`urssaf_api_failed:${errorMessage}`);
  }

  const previousStatus = client.status as string;
  const justRegistered = newStatus === "registered" && previousStatus !== "registered";

  await supabase
    .from("urssaf_clients")
    .update({
      status: newStatus,
      last_error: null,
      ...(justRegistered ? { registered_at: now } : {}),
      updated_at: now,
    })
    .eq("id", client.id);

  await logAudit({
    actorId: params.actorId,
    action: "urssaf_client_registered",
    entity: "urssaf_client",
    entityId: client.id,
    payload: {
      familyId: params.familyId,
      syncAction: "status_check",
      success: true,
      previousStatus,
      newStatus,
    },
    targetUserId: params.familyId,
  });

  return { previousStatus, newStatus, changed: newStatus !== previousStatus };
}
