/**
 * pilot/runner.ts — URSSAF-14
 *
 * Fetche les données depuis Supabase et délègue le calcul à
 * computePairEligibility() / computePilotEligibilityReport().
 *
 * Réutilise runConsistencyChecks() pour les anomalies de cohérence.
 * Ne duplique pas les requêtes professor/family readiness : elles sont
 * refaites ici de manière ciblée sur les pairs actifs (cours payés).
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { runConsistencyChecks } from "@/lib/consistency/runner";
import {
  professorPayrollReadiness,
  familyCompleteness,
} from "@/lib/dossier/completeness";
import {
  computePairEligibility,
  computePilotEligibilityReport,
  type PilotEligibilityReport,
} from "./eligibility";

const LOOKBACK_DAYS = 365;

export type PilotChecksResult = {
  report: PilotEligibilityReport;
  /**
   * true si un run mensuel est bloqué en statut "running" > 30 min.
   * Dans ce cas, aucun nouveau run ne peut être lancé (re-entrance guard).
   */
  preliveBlocked: boolean;
  /** Raisons du blocage pré-live global (vide si !preliveBlocked) */
  preliveBlockers: string[];
};

export async function runPilotEligibilityChecks(): Promise<PilotChecksResult> {
  const supabase = createAdminSupabaseClient();
  const since = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // ── 1. Rapport de cohérence ────────────────────────────────────────────────
  // Source pour les anomalies E4 (cours sans ligne de bulletin) et pour
  // déterminer si un run est bloqué (preliveBlocked).
  const anomalyReport = await runConsistencyChecks();

  // Cours flaggés comme absents de payslip_lines (critère E4)
  const criticalCourseIds = new Set(
    anomalyReport.anomalies
      .filter((a) => a.code === "paid_course_without_payslip_line")
      .map((a) => a.entityId),
  );

  // Blocage global : run bloqué en statut "running"
  const stuckRunsCount = anomalyReport.anomalies.filter(
    (a) => a.code === "payroll_run_stuck_running",
  ).length;

  const preliveBlockers: string[] = [];
  if (stuckRunsCount > 0) {
    preliveBlockers.push(
      `${stuckRunsCount} run(s) bloqué(s) en statut « running » — impossible de lancer un nouveau run`,
    );
  }

  // ── 2. Cours payés → construction des paires ──────────────────────────────
  const { data: paidCourses } = await supabase
    .from("courses")
    .select("id, professor_id, family_id")
    .eq("status", "paid")
    .gte("paid_at", since)
    .order("paid_at", { ascending: false })
    .limit(500);

  // pairMap : key "profId:famId" → { count, courseIds }
  const pairMap = new Map<
    string,
    {
      professorId: string;
      familyId: string;
      count: number;
      courseIds: string[];
    }
  >();

  for (const course of paidCourses ?? []) {
    const key = `${course.professor_id}:${course.family_id}`;
    if (!pairMap.has(key)) {
      pairMap.set(key, {
        professorId: course.professor_id,
        familyId: course.family_id,
        count: 0,
        courseIds: [],
      });
    }
    const entry = pairMap.get(key)!;
    entry.count++;
    entry.courseIds.push(course.id);
  }

  const uniqueProfessorIds = [
    ...new Set((paidCourses ?? []).map((c) => c.professor_id)),
  ];
  const uniqueFamilyIds = [
    ...new Set((paidCourses ?? []).map((c) => c.family_id)),
  ];

  // ── 3. Données professeurs ─────────────────────────────────────────────────
  const [{ data: profProfiles }, { data: profBaseProfiles }] = await Promise.all(
    [
      supabase
        .from("professor_profiles")
        .select("id, nir_encrypted, iban_encrypted, bic, addr1, postcode, city")
        .in("id", uniqueProfessorIds.length > 0 ? uniqueProfessorIds : ["__none__"]),
      supabase
        .from("profiles")
        .select("id, full_name, birth_date")
        .in("id", uniqueProfessorIds.length > 0 ? uniqueProfessorIds : ["__none__"]),
    ],
  );

  const profProfileMap = new Map(
    (profProfiles ?? []).map((p) => [p.id, p]),
  );
  const profBaseMap = new Map(
    (profBaseProfiles ?? []).map((p) => [p.id, p]),
  );

  // ── 4. Données familles ────────────────────────────────────────────────────
  const [{ data: famProfiles }, { data: famBaseProfiles }] = await Promise.all([
    supabase
      .from("family_profiles")
      .select(
        "id, rep_first, rep_last, rep_phone, addr1, fiscal_consent, mandate_consent, legal_notice_accepted",
      )
      .in("id", uniqueFamilyIds.length > 0 ? uniqueFamilyIds : ["__none__"]),
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", uniqueFamilyIds.length > 0 ? uniqueFamilyIds : ["__none__"]),
  ]);

  const famProfileMap = new Map(
    (famProfiles ?? []).map((p) => [p.id, p]),
  );
  const famBaseMap = new Map(
    (famBaseProfiles ?? []).map((p) => [p.id, p]),
  );

  // ── 5. Calcul readiness par professeur ────────────────────────────────────
  const profReadinessMap = new Map<
    string,
    { ready: boolean; missingFields: string[] }
  >();
  for (const professorId of uniqueProfessorIds) {
    const pp = profProfileMap.get(professorId);
    const bp = profBaseMap.get(professorId);
    const result = professorPayrollReadiness({
      full_name: bp?.full_name ?? null,
      birth_date: bp?.birth_date ?? null,
      addr1: pp?.addr1 ?? null,
      postcode: pp?.postcode ?? null,
      city: pp?.city ?? null,
      hasNir: Boolean(pp?.nir_encrypted),
      hasIban: Boolean(pp?.iban_encrypted),
      bic: pp?.bic ?? null,
    });
    profReadinessMap.set(professorId, {
      ready: result.status === "payroll_ready",
      missingFields: result.missingFields,
    });
  }

  // ── 6. Calcul readiness par famille ───────────────────────────────────────
  const famReadinessMap = new Map<
    string,
    { ready: boolean; missingFields: string[] }
  >();
  for (const familyId of uniqueFamilyIds) {
    const fp = famProfileMap.get(familyId);
    const result = familyCompleteness({
      rep_first: fp?.rep_first ?? null,
      rep_last: fp?.rep_last ?? null,
      rep_phone: fp?.rep_phone ?? null,
      addr1: fp?.addr1 ?? null,
      fiscal_consent: fp?.fiscal_consent ?? null,
      mandate_consent: fp?.mandate_consent ?? null,
      legal_notice_accepted: fp?.legal_notice_accepted ?? null,
    });
    famReadinessMap.set(familyId, {
      ready: result.status === "payroll_ready",
      missingFields: result.missingFields,
    });
  }

  // ── 7. Calcul éligibilité par paire ───────────────────────────────────────
  const pairResults = [];
  for (const [, pair] of pairMap) {
    const profReadiness = profReadinessMap.get(pair.professorId) ?? {
      ready: false,
      missingFields: ["Dossier professeur introuvable"],
    };
    const famReadiness = famReadinessMap.get(pair.familyId) ?? {
      ready: false,
      missingFields: ["Dossier famille introuvable"],
    };

    const hasCourseWithoutPayslipLine = pair.courseIds.some((id) =>
      criticalCourseIds.has(id),
    );

    pairResults.push(
      computePairEligibility({
        professorId: pair.professorId,
        professorName: profBaseMap.get(pair.professorId)?.full_name ?? null,
        familyId: pair.familyId,
        familyName: famBaseMap.get(pair.familyId)?.full_name ?? null,
        paidCoursesCount: pair.count,
        professorPayrollReady: profReadiness.ready,
        professorMissingFields: profReadiness.missingFields,
        familyPayrollReady: famReadiness.ready,
        familyMissingFields: famReadiness.missingFields,
        hasCourseWithoutPayslipLine,
      }),
    );
  }

  return {
    report: computePilotEligibilityReport(pairResults),
    preliveBlocked: preliveBlockers.length > 0,
    preliveBlockers,
  };
}
