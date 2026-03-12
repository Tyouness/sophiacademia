/**
 * consistency/runner.ts — URSSAF-11
 *
 * Fetche les données nécessaires depuis Supabase (admin client) et délègue
 * la détection d'anomalies aux fonctions pures de checks.ts.
 *
 * Fenêtre d'analyse : 12 mois glissants (LOOKBACK_DAYS).
 * Limites : LIMIT 500 sur courses, 200 sur payslips — évite les requêtes lentes.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { runChecks, type AnomalyReport } from "./checks";
import {
  professorPayrollReadiness,
  employerReadiness,
} from "@/lib/dossier/completeness";

const LOOKBACK_DAYS = 365;
/** Durée au-delà de laquelle un run `running` est considéré bloqué (minutes) */
const STUCK_RUN_MINUTES = 30;

export async function runConsistencyChecks(): Promise<AnomalyReport> {
  const supabase = createAdminSupabaseClient();

  const since = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const stuckThreshold = new Date(
    Date.now() - STUCK_RUN_MINUTES * 60 * 1000,
  ).toISOString();

  // ── 1. Cours payés (12 derniers mois, max 500) ───────────────────────────
  const { data: paidCourses } = await supabase
    .from("courses")
    .select("id, professor_id, family_id, paid_at")
    .eq("status", "paid")
    .gte("paid_at", since)
    .order("paid_at", { ascending: false })
    .limit(500);

  const paidCourseIds = (paidCourses ?? []).map((c) => c.id);

  // ── 2. course_id présents dans payslip_lines ─────────────────────────────
  const lineCourseIds = new Set<string>();
  if (paidCourseIds.length > 0) {
    const { data: lines } = await supabase
      .from("payslip_lines")
      .select("course_id")
      .in("course_id", paidCourseIds);
    for (const l of lines ?? []) lineCourseIds.add(l.course_id);
  }

  // ── 3. Bulletins récents (12 mois, max 200) ──────────────────────────────
  const { data: payslips } = await supabase
    .from("payslips")
    .select("id, professor_id, period, number")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  const payslipIds = (payslips ?? []).map((p) => p.id);

  // ── 4. payslip_id ayant des cotisations ─────────────────────────────────
  const payslipIdsWithContribs = new Set<string>();
  if (payslipIds.length > 0) {
    const { data: contribs } = await supabase
      .from("payslip_contribution_lines")
      .select("payslip_id")
      .in("payslip_id", payslipIds);
    for (const c of contribs ?? []) payslipIdsWithContribs.add(c.payslip_id);
  }

  // ── 5. payslip_id ayant des documents famille ────────────────────────────
  const payslipIdsWithFamilyDocs = new Set<string>();
  if (payslipIds.length > 0) {
    const { data: docs } = await supabase
      .from("payslip_family_documents")
      .select("payslip_id")
      .in("payslip_id", payslipIds);
    for (const d of docs ?? []) payslipIdsWithFamilyDocs.add(d.payslip_id);
  }

  // ── 6. payslip_id ayant au moins une ligne ───────────────────────────────
  const payslipIdsWithLines = new Set<string>();
  if (payslipIds.length > 0) {
    const { data: pLines } = await supabase
      .from("payslip_lines")
      .select("payslip_id")
      .in("payslip_id", payslipIds);
    for (const l of pLines ?? []) payslipIdsWithLines.add(l.payslip_id);
  }

  // ── 7. Clients URSSAF (table petite — pas de filtre date) ────────────────
  const { data: urssafClients } = await supabase
    .from("urssaf_clients")
    .select("id, family_id, status, registered_at");

  // ── 8. Runs bloqués en « running » ───────────────────────────────────────
  const { data: stuckRuns } = await supabase
    .from("payroll_runs")
    .select("id, period, started_at")
    .eq("status", "running")
    .lt("started_at", stuckThreshold);

  // ── 9. Readiness dossiers professeurs (URSSAF-12) ────────────────────────
  // Pour chaque professeur ayant au moins un cours payé, vérifier si son
  // dossier est réellement complet pour la paie.
  const uniqueProfessorIds = [
    ...new Set((paidCourses ?? []).map((c) => c.professor_id)),
  ];

  const professorReadinessIssues: Array<{
    professorId: string;
    missingFields: string[];
  }> = [];

  if (uniqueProfessorIds.length > 0) {
    const [{ data: profProfiles }, { data: profBaseProfiles }] =
      await Promise.all([
        supabase
          .from("professor_profiles")
          .select("id, nir_encrypted, iban_encrypted, bic, addr1, postcode, city")
          .in("id", uniqueProfessorIds),
        supabase
          .from("profiles")
          .select("id, full_name, birth_date")
          .in("id", uniqueProfessorIds),
      ]);

    const profProfileMap = new Map(
      (profProfiles ?? []).map((p) => [p.id, p]),
    );
    const profBaseMap = new Map(
      (profBaseProfiles ?? []).map((p) => [p.id, p]),
    );

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
      if (result.status !== "payroll_ready") {
        professorReadinessIssues.push({
          professorId,
          missingFields: result.missingFields,
        });
      }
    }
  }

  // ── 10. Readiness dossiers familles avec client URSSAF (URSSAF-12) ───────
  // Pour chaque famille ayant un client URSSAF actif (registered / pending),
  // vérifier si le dossier employeur est complet pour la déclaration Avance Immédiate.
  const activeFamilyIds = [
    ...new Set(
      (urssafClients ?? [])
        .filter((c) => c.status === "registered" || c.status === "pending")
        .map((c) => c.family_id),
    ),
  ];

  const familyReadinessIssues: Array<{
    familyId: string;
    clientStatus: string;
    missingFields: string[];
  }> = [];

  if (activeFamilyIds.length > 0) {
    const [{ data: famProfiles }, { data: famBaseProfiles }] =
      await Promise.all([
        supabase
          .from("family_profiles")
          .select(
            "id, rep_first, rep_last, rep_phone, addr1, fiscal_consent, mandate_consent, legal_notice_accepted",
          )
          .in("id", activeFamilyIds),
        supabase
          .from("profiles")
          .select("id, birth_date")
          .in("id", activeFamilyIds),
      ]);

    const famProfileMap = new Map(
      (famProfiles ?? []).map((p) => [p.id, p]),
    );
    const famBaseMap = new Map(
      (famBaseProfiles ?? []).map((p) => [p.id, p]),
    );
    const clientStatusMap = new Map(
      (urssafClients ?? []).map((c) => [c.family_id, c.status]),
    );

    for (const familyId of activeFamilyIds) {
      const fp = famProfileMap.get(familyId);
      const bp = famBaseMap.get(familyId);
      const result = employerReadiness({
        rep_first: fp?.rep_first ?? null,
        rep_last: fp?.rep_last ?? null,
        rep_phone: fp?.rep_phone ?? null,
        addr1: fp?.addr1 ?? null,
        birth_date: bp?.birth_date ?? null,
        fiscal_consent: fp?.fiscal_consent ?? null,
        mandate_consent: fp?.mandate_consent ?? null,
        legal_notice_accepted: fp?.legal_notice_accepted ?? null,
        hasFiscalNumber: false, // não disponível sem fetch adicional — conservador
      });
      if (result.status !== "urssaf_ready") {
        familyReadinessIssues.push({
          familyId,
          clientStatus: clientStatusMap.get(familyId) ?? "unknown",
          missingFields: result.missingFields,
        });
      }
    }
  }

  return runChecks({
    paidCourses: paidCourses ?? [],
    lineCourseIds,
    payslips: payslips ?? [],
    payslipIdsWithContribs,
    payslipIdsWithFamilyDocs,
    payslipIdsWithLines,
    urssafClients: urssafClients ?? [],
    stuckRuns: stuckRuns ?? [],
    professorReadinessIssues,
    familyReadinessIssues,
  });
}
