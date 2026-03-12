/**
 * pilot/validation.ts — URSSAF-15
 *
 * Fonctions pures pour le contrôle post-pilote.
 *
 * Évalue, pour une paire (professeur, période), si les artefacts attendus
 * d'un run de paie ont bien été produits.
 *
 * Niveau de contrôle : (professorId, period) — car un payslip est unique par
 * (professor_id, period) et les docs famille sont liés à ce payslip.
 *
 * Artefacts contrôlés (7) :
 *  A1. paid_courses             — au moins 1 cours paid dans la période
 *  A2. payslip_exists           — un payslip row existe
 *  A3. payslip_number           — payslips.number IS NOT NULL (n° légal)
 *  A4. payslip_lines            — au moins 1 ligne de bulletin
 *  A5. contribution_lines       — au moins 1 cotisation sociale persistée
 *  A6. family_documents         — payslip_family_document pour chaque famille
 *  A7. no_critical_anomalies    — 0 anomalie critique sur le périmètre
 *
 * Verdicts :
 *  success    — les 7 artefacts sont présents
 *  incomplete — payslip existe mais au moins 1 artefact manque/partiel
 *  failed     — pas de payslip du tout (run non exécuté ou raté), ou 0 cours
 *
 * Architecture :
 *  - validation.ts        : fonctions pures + types (testable sans DB)
 *  - validation-runner.ts : fetch DB + appel des fonctions pures
 *  - results/page.tsx     : UI admin /admin/pilot/results
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type PilotArtifactCode =
  | "paid_courses"
  | "payslip_exists"
  | "payslip_number"
  | "payslip_lines"
  | "contribution_lines"
  | "family_documents"
  | "no_critical_anomalies";

export type PilotArtifactStatus = "present" | "missing" | "partial";

export type PilotArtifactCheck = {
  code: PilotArtifactCode;
  label: string;
  status: PilotArtifactStatus;
  /** Contexte court pour l'UI */
  detail: string | null;
};

export type PilotValidationVerdict = "success" | "incomplete" | "failed";

/**
 * Données injectées par le runner pour un groupe (professeur, période).
 * Aucune valeur sensible.
 */
export type PilotValidationInput = {
  professorId: string;
  professorName: string | null;
  /** Format "YYYY-MM" */
  period: string;

  // A1
  paidCoursesCount: number;
  paidCourseIds: string[];

  // A2 & A3
  payslipId: string | null;
  payslipNumber: string | null;

  // A4
  payslipLinesCount: number;

  // A5
  contributionLinesCount: number;

  // A6 — docs famille
  /** family_id des familles ayant au moins un cours paid dans la période */
  familiesInScope: string[];
  /** family_id des familles ayant un payslip_family_document pour ce payslip */
  familiesWithDocument: string[];

  // A7
  /** Nombre d'anomalies critique référençant un courseId ou payslipId du périmètre */
  criticalAnomalyCount: number;
};

export type PilotValidationResult = {
  professorId: string;
  professorName: string | null;
  period: string;
  verdict: PilotValidationVerdict;
  artifacts: PilotArtifactCheck[];
  /** Nombre d'artefacts non "present" */
  missingCount: number;
  criticalAnomalyCount: number;
};

export type PilotValidationReport = {
  generatedAt: string;
  successCount: number;
  incompleteCount: number;
  failedCount: number;
  /** Trié : failed → incomplete → success, puis période décroissante */
  results: PilotValidationResult[];
};

// ── Logique de contrôle post-pilote ──────────────────────────────────────────

/**
 * Évalue les artefacts d'une paire (professeur, période).
 * Fonction pure — testable sans DB, sans effets de bord.
 */
export function checkPilotArtifacts(
  input: PilotValidationInput,
): PilotValidationResult {
  const artifacts: PilotArtifactCheck[] = [];

  // A1 — Cours payés dans la période
  artifacts.push({
    code: "paid_courses",
    label: "Cours payés dans la période",
    status: input.paidCoursesCount > 0 ? "present" : "missing",
    detail:
      input.paidCoursesCount > 0
        ? `${input.paidCoursesCount} cours`
        : null,
  });

  // A2 — Bulletin de paie généré
  artifacts.push({
    code: "payslip_exists",
    label: "Bulletin de paie généré",
    status: input.payslipId !== null ? "present" : "missing",
    detail: input.payslipId !== null ? input.payslipId.slice(-8) : null,
  });

  // A3 — Numéro légal du bulletin (dépend de A2)
  artifacts.push({
    code: "payslip_number",
    label: "Numéro légal du bulletin",
    status:
      input.payslipId !== null && input.payslipNumber !== null
        ? "present"
        : "missing",
    detail: input.payslipNumber ?? null,
  });

  // A4 — Lignes de bulletin (dépend de A2)
  artifacts.push({
    code: "payslip_lines",
    label: "Lignes de bulletin",
    status: input.payslipLinesCount > 0 ? "present" : "missing",
    detail:
      input.payslipLinesCount > 0 ? `${input.payslipLinesCount} lignes` : null,
  });

  // A5 — Cotisations sociales persistées
  artifacts.push({
    code: "contribution_lines",
    label: "Cotisations sociales",
    status: input.contributionLinesCount > 0 ? "present" : "missing",
    detail:
      input.contributionLinesCount > 0
        ? `${input.contributionLinesCount} cotisations`
        : null,
  });

  // A6 — Documents famille
  const missingFamilyDocs = input.familiesInScope.filter(
    (fid) => !input.familiesWithDocument.includes(fid),
  );
  let a6Status: PilotArtifactStatus;
  if (input.familiesInScope.length === 0) {
    a6Status = "missing";
  } else if (missingFamilyDocs.length === 0) {
    a6Status = "present";
  } else if (missingFamilyDocs.length < input.familiesInScope.length) {
    a6Status = "partial";
  } else {
    a6Status = "missing";
  }
  artifacts.push({
    code: "family_documents",
    label: "Documents famille (SAP)",
    status: a6Status,
    detail:
      missingFamilyDocs.length > 0
        ? `${input.familiesWithDocument.length}/${input.familiesInScope.length} présent(s) — ${missingFamilyDocs.length} manquant(s)`
        : `${input.familiesInScope.length} document(s)`,
  });

  // A7 — Aucune anomalie critique sur le périmètre
  artifacts.push({
    code: "no_critical_anomalies",
    label: "Aucune anomalie critique",
    status: input.criticalAnomalyCount === 0 ? "present" : "missing",
    detail:
      input.criticalAnomalyCount > 0
        ? `${input.criticalAnomalyCount} anomalie(s) critique(s)`
        : null,
  });

  // ── Verdict ──────────────────────────────────────────────────────────────
  const missingCount = artifacts.filter((a) => a.status !== "present").length;

  let verdict: PilotValidationVerdict;
  if (input.paidCoursesCount === 0 || input.payslipId === null) {
    // Pas de contexte ou run n'a pas produit de bulletin
    verdict = "failed";
  } else if (missingCount > 0) {
    // Bulletin présent mais artefacts incomplets
    verdict = "incomplete";
  } else {
    verdict = "success";
  }

  return {
    professorId: input.professorId,
    professorName: input.professorName,
    period: input.period,
    verdict,
    artifacts,
    missingCount,
    criticalAnomalyCount: input.criticalAnomalyCount,
  };
}

/**
 * Agrège une liste de résultats de validation en rapport global.
 * Tri : failed → incomplete → success, puis période décroissante à verdict égal.
 */
export function computePilotValidationReport(
  results: PilotValidationResult[],
): PilotValidationReport {
  const verdictOrder: Record<PilotValidationVerdict, number> = {
    failed: 0,
    incomplete: 1,
    success: 2,
  };

  const sorted = [...results].sort((a, b) => {
    if (a.verdict !== b.verdict)
      return verdictOrder[a.verdict] - verdictOrder[b.verdict];
    // Période la plus récente en premier
    return b.period.localeCompare(a.period);
  });

  return {
    generatedAt: new Date().toISOString(),
    successCount: sorted.filter((r) => r.verdict === "success").length,
    incompleteCount: sorted.filter((r) => r.verdict === "incomplete").length,
    failedCount: sorted.filter((r) => r.verdict === "failed").length,
    results: sorted,
  };
}
