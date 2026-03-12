/**
 * decision/synthesis.ts — URSSAF-16
 *
 * Logique pure de synthèse décisionnelle pour le tableau de bord admin.
 *
 * Agrège les signaux de trois briques existantes :
 *  - PreliveSummary  (runPreliveChecks)
 *  - PilotChecksResult (runPilotEligibilityChecks)
 *  - PilotValidationReport (runPilotValidation)
 *
 * Verdict global :
 *  hold       — blocage critique : preliveGlobalStatus === "blocked"
 *  go         — preliveGlobalStatus === "ok" ET au moins 1 dossier éligible
 *  attention  — tous les autres cas (warning, 0 éligibles, etc.)
 *
 * Architecture :
 *  - synthesis.ts  : types + logique pure (testable sans DB)
 *  - page.tsx      : fetch des 3 runners + rendu
 */

import type { PreliveSummary } from "@/lib/prelive/checks";
import type { PilotChecksResult } from "@/lib/pilot/runner";
import type { PilotValidationReport } from "@/lib/pilot/validation";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DecisionVerdict = "go" | "hold" | "attention";

/**
 * Une action prioritaire dérivée de l'état du système.
 * Chaque item est lié à une page pour agir directement.
 */
export type DecisionPriority = {
  /** Ordre croissant de priorité (1 = plus urgent) */
  rank: number;
  label: string;
  href: string;
  /** true si bloquant — empêche tout avancement */
  blocking: boolean;
};

export type DecisionSynthesis = {
  generatedAt: string;
  verdict: DecisionVerdict;

  // ── Comptes résumés ───────────────────────────────────────────────────────
  blockingCount: number;
  warningCount: number;
  eligiblePilotCount: number;
  pilotSuccessCount: number;
  pilotIncompleteCount: number;
  pilotFailedCount: number;

  /**
   * Actions prioritaires à entreprendre — ordonnées par urgence.
   * Vide si verdict === "go" et aucun pilote incomplet.
   */
  priorities: DecisionPriority[];
};

// ── Input ─────────────────────────────────────────────────────────────────────

export type DecisionInput = {
  prelive: PreliveSummary;
  eligibility: PilotChecksResult;
  validation: PilotValidationReport;
};

// ── Logique ───────────────────────────────────────────────────────────────────

/**
 * Calcule la synthèse décisionnelle à partir des trois rapports existants.
 * Fonction pure — testable sans DB.
 */
export function computeDecisionSynthesis(
  input: DecisionInput,
): DecisionSynthesis {
  const { prelive, eligibility, validation } = input;

  // ── Verdict ───────────────────────────────────────────────────────────────
  let verdict: DecisionVerdict;
  if (prelive.globalStatus === "blocked") {
    verdict = "hold";
  } else if (
    prelive.globalStatus === "ok" &&
    eligibility.report.eligibleCount > 0
  ) {
    verdict = "go";
  } else {
    verdict = "attention";
  }

  // ── Priorités ─────────────────────────────────────────────────────────────
  const priorities: DecisionPriority[] = [];
  let rank = 1;

  // Blocages critiques
  if (prelive.blockingCount > 0) {
    for (const c of prelive.criteria) {
      if (c.blocking && c.status === "blocked") {
        priorities.push({
          rank,
          label: c.detail ?? c.label,
          href: c.actionLink ?? "/admin/prelive",
          blocking: true,
        });
        rank++;
      }
    }
  }

  // Run pilote bloqué (bloquant pour tout nouveau run)
  if (eligibility.preliveBlocked) {
    for (const b of eligibility.preliveBlockers) {
      priorities.push({
        rank,
        label: b,
        href: "/admin/payroll",
        blocking: true,
      });
      rank++;
    }
  }

  // Pilotes incomplets
  if (validation.incompleteCount > 0) {
    priorities.push({
      rank,
      label: `${validation.incompleteCount} pilote(s) incomplet(s) — artefacts manquants à investiguer`,
      href: "/admin/pilot/results",
      blocking: false,
    });
    rank++;
  }

  // Pilotes en échec
  if (validation.failedCount > 0) {
    priorities.push({
      rank,
      label: `${validation.failedCount} pilote(s) en échec — run mensuel manquant ou raté`,
      href: "/admin/pilot/results",
      blocking: false,
    });
    rank++;
  }

  // Points de surveillance
  if (prelive.warningCount > 0) {
    for (const c of prelive.criteria) {
      if (!c.blocking && c.status === "warning") {
        priorities.push({
          rank,
          label: c.detail ?? c.label,
          href: c.actionLink ?? "/admin/prelive",
          blocking: false,
        });
        rank++;
      }
    }
  }

  // Aucun dossier éligible (signal d'opportunité manquante)
  if (
    eligibility.report.eligibleCount === 0 &&
    prelive.globalStatus !== "blocked"
  ) {
    priorities.push({
      rank,
      label:
        "Aucun dossier pilote éligible — compléter les dossiers professeur/famille",
      href: "/admin/pilot",
      blocking: false,
    });
    rank++;
  }

  return {
    generatedAt: new Date().toISOString(),
    verdict,
    blockingCount: prelive.blockingCount,
    warningCount: prelive.warningCount,
    eligiblePilotCount: eligibility.report.eligibleCount,
    pilotSuccessCount: validation.successCount,
    pilotIncompleteCount: validation.incompleteCount,
    pilotFailedCount: validation.failedCount,
    priorities,
  };
}
