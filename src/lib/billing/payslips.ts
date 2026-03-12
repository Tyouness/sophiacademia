import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getMonthKey } from "@/lib/billing/period";
import { computeMonthlyPayslip } from "@/lib/payroll/computeMonthlyPayslip";

export function formatPayslipNumber(year: number, seq: number) {
  return `PAY-${year}-${String(seq).padStart(5, "0")}`;
}

export async function appendPayslipLineForCourse(params: {
  courseId: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, professor_id, paid_at, course_date, created_at")
    .eq("id", params.courseId)
    .single();

  if (!course) {
    throw new Error("course_not_found");
  }

  const baseDate = course.paid_at ?? course.course_date ?? course.created_at ?? new Date().toISOString();
  const monthKey = getMonthKey(baseDate);

  const payslipId = await computeMonthlyPayslip({
    professorId: course.professor_id,
    period: monthKey,
  });

  if (!payslipId) {
    return null;
  }

  const { data: updatedPayslip } = await supabase
    .from("payslips")
    .select("id, number, professor_id, total_net, total_indemn_km, status")
    .eq("id", payslipId)
    .single();

  return updatedPayslip;
}
