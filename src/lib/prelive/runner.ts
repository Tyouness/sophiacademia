/**
 * prelive/runner.ts — URSSAF-13
 *
 * Fetche les données nécessaires depuis Supabase et délègue le calcul à
 * computePreliveSummary() (fonctions pures).
 *
 * Réutilise runConsistencyChecks() pour éviter toute duplication : les
 * anomalies de cohérence sont déjà calculées, on les réinterprète ici.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { runConsistencyChecks } from "@/lib/consistency/runner";
import { computePreliveSummary, type PreliveSummary } from "./checks";

const FAILED_RUN_LOOKBACK_DAYS = 30;

export async function runPreliveChecks(): Promise<PreliveSummary> {
  // ── 1. Rapport de cohérence complet ───────────────────────────────────────
  // runConsistencyChecks() calcule déjà tout ce qu'on a besoin pour les critères
  // C1, C2, C3, C4 et C6. On le réutilise directement.
  const consistencyReport = await runConsistencyChecks();

  const stuckRunsCount = consistencyReport.anomalies.filter(
    (a) => a.code === "payroll_run_stuck_running",
  ).length;

  const professorsWithPayrollIssues = consistencyReport.anomalies.filter(
    (a) => a.code === "professor_dossier_incomplete_with_paid_courses",
  ).length;

  const familiesWithActiveUrssafAndIssues = consistencyReport.anomalies.filter(
    (a) => a.code === "family_dossier_incomplete_with_urssaf_client",
  ).length;

  // ── 2. Runs récents en échec (C5 — non couverts par consistency) ──────────
  const supabase = createAdminSupabaseClient();
  const since = new Date(
    Date.now() - FAILED_RUN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: failedRuns } = await supabase
    .from("payroll_runs")
    .select("id")
    .in("status", ["failed", "partial"])
    .gte("started_at", since);

  return computePreliveSummary({
    criticalAnomalies: consistencyReport.bySeverity.critique,
    importantAnomalies: consistencyReport.bySeverity.important,
    stuckRunsCount,
    professorsWithPayrollIssues,
    familiesWithActiveUrssafAndIssues,
    failedRunsLast30Days: failedRuns?.length ?? 0,
  });
}
