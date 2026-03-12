import crypto from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getMonthRange } from "@/lib/billing/period";
import { computeCourseBreakdown } from "@/lib/payroll/computeCourseBreakdown";
import { formatPayslipNumber } from "@/lib/billing/payslips";
import { generatePayslipPDF } from "@/lib/billing/pdf";
import { generateFamilyPayslipDocuments } from "@/lib/billing/family-payslip";
import type { FamilyDocResult } from "@/lib/billing/family-payslip";
import { persistPayslipContributions } from "@/lib/billing/payslip-contributions";
import type { EmployeeContribsDetail } from "@/lib/billing/payslip-contributions";

export type PaidCourseRow = {
  id: string;
  professor_id: string;
  family_id: string | null;
  hours: number | null;
  course_date: string | null;
  paid_at: string | null;
  distance_km_one_way: number | null;
  distance_km_round_trip: number | null;
  ik_amount: number | null;
  rate_set_version: string | null;
  pricing_policy_version: string | null;
  rounding_policy_version: string | null;
  subject?: string | null;
};

export type PayslipComputeResult = {
  period: string;
  courseIds: string[];
  lines: Array<{ courseId: string; hours: number; netAmount: number; indemnKm: number }>;
  grossTotal: number;
  netTotal: number;
  reimbursementsTotal: number;
  employerContribsTotal: number;
  totalHours: number;
  employeeContribsDetail: EmployeeContribsDetail;
  rateSetVersion: string;
  pricingPolicyVersion: string;
  roundingPolicyVersion: string;
  calculationHash: string;
};

export function computeMonthlyPayslipData(params: {
  period: string;
  courses: PaidCourseRow[];
  /** Per-professor gross hourly override (€/h). When null/undefined falls back to rate-set default. */
  baseGrossHourly?: number | null;
}): PayslipComputeResult {
  const { period, courses, baseGrossHourly } = params;
  const sorted = [...courses].sort((a, b) => a.id.localeCompare(b.id));
  const courseIds = sorted.map((course) => course.id);
  const lines: Array<{ courseId: string; hours: number; netAmount: number; indemnKm: number }> = [];

  let grossTotal = 0;
  let netTotal = 0;
  let reimbursementsTotal = 0;
  let employerContribsTotal = 0;
  let totalHours = 0;
  const employeeContribsDetail: EmployeeContribsDetail = {
    retraite_ss_plaf: 0,
    retraite_ss_deplaf: 0,
    agirc_arrco_t1: 0,
    ciid: 0,
    csg_deductible: 0,
    csg_non_deductible: 0,
    crds: 0,
    total: 0,
  };
  let rateSetVersion = "FR_2026_01";
  let pricingPolicyVersion = "pricing_v1";
  let roundingPolicyVersion = "rounding_v1";

  for (const course of sorted) {
    if (course.distance_km_one_way == null || course.ik_amount == null) {
      throw new Error(`missing_distance_or_ik:${course.id}`);
    }
    const hours = Number(course.hours ?? 0);
    const breakdown = computeCourseBreakdown({
      hours,
      distanceKmOneWay: Number(course.distance_km_one_way),
      distanceKmRoundTrip: Number(course.distance_km_round_trip ?? 0),
      ikAmount: Number(course.ik_amount),
      baseGrossHourly: baseGrossHourly ?? undefined,
      rateSetVersion: course.rate_set_version ?? undefined,
      pricingPolicyVersion: course.pricing_policy_version ?? undefined,
      roundingPolicyVersion: course.rounding_policy_version ?? undefined,
    });

    grossTotal += breakdown.gross_total;
    netTotal += breakdown.net_total;
    reimbursementsTotal += breakdown.reimbursements_total;
    employerContribsTotal += breakdown.employer_contribs_total;
    totalHours += hours;
    employeeContribsDetail.retraite_ss_plaf += breakdown.employee_contribs.retraite_ss_plaf;
    employeeContribsDetail.retraite_ss_deplaf += breakdown.employee_contribs.retraite_ss_deplaf;
    employeeContribsDetail.agirc_arrco_t1 += breakdown.employee_contribs.agirc_arrco_t1;
    employeeContribsDetail.ciid += breakdown.employee_contribs.ciid;
    employeeContribsDetail.csg_deductible += breakdown.employee_contribs.csg_deductible;
    employeeContribsDetail.csg_non_deductible += breakdown.employee_contribs.csg_non_deductible;
    employeeContribsDetail.crds += breakdown.employee_contribs.crds;
    employeeContribsDetail.total += breakdown.employee_contribs.total;

    lines.push({
      courseId: course.id,
      hours,
      netAmount: breakdown.net_total,
      indemnKm: breakdown.reimbursements_total,
    });

    rateSetVersion = breakdown.rate_set_version;
    pricingPolicyVersion = breakdown.pricing_policy_version;
    roundingPolicyVersion = breakdown.rounding_policy_version;
  }

  const payload = JSON.stringify({
    period,
    courseIds,
    grossTotal,
    netTotal,
    reimbursementsTotal,
    employerContribsTotal,
    totalHours,
    rateSetVersion,
    pricingPolicyVersion,
    roundingPolicyVersion,
  });
  const calculationHash = crypto.createHash("sha256").update(payload).digest("hex");

  // Round employee contrib detail amounts
  const roundedContribs: EmployeeContribsDetail = {
    retraite_ss_plaf: Number(employeeContribsDetail.retraite_ss_plaf.toFixed(2)),
    retraite_ss_deplaf: Number(employeeContribsDetail.retraite_ss_deplaf.toFixed(2)),
    agirc_arrco_t1: Number(employeeContribsDetail.agirc_arrco_t1.toFixed(2)),
    ciid: Number(employeeContribsDetail.ciid.toFixed(2)),
    csg_deductible: Number(employeeContribsDetail.csg_deductible.toFixed(2)),
    csg_non_deductible: Number(employeeContribsDetail.csg_non_deductible.toFixed(2)),
    crds: Number(employeeContribsDetail.crds.toFixed(2)),
    total: Number(employeeContribsDetail.total.toFixed(2)),
  };

  return {
    period,
    courseIds,
    lines,
    grossTotal: Number(grossTotal.toFixed(2)),
    netTotal: Number(netTotal.toFixed(2)),
    reimbursementsTotal: Number(reimbursementsTotal.toFixed(2)),
    employerContribsTotal: Number(employerContribsTotal.toFixed(2)),
    totalHours,
    employeeContribsDetail: roundedContribs,
    rateSetVersion,
    pricingPolicyVersion,
    roundingPolicyVersion,
    calculationHash,
  };
}

export async function computeMonthlyPayslip(params: {
  professorId: string;
  period: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { start, end } = getMonthRange(params.period);

  const { data: courses, error } = await supabase
    .from("courses")
    .select(
      "id, professor_id, family_id, hours, course_date, paid_at, distance_km_one_way, distance_km_round_trip, ik_amount, rate_set_version, pricing_policy_version, rounding_policy_version",
    )
    .eq("professor_id", params.professorId)
    .eq("status", "paid")
    .gte("paid_at", start)
    .lt("paid_at", end);

  if (error) {
    throw new Error(error.message);
  }

  if (!courses || courses.length === 0) {
    return null;
  }

  // Fetch per-professor gross hourly override (may be null → falls back to rate-set default)
  const { data: professorProfile } = await supabase
    .from("professor_profiles")
    .select("gross_hourly_override")
    .eq("id", params.professorId)
    .maybeSingle();

  const baseGrossHourly: number | null =
    professorProfile?.gross_hourly_override != null
      ? Number(professorProfile.gross_hourly_override)
      : null;

  const computed = computeMonthlyPayslipData({
    period: params.period,
    courses: courses as PaidCourseRow[],
    baseGrossHourly,
  });

  const { data: existing } = await supabase
    .from("payslips")
    .select("id, number")
    .eq("professor_id", params.professorId)
    .eq("period", params.period)
    .maybeSingle();

  let payslipNumber = existing?.number ?? null;
  if (!payslipNumber) {
    const { data: seqData, error: seqError } = await supabase
      .rpc("nextval", { sequence_name: "public.payslip_seq" })
      .single();
    const seqValue = seqData ? Number(Object.values(seqData)[0]) : 0;
    const year = Number(params.period.split("-")[0]);
    payslipNumber = formatPayslipNumber(year, seqError ? 1 : seqValue || 1);
  }

  const { data: payslip, error: upsertError } = await supabase
    .from("payslips")
    .upsert(
      {
        id: existing?.id ?? undefined,
        professor_id: params.professorId,
        family_id: null,
        period: params.period,
        period_start: start,
        period_end: end,
        number: payslipNumber,
        course_ids: computed.courseIds,
        rate_set_version: computed.rateSetVersion,
        pricing_policy_version: computed.pricingPolicyVersion,
        rounding_policy_version: computed.roundingPolicyVersion,
        gross_salary_total: computed.grossTotal,
        net_salary_total: computed.netTotal,
        reimbursements_total: computed.reimbursementsTotal,
        employer_contribs_total: computed.employerContribsTotal,
        calculation_hash: computed.calculationHash,
        total_net: computed.netTotal,
        total_indemn_km: computed.reimbursementsTotal,
        status: "pending",
      },
      { onConflict: "professor_id,period" },
    )
    .select("id")
    .single();

  if (upsertError || !payslip) {
    throw new Error(upsertError?.message ?? "payslip_upsert_failed");
  }

  const linePayload = computed.lines.map((line) => ({
    course_id: line.courseId,
    payslip_id: payslip.id,
    hours: line.hours,
    net_amount: line.netAmount,
    indemn_km: line.indemnKm,
  }));

  if (linePayload.length > 0) {
    const { error: lineError } = await supabase
      .from("payslip_lines")
      .upsert(linePayload, { onConflict: "course_id" });

    if (lineError) {
      throw new Error(lineError.message);
    }
  }

  // Persiste les cotisations détaillées avant génération PDF (non bloquant).
  let contribError: string | undefined;
  try {
    await persistPayslipContributions({
      payslipId: payslip.id,
      grossTotal: computed.grossTotal,
      totalHours: computed.totalHours,
      employeeContribsDetail: computed.employeeContribsDetail,
      rateSetVersion: computed.rateSetVersion,
    });
  } catch (err) {
    contribError = err instanceof Error ? err.message : "contrib_persist_failed";
    console.error("[computeMonthlyPayslip] persistPayslipContributions failed:", err);
  }

  await generatePayslipPDF(payslip.id);

  // Gère les documents de paie par famille / particulier employeur (couche SAP mandataire).
  // Non bloquant : une erreur ici n'invalide pas le bulletin maître.
  let familyDocResult: FamilyDocResult = { created: 0, failed: 0, errors: [] };
  try {
    familyDocResult = await generateFamilyPayslipDocuments(payslip.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "family_docs_failed";
    console.error("[computeMonthlyPayslip] generateFamilyPayslipDocuments failed:", err);
    familyDocResult = { created: 0, failed: 0, errors: [{ familyId: "ALL", message: msg }] };
  }

  return {
    payslipId: payslip.id,
    contribError,
    familyDocsCreated: familyDocResult.created,
    familyDocsFailed: familyDocResult.failed,
    familyDocErrors: familyDocResult.errors,
  };
}

/** Résultat par professeur produit par computeMonthlyPayslipsForPeriod. */
export type ProfessorRunResult = {
  professorId: string;
  payslipId: string | null;
  /** Erreur fatale ayant empêché la génération du bulletin (ex. missing_distance_or_ik). */
  error?: string;
  /** Erreur non bloquante lors de la persistance des cotisations détaillées. */
  contribError?: string;
  familyDocsCreated: number;
  familyDocsFailed: number;
  familyDocErrors: Array<{ familyId: string; message: string }>;
};

export async function computeMonthlyPayslipsForPeriod(period: string) {
  const supabase = createAdminSupabaseClient();
  const { start, end } = getMonthRange(period);

  const { data: professors, error } = await supabase
    .from("courses")
    .select("professor_id")
    .eq("status", "paid")
    .gte("paid_at", start)
    .lt("paid_at", end);

  if (error) {
    throw new Error(error.message);
  }

  const ids = Array.from(new Set((professors ?? []).map((row) => row.professor_id)));
  const results: ProfessorRunResult[] = [];

  for (const professorId of ids) {
    try {
      const res = await computeMonthlyPayslip({ professorId, period });
      if (res === null) {
        // No paid courses this period — not an error
        results.push({
          professorId,
          payslipId: null,
          familyDocsCreated: 0,
          familyDocsFailed: 0,
          familyDocErrors: [],
        });
      } else {
        results.push({
          professorId,
          payslipId: res.payslipId,
          contribError: res.contribError,
          familyDocsCreated: res.familyDocsCreated,
          familyDocsFailed: res.familyDocsFailed,
          familyDocErrors: res.familyDocErrors,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      console.error(
        `[computeMonthlyPayslipsForPeriod] professor=${professorId} error: ${message}`,
      );
      results.push({
        professorId,
        payslipId: null,
        error: message,
        familyDocsCreated: 0,
        familyDocsFailed: 0,
        familyDocErrors: [],
      });
    }
  }

  return results;
}
