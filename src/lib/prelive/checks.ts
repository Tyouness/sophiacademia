/**
 * prelive/checks.ts — URSSAF-13
 *
 * Fonctions pures pour la checklist pré-live.
 * Aucun appel DB ici : les données sont injectées par runner.ts.
 *
 * Une "checklist pré-live" répond à : sommes-nous réellement prêts à utiliser
 * ce logiciel URSSAF/paie de manière sérieuse ?
 *
 * Critères blocants : si un seul est rouge → statut global = "blocked"
 * Critères surveillance : non bloquants mais visibles → statut = "warning"
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type PreliveCriterionStatus = "ok" | "blocked" | "warning";

export type PreliveCriterion = {
  /** Identifiant machine stable */
  code: string;
  /** Libellé court pour l'UI */
  label: string;
  status: PreliveCriterionStatus;
  /** Si true → contribue au statut global "blocked" */
  blocking: boolean;
  /** Explication du problème (null si ok) */
  detail: string | null;
  /** Lien vers la page de correction */
  actionLink: string | null;
  /** Libellé du lien */
  actionLabel: string | null;
};

export type PreliveGlobalStatus = "ok" | "blocked" | "warning";

export type PreliveSummary = {
  globalStatus: PreliveGlobalStatus;
  generatedAt: string;
  blockingCount: number;
  warningCount: number;
  criteria: PreliveCriterion[];
};

// ── Données injectées par le runner ──────────────────────────────────────────

export type PreliveInput = {
  /** Nombre d'anomalies de sévérité "critique" (runConsistencyChecks) */
  criticalAnomalies: number;
  /** Nombre d'anomalies de sévérité "important" (runConsistencyChecks) */
  importantAnomalies: number;
  /** Nombre de runs bloqués en statut "running" > 30 min (desde consistency) */
  stuckRunsCount: number;
  /** Nombre de professeurs avec cours payés et dossier payroll incomplet */
  professorsWithPayrollIssues: number;
  /** Nombre de familles avec client URSSAF actif et dossier incomplet */
  familiesWithActiveUrssafAndIssues: number;
  /** Runs en statut failed ou partial dans les 30 derniers jours */
  failedRunsLast30Days: number;
};

// ── Calcul ────────────────────────────────────────────────────────────────────

/**
 * Calcule la synthèse pré-live à partir des données injectées.
 * Fonction pure — testable sans DB.
 */
export function computePreliveSummary(input: PreliveInput): PreliveSummary {
  const criteria: PreliveCriterion[] = [];

  // ── BLOCANTS ─────────────────────────────────────────────────────────────

  /**
   * C1 — Aucune anomalie critique de cohérence inter-tables.
   * Si un cours payé n'apparaît pas dans un bulletin, ou un bulletin n'a pas
   * de cotisations, le système n'est pas fiable pour un usage réel.
   */
  criteria.push({
    code: "no_critical_consistency_anomalies",
    label: "Aucune anomalie critique de cohérence",
    status: input.criticalAnomalies === 0 ? "ok" : "blocked",
    blocking: true,
    detail:
      input.criticalAnomalies > 0
        ? `${input.criticalAnomalies} anomalie(s) critique(s) détectée(s) — cours non couverts, bulletins sans cotisations, etc.`
        : null,
    actionLink: "/admin/consistency",
    actionLabel: "Voir les anomalies",
  });

  /**
   * C2 — Aucun run mensuel bloqué.
   * Un run en statut "running" depuis plus de 30 min empêche tout nouveau
   * run (re-entrance guard). Le système est paralysé tant que ce cas persiste.
   */
  criteria.push({
    code: "no_stuck_payroll_run",
    label: "Aucun run mensuel bloqué",
    status: input.stuckRunsCount === 0 ? "ok" : "blocked",
    blocking: true,
    detail:
      input.stuckRunsCount > 0
        ? `${input.stuckRunsCount} run(s) bloqué(s) en statut « running » depuis plus de 30 min`
        : null,
    actionLink: "/admin/payroll",
    actionLabel: "Voir les runs",
  });

  /**
   * C3 — Aucun professeur actif avec dossier payroll incomplet.
   * Un professeur avec des cours payés mais sans NIR, IBAN, adresse ou date
   * de naissance valide produira des bulletins invalides au prochain run.
   */
  criteria.push({
    code: "no_professor_payroll_incomplete",
    label: "Aucun professeur actif avec dossier payroll incomplet",
    status: input.professorsWithPayrollIssues === 0 ? "ok" : "blocked",
    blocking: true,
    detail:
      input.professorsWithPayrollIssues > 0
        ? `${input.professorsWithPayrollIssues} professeur(s) ont des cours payés mais un dossier payroll incomplet`
        : null,
    actionLink: "/admin/consistency",
    actionLabel: "Voir les anomalies",
  });

  // ── SURVEILLANCE (non blocants) ───────────────────────────────────────────

  /**
   * C4 — Aucune anomalie importante de cohérence.
   * Ne bloque pas mais indique des bulletins sans documents famille ou des
   * clients URSSAF enregistrés sans date de confirmation.
   */
  criteria.push({
    code: "no_important_consistency_anomalies",
    label: "Aucune anomalie importante de cohérence",
    status: input.importantAnomalies === 0 ? "ok" : "warning",
    blocking: false,
    detail:
      input.importantAnomalies > 0
        ? `${input.importantAnomalies} anomalie(s) importante(s) — bulletins sans documents famille, URSSAF sans date, etc.`
        : null,
    actionLink: "/admin/consistency",
    actionLabel: "Voir les anomalies",
  });

  /**
   * C5 — Aucun run mensuel en échec récent.
   * Des runs failed/partial dans les 30 derniers jours indiquent que le
   * système paie a rencontré des erreurs sur des bulletins réels.
   */
  criteria.push({
    code: "no_recent_failed_runs",
    label: "Aucun run mensuel en échec dans les 30 derniers jours",
    status: input.failedRunsLast30Days === 0 ? "ok" : "warning",
    blocking: false,
    detail:
      input.failedRunsLast30Days > 0
        ? `${input.failedRunsLast30Days} run(s) en échec ou partiel récemment`
        : null,
    actionLink: "/admin/payroll",
    actionLabel: "Voir les runs",
  });

  /**
   * C6 — Aucune famille URSSAF active avec dossier incomplet.
   * Ces familles ont un client URSSAF enregistré mais le dossier employeur
   * est incomplet pour la déclaration Avance Immédiate.
   */
  criteria.push({
    code: "no_family_urssaf_dossier_incomplete",
    label: "Aucune famille URSSAF active avec dossier incomplet",
    status: input.familiesWithActiveUrssafAndIssues === 0 ? "ok" : "warning",
    blocking: false,
    detail:
      input.familiesWithActiveUrssafAndIssues > 0
        ? `${input.familiesWithActiveUrssafAndIssues} famille(s) ont un client URSSAF actif mais un dossier incomplet`
        : null,
    actionLink: "/admin/consistency",
    actionLabel: "Voir les anomalies",
  });

  // ── Calcul statut global ──────────────────────────────────────────────────

  const blockingCount = criteria.filter(
    (c) => c.blocking && c.status === "blocked",
  ).length;
  const warningCount = criteria.filter((c) => c.status === "warning").length;

  const globalStatus: PreliveGlobalStatus =
    blockingCount > 0 ? "blocked" : warningCount > 0 ? "warning" : "ok";

  return {
    globalStatus,
    generatedAt: new Date().toISOString(),
    blockingCount,
    warningCount,
    criteria,
  };
}
