/**
 * pilot/eligibility.ts — URSSAF-14
 *
 * Fonctions pures pour l'éligibilité d'une paire (professeur, famille) au
 * pilote restreint.
 *
 * Périmètre pilote :
 *  - 1 professeur + 1 à 3 familles liées, 1 mois complet
 *  - Volet paie + documents famille SAP uniquement
 *  - Pas de live URSSAF / DSN dans ce pilote
 *
 * Critères d'éligibilité d'une paire (prof, famille) :
 *  E1. Au moins 1 cours payé entre eux (12 derniers mois)
 *  E2. Dossier professeur payroll_ready (professorPayrollReadiness — 8 champs)
 *  E3. Dossier famille complet (familyCompleteness — 7 champs)
 *  E4. Aucun cours de cette paire absent de payslip_lines (anomalie cohérence)
 *
 * Architecture :
 *  - eligibility.ts : fonctions pures + types (testable sans DB)
 *  - runner.ts       : fetch DB + appel des fonctions pures
 *  - page.tsx        : UI admin /admin/pilot
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type PilotPairStatus = "eligible" | "ineligible";

/**
 * Données injectées par le runner pour une paire (professeur, famille).
 * Aucune valeur sensible (pas de NIR brut, pas d'IBAN brut).
 */
export type PilotPairInput = {
  professorId: string;
  professorName: string | null;
  familyId: string;
  familyName: string | null;

  /** Nombre de cours au statut "paid" entre ce professeur et cette famille */
  paidCoursesCount: number;

  /**
   * E2 — Dossier professeur payroll_ready.
   * Calculé via professorPayrollReadiness() (URSSAF-12) — 8 champs requis.
   */
  professorPayrollReady: boolean;
  /** Champs manquants dans le dossier professeur (pour affichage) */
  professorMissingFields: string[];

  /**
   * E3 — Dossier famille complet (SAP / paie).
   * Calculé via familyCompleteness() — 7 champs requis.
   */
  familyPayrollReady: boolean;
  /** Champs manquants dans le dossier famille (pour affichage) */
  familyMissingFields: string[];

  /**
   * E4 — Un ou plusieurs cours de cette paire sont absents de payslip_lines.
   * Indique soit que le run n'a pas encore tourné, soit une anomalie réelle.
   * Source : anomalies consistency code="paid_course_without_payslip_line".
   */
  hasCourseWithoutPayslipLine: boolean;
};

export type PilotPairResult = {
  professorId: string;
  professorName: string | null;
  familyId: string;
  familyName: string | null;
  paidCoursesCount: number;
  status: PilotPairStatus;
  /** Raisons du blocage — tableau vide si éligible */
  blockers: string[];
};

export type PilotEligibilityReport = {
  generatedAt: string;
  eligibleCount: number;
  ineligibleCount: number;
  /**
   * Paires triées : éligibles en premier, puis par nom de professeur (fr).
   */
  pairs: PilotPairResult[];
};

// ── Logique d'éligibilité ─────────────────────────────────────────────────────

/**
 * Calcule l'éligibilité d'une paire (professeur, famille) au pilote.
 * Fonction pure — testable sans DB, sans effets de bord.
 */
export function computePairEligibility(input: PilotPairInput): PilotPairResult {
  const blockers: string[] = [];

  // E1 — Relation de travail active
  if (input.paidCoursesCount === 0) {
    blockers.push("Aucun cours payé entre ce professeur et cette famille");
  }

  // E2 — Dossier professeur
  if (!input.professorPayrollReady) {
    const detail =
      input.professorMissingFields.length > 0
        ? ` — manque : ${input.professorMissingFields.join(", ")}`
        : "";
    blockers.push(`Dossier professeur incomplet${detail}`);
  }

  // E3 — Dossier famille
  if (!input.familyPayrollReady) {
    const detail =
      input.familyMissingFields.length > 0
        ? ` — manque : ${input.familyMissingFields.join(", ")}`
        : "";
    blockers.push(`Dossier famille incomplet${detail}`);
  }

  // E4 — Cohérence cours/bulletin
  if (input.hasCourseWithoutPayslipLine) {
    blockers.push(
      "Un ou plusieurs cours payés ne sont pas couverts par un bulletin — vérifier cohérence",
    );
  }

  return {
    professorId: input.professorId,
    professorName: input.professorName,
    familyId: input.familyId,
    familyName: input.familyName,
    paidCoursesCount: input.paidCoursesCount,
    status: blockers.length === 0 ? "eligible" : "ineligible",
    blockers,
  };
}

/**
 * Agrège les résultats de paires en rapport global.
 * Tri : éligibles en premier, puis ordre alphabétique du nom de professeur.
 */
export function computePilotEligibilityReport(
  pairs: PilotPairResult[],
): PilotEligibilityReport {
  const sorted = [...pairs].sort((a, b) => {
    if (a.status !== b.status) return a.status === "eligible" ? -1 : 1;
    return (a.professorName ?? "").localeCompare(b.professorName ?? "", "fr");
  });

  return {
    generatedAt: new Date().toISOString(),
    eligibleCount: sorted.filter((p) => p.status === "eligible").length,
    ineligibleCount: sorted.filter((p) => p.status === "ineligible").length,
    pairs: sorted,
  };
}
