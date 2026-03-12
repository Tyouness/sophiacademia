import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { computeCourseBreakdown } from "@/lib/payroll/computeCourseBreakdown";
import { getMonthKey } from "@/lib/billing/period";
import { generateInvoicePDF } from "@/lib/billing/pdf";

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export function formatInvoiceNumber(year: number, seq: number) {
  return `FAC-${year}-${String(seq).padStart(5, "0")}`;
}

export async function generateSessionInvoice(params: {
  courseId: string;
}) {
  const supabase = createAdminSupabaseClient();

  const { data: existingLine } = await supabase
    .from("invoice_lines")
    .select("id, invoice_id")
    .eq("course_id", params.courseId)
    .maybeSingle();

  if (existingLine?.invoice_id) {
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id, number, family_id, total_ttc, status")
      .eq("id", existingLine.invoice_id)
      .maybeSingle();
    return existingInvoice;
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, family_id, subject, hours, course_date, created_at")
    .eq("id", params.courseId)
    .single();

  if (!course) {
    throw new Error("course_not_found");
  }

  const { data: familyProfile } = await supabase
    .from("family_profiles")
    .select("id, level")
    .eq("id", course.family_id)
    .maybeSingle();

  const baseDate = course.course_date ?? course.created_at ?? new Date().toISOString();
  const date = new Date(baseDate);
  const year = date.getUTCFullYear();
  const monthKey = getMonthKey(baseDate);

  const quantity = Number(course.hours ?? 0);
  const breakdown = computeCourseBreakdown({
    hours: quantity,
    level: familyProfile?.level ?? null,
    distanceKmOneWay: 0,
    distanceKmRoundTrip: 0,
    ikAmount: 0,
  });
  const clientUnitPrice = breakdown.client_price_per_hour;
  const total = roundMoney(breakdown.client_total);

  const { data: seqData } = await supabase
    .rpc("nextval", { sequence_name: "public.invoice_seq" })
    .single();
  const seq = seqData ? Number(Object.values(seqData)[0]) : 1;

  const issueDate = new Date().toISOString();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      family_id: course.family_id,
      number: formatInvoiceNumber(year, seq || 1),
      issue_date: issueDate,
      period_start: baseDate,
      period_end: baseDate,
      total_ttc: total,
      status: "issued",
      period: monthKey,
      total,
      hours: quantity,
    })
    .select("id, number, family_id, total_ttc, status")
    .single();

  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message ?? "invoice_create_failed");
  }

  const { error: lineError } = await supabase
    .from("invoice_lines")
    .insert({
      invoice_id: invoice.id,
      course_id: course.id,
      description: `Seance ${course.subject ?? "Cours"}`,
      quantity,
      unit_price: clientUnitPrice,
      total,
    });

  if (lineError) {
    throw new Error(lineError.message);
  }

  await generateInvoicePDF(invoice.id);

  return invoice;
}
