/**
 * pilot/validation-runner.ts — URSSAF-15
 *
 * Fetche les données depuis Supabase et délègue le calcul à
 * checkPilotArtifacts() / computePilotValidationReport().
 *
 * Niveau d'évaluation : (professorId, period) — granularité du payslip.
 *
 * Réutilise runConsistencyChecks() pour les anomalies critiques scopées.
 * Ne ré-implémente pas la logique métier — uniquement l'assemblage des données.
 *
 * Fenêtre d'analyse : 12 mois glissants (LOOKBACK_DAYS = 365).
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { runConsistencyChecks } from "@/lib/consistency/runner";
import {
  checkPilotArtifacts,
  computePilotValidationReport,
  type PilotValidationReport,
  type PilotValidationResult,
} from "./validation";

const LOOKBACK_DAYS = 365;

export async function runPilotValidation(): Promise<PilotValidationReport> {
  const supabase = createAdminSupabaseClient();
  const since = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // ── 1. Anomalies critiques (A7) ────────────────────────────────────────────
  const anomalyReport = await runConsistencyChecks();
  const criticalEntityIds = new Set(
    anomalyReport.anomalies
      .filter((a) => a.severity === "critique")
      .map((a) => a.entityId),
  );

  // ── 2. Cours payés (derniers 12 mois, max 500) ─────────────────────────────
  const { data: paidCourses } = await supabase
    .from("courses")
    .select("id, professor_id, family_id, paid_at")
    .eq("status", "paid")
    .gte("paid_at", since)
    .order("paid_at", { ascending: false })
    .limit(500);

  if (!paidCourses?.length) {
    return computePilotValidationReport([]);
  }

  // ── 3. Construction des groupes (professorId, period) ─────────────────────
  type Group = {
    professorId: string;
    period: string;
    courseIds: string[];
    familyIds: Set<string>;
  };
  const groupMap = new Map<string, Group>();

  for (const c of paidCourses) {
    // paid_at est stocké en ISO — les 7 premiers chars donnent "YYYY-MM"
    const period = c.paid_at?.substring(0, 7) ?? "";
    if (!period) continue;
    const key = `${c.professor_id}:${period}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        professorId: c.professor_id,
        period,
        courseIds: [],
        familyIds: new Set(),
      });
    }
    const g = groupMap.get(key)!;
    g.courseIds.push(c.id);
    if (c.family_id) g.familyIds.add(c.family_id);
  }

  const uniqueProfIds = [
    ...new Set(paidCourses.map((c) => c.professor_id)),
  ];
  const uniquePeriods = [
    ...new Set([...groupMap.values()].map((g) => g.period)),
  ];

  // ── 4. Noms des professeurs ─────────────────────────────────────────────────
  const { data: profNames } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", uniqueProfIds.length > 0 ? uniqueProfIds : ["__none__"]);

  const profNameMap = new Map(
    (profNames ?? []).map((p) => [p.id, p.full_name as string | null]),
  );

  // ── 5. Bulletins pour les (professor_id, period) concernés ─────────────────
  const { data: payslips } = await supabase
    .from("payslips")
    .select("id, professor_id, period, number")
    .in("professor_id", uniqueProfIds.length > 0 ? uniqueProfIds : ["__none__"])
    .in("period", uniquePeriods.length > 0 ? uniquePeriods : ["__none__"]);

  // payslipMap : key "professorId:period" → { id, number }
  const payslipMap = new Map<string, { id: string; number: string | null }>();
  for (const p of payslips ?? []) {
    payslipMap.set(`${p.professor_id}:${p.period}`, {
      id: p.id,
      number: p.number as string | null,
    });
  }

  const allPayslipIds = (payslips ?? []).map((p) => p.id);

  // ── 6. Lignes de bulletin par payslip ──────────────────────────────────────
  const lineCountMap = new Map<string, number>();
  if (allPayslipIds.length > 0) {
    const { data: lines } = await supabase
      .from("payslip_lines")
      .select("payslip_id")
      .in("payslip_id", allPayslipIds);
    for (const l of lines ?? []) {
      lineCountMap.set(l.payslip_id, (lineCountMap.get(l.payslip_id) ?? 0) + 1);
    }
  }

  // ── 7. Cotisations sociales par payslip ────────────────────────────────────
  const contribCountMap = new Map<string, number>();
  if (allPayslipIds.length > 0) {
    const { data: contribs } = await supabase
      .from("payslip_contribution_lines")
      .select("payslip_id")
      .in("payslip_id", allPayslipIds);
    for (const c of contribs ?? []) {
      contribCountMap.set(
        c.payslip_id,
        (contribCountMap.get(c.payslip_id) ?? 0) + 1,
      );
    }
  }

  // ── 8. Documents famille : (payslip_id, family_id) ────────────────────────
  // Clé composite "payslipId:familyId" pour lookup O(1)
  const familyDocSet = new Set<string>();
  if (allPayslipIds.length > 0) {
    const { data: docs } = await supabase
      .from("payslip_family_documents")
      .select("payslip_id, family_id")
      .in("payslip_id", allPayslipIds);
    for (const d of docs ?? []) {
      familyDocSet.add(`${d.payslip_id}:${d.family_id}`);
    }
  }

  // ── 9. Calcul de validation par groupe ────────────────────────────────────
  const validationResults = [];

  for (const [, group] of groupMap) {
    const payslipEntry = payslipMap.get(
      `${group.professorId}:${group.period}`,
    );
    const payslipId = payslipEntry?.id ?? null;
    const payslipNumber = payslipEntry?.number ?? null;

    const familiesInScope = [...group.familyIds];
    const familiesWithDocument = payslipId
      ? familiesInScope.filter((fid) =>
          familyDocSet.has(`${payslipId}:${fid}`),
        )
      : [];

    // Anomalies critiques portant sur un courseId ou le payslipId du périmètre
    const scopeIds = new Set([
      ...group.courseIds,
      ...(payslipId ? [payslipId] : []),
    ]);
    const criticalAnomalyCount = [...scopeIds].filter((id) =>
      criticalEntityIds.has(id),
    ).length;

    validationResults.push(
      checkPilotArtifacts({
        professorId: group.professorId,
        professorName: profNameMap.get(group.professorId) ?? null,
        period: group.period,
        paidCoursesCount: group.courseIds.length,
        paidCourseIds: group.courseIds,
        payslipId,
        payslipNumber,
        payslipLinesCount: payslipId
          ? (lineCountMap.get(payslipId) ?? 0)
          : 0,
        contributionLinesCount: payslipId
          ? (contribCountMap.get(payslipId) ?? 0)
          : 0,
        familiesInScope,
        familiesWithDocument,
        criticalAnomalyCount,
      }),
    );
  }

  return computePilotValidationReport(validationResults);
}

/**
 * Évalue les artefacts de validation pour un seul (professorId, period).
 * Requêtes ciblées — utilisé par la route de clôture d'un pilote.
 *
 * Retourne null si aucun cours payé n'est trouvé pour ce couple.
 */
export async function runPilotValidationForPair(
  professorId: string,
  period: string,
): Promise<PilotValidationResult | null> {
  const supabase = createAdminSupabaseClient();

  // Il faut que paid_at commence par la période (ex. "2026-02")
  const periodStart = `${period}-01`;
  const [year, month] = period.split("-").map(Number);
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const periodEnd = `${nextMonth}-01`;

  // ── 1. Anomalies critiques ─────────────────────────────────────────────────
  const anomalyReport = await runConsistencyChecks();
  const criticalEntityIds = new Set(
    anomalyReport.anomalies
      .filter((a) => a.severity === "critique")
      .map((a) => a.entityId),
  );

  // ── 2. Cours payés du professeur dans la période ───────────────────────────
  const { data: paidCourses } = await supabase
    .from("courses")
    .select("id, family_id, paid_at")
    .eq("status", "paid")
    .eq("professor_id", professorId)
    .gte("paid_at", periodStart)
    .lt("paid_at", periodEnd);

  const courseIds = (paidCourses ?? []).map((c) => c.id);
  const familyIds = new Set(
    (paidCourses ?? []).map((c) => c.family_id).filter(Boolean) as string[],
  );

  // ── 3. Nom du professeur ───────────────────────────────────────────────────
  const { data: profProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", professorId)
    .single();

  const professorName = (profProfile?.full_name as string | null) ?? null;

  // ── 4. Bulletin pour (professor_id, period) ────────────────────────────────
  const { data: payslipRow } = await supabase
    .from("payslips")
    .select("id, number")
    .eq("professor_id", professorId)
    .eq("period", period)
    .maybeSingle();

  const payslipId = payslipRow?.id ?? null;
  const payslipNumber = (payslipRow?.number as string | null) ?? null;

  // ── 5. Lignes de bulletin ──────────────────────────────────────────────────
  let payslipLinesCount = 0;
  let contributionLinesCount = 0;
  const familyDocSet = new Set<string>();

  if (payslipId) {
    const [{ data: lines }, { data: contribs }, { data: docs }] =
      await Promise.all([
        supabase
          .from("payslip_lines")
          .select("payslip_id")
          .eq("payslip_id", payslipId),
        supabase
          .from("payslip_contribution_lines")
          .select("payslip_id")
          .eq("payslip_id", payslipId),
        supabase
          .from("payslip_family_documents")
          .select("family_id")
          .eq("payslip_id", payslipId),
      ]);

    payslipLinesCount = lines?.length ?? 0;
    contributionLinesCount = contribs?.length ?? 0;
    for (const d of docs ?? []) {
      familyDocSet.add(d.family_id as string);
    }
  }

  // ── 6. Calcul validation ───────────────────────────────────────────────────
  const familiesInScope = [...familyIds];
  const familiesWithDocument = familiesInScope.filter((fid) =>
    familyDocSet.has(fid),
  );

  const scopeIds = new Set([...courseIds, ...(payslipId ? [payslipId] : [])]);
  const criticalAnomalyCount = [...scopeIds].filter((id) =>
    criticalEntityIds.has(id),
  ).length;

  return checkPilotArtifacts({
    professorId,
    professorName,
    period,
    paidCoursesCount: courseIds.length,
    paidCourseIds: courseIds,
    payslipId,
    payslipNumber,
    payslipLinesCount,
    contributionLinesCount,
    familiesInScope,
    familiesWithDocument,
    criticalAnomalyCount,
  });
}
