import { getMonthKey } from "@/lib/billing/period";
import { generateSessionInvoice } from "@/lib/billing/invoices";
import { appendPayslipLineForCourse } from "@/lib/billing/payslips";
import { logAudit } from "@/lib/audit";

type PaidCourse = {
  id: string;
  professor_id: string;
  family_id: string;
  paid_at?: string | null;
  created_at?: string | null;
};

export async function handleCoursePaid(
  course: PaidCourse,
  actorId: string,
) {
  const paidAt = course.paid_at ?? course.created_at ?? new Date().toISOString();
  const monthKey = getMonthKey(paidAt);

  const invoice = await generateSessionInvoice({
    courseId: course.id,
  });

  if (invoice) {
    await logAudit({
      actorId,
      action: "invoice_generated",
      entity: "invoice",
      entityId: invoice.id,
      payload: {
        courseId: course.id,
        familyId: course.family_id,
        number: invoice.number,
        totalTtc: invoice.total_ttc,
      },
    });
  }

  const payslip = await appendPayslipLineForCourse({
    courseId: course.id,
  });

  if (payslip) {
    await logAudit({
      actorId,
      action: "payslip_generated",
      entity: "payslip",
      entityId: payslip.id,
      payload: {
        professorId: course.professor_id,
        familyId: course.family_id,
        period: monthKey,
      },
    });
  }

  return { invoice, payslip, monthKey };
}
