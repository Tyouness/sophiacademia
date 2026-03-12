/**
 * pilot/period.ts — URSSAF-20
 *
 * Fonctions pures pour la sélection et la validation de la période
 * d'un pilote terrain réel.
 *
 * Règle fondamentale :
 *  La période doit être **antérieure au mois courant** (mois entièrement clos).
 *  La période recommandée est M-1 (le mois précédent).
 *  Une période trop ancienne (> 12 mois) est refusée car les données
 *  pourraient ne plus être cohérentes.
 */

// ── Fonctions de base ─────────────────────────────────────────────────────────

/** Retourne le mois courant au format YYYY-MM (UTC). */
export function getCurrentPeriod(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Retourne la période recommandée pour le premier pilote : M-1 (UTC).
 * Correspond au dernier mois entièrement clos.
 */
export function getRecommendedPeriod(): string {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ── Validation ────────────────────────────────────────────────────────────────

export type PeriodValidationResult = {
  valid: boolean;
  /** Motif de rejet (null si valid) */
  reason: string | null;
  /** true si la période correspond exactement à M-1 */
  isRecommended: boolean;
};

/**
 * Valide qu'une période convient pour un pilote terrain réel.
 *
 * Critères :
 *  1. Format correct (YYYY-MM)
 *  2. Période < mois courant (mois entièrement clos)
 *  3. Période ≤ 12 mois dans le passé
 */
export function validatePilotPeriod(period: string): PeriodValidationResult {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) {
    return {
      valid: false,
      reason: "Format de période invalide — attendu YYYY-MM",
      isRecommended: false,
    };
  }

  const current = getCurrentPeriod();
  const recommended = getRecommendedPeriod();

  // Rejeter le mois courant ou futur
  if (period >= current) {
    return {
      valid: false,
      reason:
        "Le mois courant n'est pas encore clos — choisir le mois M-1 ou antérieur",
      isRecommended: false,
    };
  }

  // Rejeter si trop ancien (> 12 mois)
  const [y, mo] = period.split("-").map(Number);
  const [cy, cm] = current.split("-").map(Number);
  const monthsBack = (cy - y) * 12 + (cm - mo);
  if (monthsBack > 12) {
    return {
      valid: false,
      reason:
        "Période trop ancienne (> 12 mois) — les données pourraient être incohérentes",
      isRecommended: false,
    };
  }

  return {
    valid: true,
    reason: null,
    isRecommended: period === recommended,
  };
}
