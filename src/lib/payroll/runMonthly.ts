/**
 * runMonthly — Orchestrateur instrumenté du run de paie mensuelle.
 *
 * Responsabilités :
 *  1. Créer une ligne payroll_runs (status = 'running') au démarrage
 *  2. Exécuter computeMonthlyPayslipsForPeriod (chaque prof isolé en try/catch)
 *  3. Agréger les résultats via aggregateRunResults (pure, testable)
 *  4. Mettre à jour payroll_runs avec le résultat final — tous les compteurs réels
 *
 * Idempotent : plusieurs runs sur la même période créent chacun leur ligne d'audit.
 * Le calcul sous-jacent est idempotent (UPSERT sur professor_id + period).
 *
 * Cron-safe : peut être appelé depuis un cron ou depuis l'UI admin.
 * Retourne un PayrollRunResult exploitable par la route et l'UI.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { computeMonthlyPayslipsForPeriod } from "@/lib/payroll/computeMonthlyPayslip";
import type { ProfessorRunResult } from "@/lib/payroll/computeMonthlyPayslip";

export type PayrollRunResult = {
  runId: string;
  period: string;
  status: "success" | "partial" | "failed";
  professorsProcessed: number;
  payslipsCreated: number;
  familyDocsCreated: number;
  familyDocsFailed: number;
  contribErrors: number;
  errorsCount: number;
  errorDetails: Array<{ professorId: string; message: string }>;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

// ── Agrégation pure ────────────────────────────────────────────────────────────

/**
 * Agrège les résultats par professeur pour dériver le statut du run et tous les
 * compteurs. Fonction pure (pas de DB), exportée pour être testée.
 *
 * Règles de statut :
 *  - failed  : des profs ont eu des erreurs fatales ET aucun bulletin créé
 *  - partial : tout autre cas avec des entrées dans error_details
 *  - success : aucune erreur (ni fatale ni non bloquante)
 */
export function aggregateRunResults(results: ProfessorRunResult[]): {
  status: "success" | "partial" | "failed";
  professorsProcessed: number;
  payslipsCreated: number;
  familyDocsCreated: number;
  familyDocsFailed: number;
  contribErrors: number;
  errorsCount: number;
  errorDetails: Array<{ professorId: string; message: string }>;
} {
  let payslipsCreated = 0;
  let familyDocsCreated = 0;
  let familyDocsFailed = 0;
  let contribErrors = 0;
  const errorDetails: Array<{ professorId: string; message: string }> = [];

  for (const r of results) {
    // Erreur fatale (bulletin non généré)
    if (r.error) {
      errorDetails.push({ professorId: r.professorId, message: r.error });
    } else if (r.payslipId !== null) {
      payslipsCreated++;
    }

    // Erreur non bloquante : cotisations non persistées
    if (r.contribError) {
      contribErrors++;
      errorDetails.push({
        professorId: r.professorId,
        message: `contrib: ${r.contribError}`,
      });
    }

    // Compteurs docs famille
    familyDocsCreated += r.familyDocsCreated;
    familyDocsFailed += r.familyDocsFailed;
    for (const e of r.familyDocErrors) {
      errorDetails.push({
        professorId: `${r.professorId}/family:${e.familyId}`,
        message: e.message,
      });
    }
  }

  const fatalErrors = results.filter((r) => r.error).length;
  let status: "success" | "partial" | "failed";
  if (fatalErrors > 0 && payslipsCreated === 0) {
    status = "failed";
  } else if (errorDetails.length > 0) {
    // Any error (fatal on some profs, contrib, or family doc) → partial
    status = "partial";
  } else {
    status = "success";
  }

  return {
    status,
    professorsProcessed: results.length,
    payslipsCreated,
    familyDocsCreated,
    familyDocsFailed,
    contribErrors,
    errorsCount: errorDetails.length,
    // Cap at 50 entries to avoid JSONB bloat in payroll_runs (full count in errorsCount).
    errorDetails: errorDetails.slice(0, 50),
  };
}

// ── Orchestrateur principal ────────────────────────────────────────────────────

/**
 * Executes a monthly payroll run for the given period, recording the outcome
 * in the payroll_runs table.
 *
 * @param period  - "YYYY-MM" (e.g. "2026-02")
 * @param triggeredBy - UUID of the admin who triggered the run (nullable for cron)
 */
export async function runMonthly(
  period: string,
  triggeredBy: string | null = null,
): Promise<PayrollRunResult> {
  const supabase = createAdminSupabaseClient();
  const startedAt = new Date().toISOString();

  // Re-entrancy guard: refuse to start if another run is already in progress for this period.
  const { data: runningRow } = await supabase
    .from("payroll_runs")
    .select("id, started_at")
    .eq("period", period)
    .eq("status", "running")
    .maybeSingle();

  if (runningRow) {
    throw new Error(
      `payroll_run_already_running: period=${period} runId=${runningRow.id} startedAt=${runningRow.started_at}`,
    );
  }

  // 1. Persist the run record (status=running)
  const { data: runRow, error: insertError } = await supabase
    .from("payroll_runs")
    .insert({
      period,
      status: "running",
      triggered_by: triggeredBy ?? null,
      started_at: startedAt,
    })
    .select("id")
    .single();

  if (insertError || !runRow) {
    throw new Error(
      `payroll_run_insert_failed: ${insertError?.message ?? "no row returned"}`,
    );
  }

  const runId = runRow.id;
  let aggregated: ReturnType<typeof aggregateRunResults>;

  try {
    // 2. Execute — each professor is independently try/caught inside
    const results = await computeMonthlyPayslipsForPeriod(period);
    aggregated = aggregateRunResults(results);
  } catch (fatalErr) {
    // computeMonthlyPayslipsForPeriod threw at the query level (not per-professor)
    const message =
      fatalErr instanceof Error ? fatalErr.message : "unknown_fatal_error";
    aggregated = {
      status: "failed",
      professorsProcessed: 0,
      payslipsCreated: 0,
      familyDocsCreated: 0,
      familyDocsFailed: 0,
      contribErrors: 0,
      errorsCount: 1,
      errorDetails: [{ professorId: "ALL", message }],
    };
  }

  const finishedAt = new Date().toISOString();
  const durationMs =
    new Date(finishedAt).getTime() - new Date(startedAt).getTime();

  // 3. Update run record with all real counters
  await supabase
    .from("payroll_runs")
    .update({
      status: aggregated.status,
      finished_at: finishedAt,
      professors_processed: aggregated.professorsProcessed,
      payslips_created: aggregated.payslipsCreated,
      family_docs_created: aggregated.familyDocsCreated,
      family_docs_failed: aggregated.familyDocsFailed,
      contrib_errors: aggregated.contribErrors,
      errors_count: aggregated.errorsCount,
      error_details: aggregated.errorDetails.length > 0 ? aggregated.errorDetails : null,
    })
    .eq("id", runId);

  return {
    runId,
    period,
    status: aggregated.status,
    professorsProcessed: aggregated.professorsProcessed,
    payslipsCreated: aggregated.payslipsCreated,
    familyDocsCreated: aggregated.familyDocsCreated,
    familyDocsFailed: aggregated.familyDocsFailed,
    contribErrors: aggregated.contribErrors,
    errorsCount: aggregated.errorsCount,
    errorDetails: aggregated.errorDetails,
    startedAt,
    finishedAt,
    durationMs,
  };
}

/**
 * Returns the most recent payroll_runs rows for a given period (for UI display).
 */
export async function getPayrollRunsForPeriod(
  period: string,
): Promise<PayrollRunRow[]> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("payroll_runs")
    .select(
      "id, period, status, triggered_by, started_at, finished_at, professors_processed, payslips_created, family_docs_created, family_docs_failed, contrib_errors, errors_count, error_details",
    )
    .eq("period", period)
    .order("started_at", { ascending: false });

  return (data ?? []) as PayrollRunRow[];
}

/**
 * Returns the most recent payroll_runs rows across all periods (last N).
 */
export async function getRecentPayrollRuns(
  limit = 20,
): Promise<PayrollRunRow[]> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("payroll_runs")
    .select(
      "id, period, status, triggered_by, started_at, finished_at, professors_processed, payslips_created, family_docs_created, family_docs_failed, contrib_errors, errors_count, error_details",
    )
    .order("started_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as PayrollRunRow[];
}

export type PayrollRunRow = {
  id: string;
  period: string;
  status: string;
  triggered_by: string | null;
  started_at: string;
  finished_at: string | null;
  professors_processed: number;
  payslips_created: number;
  family_docs_created: number;
  family_docs_failed: number;
  contrib_errors: number;
  errors_count: number;
  error_details: Array<{ professorId: string; message: string }> | null;
};
