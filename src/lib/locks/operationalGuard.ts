/**
 * locks/operationalGuard.ts — URSSAF-17
 *
 * Garde-fous opératoires : vérifie si le système est dans un état autorisant
 * les actions sensibles (run mensuel, enregistrement URSSAF…).
 *
 * Fonctions pures — aucun appel DB. Les données sont injectées via PreliveSummary.
 */

import type { PreliveSummary } from "@/lib/prelive/checks";

export type OperationalGuardResult = {
  /** true si l'action est autorisée */
  allowed: boolean;
  /** Message humain expliquant le blocage (null si allowed) */
  reason: string | null;
  /** Détails des critères bloquants */
  details: string[];
  /** URL de la page corrective */
  actionLink: string;
};

/**
 * Vérifie si le système est dans un état autorisant les actions sensibles.
 *
 * Conditions de verrouillage :
 * - `prelive.globalStatus === "blocked"` : au moins un critère bloquant est rouge
 *
 * Le statut "warning" n'est PAS bloquant — il autorise l'action avec prudence.
 *
 * @returns `{ allowed: true }` si OK, `{ allowed: false, reason, details, actionLink }` sinon.
 */
export function checkOperationalGuard(
  prelive: PreliveSummary,
): OperationalGuardResult {
  if (prelive.globalStatus !== "blocked") {
    return { allowed: true, reason: null, details: [], actionLink: "/admin/prelive" };
  }

  const blockingCriteria = prelive.criteria.filter(
    (c) => c.blocking && c.status === "blocked",
  );

  const details = blockingCriteria
    .map((c) => c.detail)
    .filter((d): d is string => d !== null);

  const count = prelive.blockingCount;
  const reason =
    count === 1
      ? "Système en état hold — 1 blocage critique actif"
      : `Système en état hold — ${count} blocage(s) critique(s) actif(s)`;

  return {
    allowed: false,
    reason,
    details,
    actionLink: "/admin/prelive",
  };
}
