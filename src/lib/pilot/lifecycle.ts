/**
 * pilot/lifecycle.ts — URSSAF-18
 *
 * Fonctions pures pour le cycle de vie d'un pilote encadré.
 * Aucun appel DB — les données sont injectées.
 *
 * Statuts du pilote :
 *  running              — déclaré, en attente d'exécution + évaluation
 *  completed_success    — les 7 artefacts de validation sont présents
 *  completed_incomplete — artefacts partiels (payslip existe, mais incomplet)
 *  completed_failed     — aucun payslip ou 0 cours payés
 *  abandoned            — abandonné manuellement par l'admin
 */

import type { PreliveGlobalStatus } from "@/lib/prelive/checks";
import type { PilotValidationVerdict } from "./validation";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PilotRunStatus =
  | "running"
  | "completed_success"
  | "completed_incomplete"
  | "completed_failed"
  | "abandoned";

export type PilotLaunchGuardResult = {
  /** true si le lancement est autorisé */
  allowed: boolean;
  /** Premier motif de blocage (null si allowed) */
  reason: string | null;
  /** Tous les motifs de blocage */
  details: string[];
};

// ── Libellés UI ───────────────────────────────────────────────────────────────

export const PILOT_RUN_STATUS_LABELS: Record<PilotRunStatus, string> = {
  running:              "En cours",
  completed_success:    "Réussi",
  completed_incomplete: "Incomplet",
  completed_failed:     "Échec",
  abandoned:            "Abandonné",
};

export const PILOT_RUN_STATUS_COLORS: Record<PilotRunStatus, string> = {
  running:              "bg-blue-100 text-blue-800",
  completed_success:    "bg-emerald-100 text-emerald-800",
  completed_incomplete: "bg-amber-100 text-amber-800",
  completed_failed:     "bg-red-100 text-red-800",
  abandoned:            "bg-gray-100 text-gray-600",
};

// ── Fonctions pures ───────────────────────────────────────────────────────────

/**
 * Vérifie si le lancement d'un pilote est autorisé.
 *
 * Conditions de blocage :
 * 1. Système prelive en état "blocked"
 * 2. La paire (professeur) n'est pas éligible
 * 3. Un pilote est déjà en cours sur ce professeur pour cette période
 */
export function checkPilotLaunchGuard(opts: {
  preliveStatus: PreliveGlobalStatus;
  pairEligible: boolean;
  hasActiveRunForSlot: boolean;
}): PilotLaunchGuardResult {
  const details: string[] = [];

  if (opts.preliveStatus === "blocked") {
    details.push(
      "Système en état hold — corriger les blocages pré-live avant tout lancement.",
    );
  }

  if (!opts.pairEligible) {
    details.push(
      "Le professeur ne dispose pas de dossier éligible pour ce pilote.",
    );
  }

  if (opts.hasActiveRunForSlot) {
    details.push(
      "Un pilote est déjà en cours pour ce professeur sur cette période.",
    );
  }

  if (details.length > 0) {
    return { allowed: false, reason: details[0], details };
  }

  return { allowed: true, reason: null, details: [] };
}

/**
 * Dérive le statut final d'un pilote à partir du verdict de validation.
 * Utilisé lors de la clôture d'un pilote (close action).
 */
export function derivePilotStatusFromVerdict(
  verdict: PilotValidationVerdict,
): Exclude<PilotRunStatus, "running" | "abandoned"> {
  switch (verdict) {
    case "success":    return "completed_success";
    case "incomplete": return "completed_incomplete";
    case "failed":     return "completed_failed";
  }
}

/**
 * true si le statut correspond à un pilote terminé (toutes fins confondues).
 */
export function isPilotClosed(status: PilotRunStatus): boolean {
  return status !== "running";
}

// ── Garde-fou premier pilote terrain (URSSAF-19) ──────────────────────────────

export type GlobalPilotGuardResult = {
  /** true si le lancement est autorisé */
  allowed: boolean;
  /** Message de blocage (null si allowed) */
  reason: string | null;
};

/**
 * Garde-fou "un seul pilote running globalement".
 *
 * Pour le premier pilote terrain réel, on veut au plus 1 pilote actif en même
 * temps — toutes paires confondues. Si un autre run est déjà en cours, le
 * lancement est refusé avec un message clair.
 *
 * @param runningPilotCount — nombre de lignes pilot_runs WHERE status='running'
 */
export function checkGlobalSinglePilotGuard(
  runningPilotCount: number,
): GlobalPilotGuardResult {
  if (runningPilotCount > 0) {
    return {
      allowed: false,
      reason:
        "Un pilote est déjà en cours d'exécution. Attendre sa clôture (ou son abandon) avant d'en lancer un nouveau.",
    };
  }
  return { allowed: true, reason: null };
}
