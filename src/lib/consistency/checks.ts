/**
 * consistency/checks.ts — URSSAF-11
 *
 * Fonctions de contrôle de cohérence inter-tables, purement fonctionnelles.
 * Aucun appel DB ici : les données sont injectées par le runner.
 *
 * Architecture :
 *  - checks.ts   : fonctions pures + types (testable sans DB)
 *  - runner.ts   : fetching DB + appel de runChecks()
 *  - route.ts    : route API admin-only
 *  - page.tsx    : UI admin
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AnomalySeverity = "critique" | "important" | "secondaire";

export type Anomaly = {
  /** Identifiant machine de l'anomalie (stable, utilisable comme filtre) */
  code: string;
  severity: AnomalySeverity;
  /** Libellé court pour l'UI */
  label: string;
  entityType:
    | "course"
    | "payslip"
    | "professor_profile"
    | "family_profile"
    | "urssaf_client"
    | "payroll_run";
  entityId: string;
  /** Contexte court pour permettre l'investigation */
  detail?: string;
};

export type AnomalyReport = {
  generatedAt: string;
  totalAnomalies: number;
  bySeverity: Record<AnomalySeverity, number>;
  anomalies: Anomaly[];
};

// ── Données injectées par le runner ──────────────────────────────────────────

export type ConsistencyInput = {
  /** Cours au statut `paid` (récents, fenêtre configurable dans le runner) */
  paidCourses: Array<{
    id: string;
    professor_id: string;
    family_id: string;
    paid_at: string | null;
  }>;
  /** Ensemble des course_id présents dans payslip_lines */
  lineCourseIds: Set<string>;

  /** Bulletins récents */
  payslips: Array<{
    id: string;
    professor_id: string;
    period: string;
    number: string | null;
  }>;
  /** Ensemble des payslip_id ayant au moins une cotisation */
  payslipIdsWithContribs: Set<string>;
  /** Ensemble des payslip_id ayant au moins un document famille */
  payslipIdsWithFamilyDocs: Set<string>;
  /** Ensemble des payslip_id ayant au moins une ligne de bulletin */
  payslipIdsWithLines: Set<string>;

  urssafClients: Array<{
    id: string;
    family_id: string;
    status: string;
    registered_at: string | null;
  }>;
  /** Runs dont le statut est « running » depuis plus de STUCK_RUN_MINUTES */
  stuckRuns: Array<{ id: string; period: string; started_at: string }>;

  // ── URSSAF-12 : readiness dossiers ─────────────────────────────────────
  /**
   * Professeurs ayant au moins un cours payé mais dont le dossier payroll
   * n'est pas complet selon professorPayrollReadiness().
   */
  professorReadinessIssues: Array<{
    professorId: string;
    missingFields: string[];
  }>;
  /**
   * Familles ayant un urssaf_client actif (registered / pending) mais dont
   * le dossier employeur n'est pas complet selon employerReadiness().
   */
  familyReadinessIssues: Array<{
    familyId: string;
    clientStatus: string;
    missingFields: string[];
  }>;
};

// ── Fonctions de détection ────────────────────────────────────────────────────

/**
 * CRITIQUE — Cours `paid` absent de payslip_lines.
 * Indique que le bulletin du professeur ne couvre pas ce cours :
 * le professeur n'a potentiellement pas été payé pour cette séance.
 */
export function checkPaidCoursesWithoutLines(
  paidCourses: ConsistencyInput["paidCourses"],
  lineCourseIds: Set<string>,
): Anomaly[] {
  return paidCourses
    .filter((c) => !lineCourseIds.has(c.id))
    .map((c) => ({
      code: "paid_course_without_payslip_line",
      severity: "critique" as const,
      label: "Cours payé sans ligne de bulletin",
      entityType: "course" as const,
      entityId: c.id,
      detail: `professor_id=${c.professor_id} paid_at=${c.paid_at ?? "—"}`,
    }));
}

/**
 * CRITIQUE — Bulletin avec des lignes mais sans cotisations sociales persistées.
 * Les cotisations sont nécessaires pour les documents SAP et la déclaration URSSAF.
 * On ne teste que les bulletins ayant au moins une ligne (payslip sans ligne = run vide, non-anomalie).
 */
export function checkPayslipsWithoutContributions(
  payslips: ConsistencyInput["payslips"],
  payslipIdsWithContribs: Set<string>,
  payslipIdsWithLines: Set<string>,
): Anomaly[] {
  return payslips
    .filter(
      (p) => payslipIdsWithLines.has(p.id) && !payslipIdsWithContribs.has(p.id),
    )
    .map((p) => ({
      code: "payslip_without_contributions",
      severity: "critique" as const,
      label: "Bulletin sans cotisations sociales",
      entityType: "payslip" as const,
      entityId: p.id,
      detail: `professor_id=${p.professor_id} period=${p.period}`,
    }));
}

/**
 * IMPORTANT — Bulletin avec des lignes mais sans documents famille.
 * En mode SAP mandataire, chaque famille doit recevoir son document de paie.
 * Un bulletin avec lignes mais sans payslip_family_documents est incomplet.
 */
export function checkPayslipsWithoutFamilyDocs(
  payslips: ConsistencyInput["payslips"],
  payslipIdsWithFamilyDocs: Set<string>,
  payslipIdsWithLines: Set<string>,
): Anomaly[] {
  return payslips
    .filter(
      (p) =>
        payslipIdsWithLines.has(p.id) && !payslipIdsWithFamilyDocs.has(p.id),
    )
    .map((p) => ({
      code: "payslip_without_family_document",
      severity: "important" as const,
      label: "Bulletin sans document famille (SAP mandataire)",
      entityType: "payslip" as const,
      entityId: p.id,
      detail: `professor_id=${p.professor_id} period=${p.period}`,
    }));
}

/**
 * IMPORTANT — Client URSSAF au statut `registered` mais sans `registered_at`.
 * La trace de confirmation d'enregistrement est manquante.
 * Indique une incohérence entre le statut API retourné et les données locales.
 */
export function checkUrssafRegisteredWithoutDate(
  clients: ConsistencyInput["urssafClients"],
): Anomaly[] {
  return clients
    .filter((c) => c.status === "registered" && !c.registered_at)
    .map((c) => ({
      code: "urssaf_registered_without_date",
      severity: "important" as const,
      label: "Client URSSAF « registered » sans date de confirmation",
      entityType: "urssaf_client" as const,
      entityId: c.id,
      detail: `family_id=${c.family_id}`,
    }));
}

/**
 * SECONDAIRE — Run de paie bloqué en statut `running` depuis trop longtemps.
 * Le run a probablement échoué silencieusement (crash serveur, timeout) sans
 * être mis à jour. La re-entrance guard (URSSAF-10) empêchera les runs suivants
 * tant que cette ligne reste.
 */
export function checkStuckPayrollRuns(
  stuckRuns: ConsistencyInput["stuckRuns"],
): Anomaly[] {
  return stuckRuns.map((r) => ({
    code: "payroll_run_stuck_running",
    severity: "secondaire" as const,
    label: "Run de paie bloqué en statut « running »",
    entityType: "payroll_run" as const,
    entityId: r.id,
    detail: `period=${r.period} started_at=${r.started_at}`,
  }));
}

/**
 * SECONDAIRE — Bulletin sans numéro légal (payslips.number IS NULL).
 * Le numéro est généré via séquence lors du run. Son absence signale soit un
 * run incomplet soit un bug de séquence (sequence RPC error fallback → 1).
 */
export function checkPayslipsMissingNumber(
  payslips: ConsistencyInput["payslips"],
): Anomaly[] {
  return payslips
    .filter((p) => !p.number)
    .map((p) => ({
      code: "payslip_missing_number",
      severity: "secondaire" as const,
      label: "Bulletin sans numéro légal",
      entityType: "payslip" as const,
      entityId: p.id,
      detail: `professor_id=${p.professor_id} period=${p.period}`,
    }));
}

// ── URSSAF-12 : readiness dossiers ───────────────────────────────────────────

/**
 * CRITIQUE — Professeur avec cours(s) payé(s) mais dossier payroll incomplet.
 * Si le professeur manque de NIR, IBAN, adresse ou date de naissance valide,
 * le prochain run de paie produira des bulletins non-valides ou des erreurs URSSAF.
 */
export function checkProfessorReadinessIssues(
  issues: ConsistencyInput["professorReadinessIssues"],
): Anomaly[] {
  return issues.map((issue) => ({
    code: "professor_dossier_incomplete_with_paid_courses",
    severity: "critique" as const,
    label: "Professeur avec cours payés et dossier incomplet",
    entityType: "professor_profile" as const,
    entityId: issue.professorId,
    detail: `Champs manquants : ${issue.missingFields.join(", ")}`,
  }));
}

/**
 * IMPORTANT — Famille avec client URSSAF actif mais dossier employeur incomplet.
 * Une famille enregistrée (ou en cours d'enregistrement) URSSAF doit avoir
 * tous ses champs renseignés pour que la déclaration Avance Immédiate soit valide.
 */
export function checkFamilyUrssafReadinessIssues(
  issues: ConsistencyInput["familyReadinessIssues"],
): Anomaly[] {
  return issues.map((issue) => ({
    code: "family_dossier_incomplete_with_urssaf_client",
    severity: "important" as const,
    label: "Famille avec client URSSAF actif et dossier incomplet",
    entityType: "family_profile" as const,
    entityId: issue.familyId,
    detail: `statut URSSAF=${issue.clientStatus} — Champs manquants : ${issue.missingFields.join(", ")}`,
  }));
}

// ── Agrégateur ────────────────────────────────────────────────────────────────

/**
 * Exécute tous les contrôles et retourne un rapport structuré.
 * Fonction pure, sans effet de bord.
 */
export function runChecks(data: ConsistencyInput): AnomalyReport {
  const anomalies: Anomaly[] = [
    ...checkPaidCoursesWithoutLines(data.paidCourses, data.lineCourseIds),
    ...checkPayslipsWithoutContributions(
      data.payslips,
      data.payslipIdsWithContribs,
      data.payslipIdsWithLines,
    ),
    ...checkPayslipsWithoutFamilyDocs(
      data.payslips,
      data.payslipIdsWithFamilyDocs,
      data.payslipIdsWithLines,
    ),
    ...checkUrssafRegisteredWithoutDate(data.urssafClients),
    ...checkStuckPayrollRuns(data.stuckRuns),
    ...checkPayslipsMissingNumber(data.payslips),
    ...checkProfessorReadinessIssues(data.professorReadinessIssues),
    ...checkFamilyUrssafReadinessIssues(data.familyReadinessIssues),
  ];

  const bySeverity: Record<AnomalySeverity, number> = {
    critique: 0,
    important: 0,
    secondaire: 0,
  };
  for (const a of anomalies) {
    bySeverity[a.severity]++;
  }

  return {
    generatedAt: new Date().toISOString(),
    totalAnomalies: anomalies.length,
    bySeverity,
    anomalies,
  };
}
