/**
 * pilot/goGuard.ts — URSSAF-20
 *
 * Checklist "go immédiat" pour le premier pilote terrain réel.
 *
 * Produit une liste structurée de vérifications (label, ok, blocking, detail)
 * à partir des données déjà disponibles côté serveur — sans aucun appel DB.
 *
 * Statut d'une vérification :
 *  ok = true  → condition satisfaite
 *  ok = false → condition non satisfaite
 *  blocking   → si true et ok = false : le lancement est interdit
 *
 * Un lancement est possible uniquement si tous les items blocking sont ok.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type GoChecklistItem = {
  label: string;
  ok: boolean;
  /** Si true et ok=false : bloque le lancement */
  blocking: boolean;
  /** Contexte court affiché sous le label */
  detail: string | null;
};

export type FirstRunGoChecklistResult = {
  items: GoChecklistItem[];
  /** true = tous les items blocking sont ok */
  canGo: boolean;
  /** Nombre d'items blocking non satisfaits */
  blockingFailCount: number;
  /** Nombre d'items non-blocking non satisfaits (avertissements) */
  warningCount: number;
};

export type FirstRunGoChecklistInput = {
  /** Statut pré-live global */
  preliveStatus: "ok" | "warning" | "blocked";
  /** Nombre de pilot_runs WHERE status='running' */
  runningPilotCount: number;
  /** Le meilleur candidat (isTopCandidate) est-il éligible ? */
  topCandidateEligible: boolean;
  /** Nombre de familles du meilleur candidat */
  topCandidateFamilyCount: number;
  /** Volume de cours payés du meilleur candidat */
  topCandidateCourseCount: number;
  /** La période choisie est-elle valide (< mois courant, ≤ 12 mois) ? */
  periodIsValid: boolean;
  /** La période choisie est-elle M-1 (recommandée) ? */
  periodIsRecommended: boolean;
};

// ── Logique ───────────────────────────────────────────────────────────────────

/**
 * Construit la checklist "go immédiat" du premier pilote terrain réel.
 * Fonction pure — testable sans DB, sans effets de bord.
 */
export function buildFirstRunGoChecklist(
  input: FirstRunGoChecklistInput,
): FirstRunGoChecklistResult {
  const items: GoChecklistItem[] = [
    // 1. Pré-live non bloqué (blocking)
    {
      label: "Système pré-live non bloqué",
      ok: input.preliveStatus !== "blocked",
      blocking: true,
      detail:
        input.preliveStatus === "blocked"
          ? "Corriger les blocages pré-live avant tout lancement (/admin/prelive)"
          : input.preliveStatus === "warning"
            ? "Avertissement actif — lancement autorisé, surveiller de près"
            : null,
    },

    // 2. Aucun pilote actif globalement (blocking)
    {
      label: "Aucun pilote actif globalement",
      ok: input.runningPilotCount === 0,
      blocking: true,
      detail:
        input.runningPilotCount > 0
          ? `${input.runningPilotCount} pilote(s) déjà en cours — clôturer avant de relancer`
          : null,
    },

    // 3. Meilleur candidat éligible (blocking)
    {
      label: "Meilleur candidat toujours éligible",
      ok: input.topCandidateEligible,
      blocking: true,
      detail: input.topCandidateEligible
        ? null
        : "Le meilleur candidat n'est plus éligible — vérifier les dossiers",
    },

    // 4. Période valide (blocking)
    {
      label: "Période valide (antérieure au mois courant)",
      ok: input.periodIsValid,
      blocking: true,
      detail: input.periodIsValid
        ? null
        : "Sélectionner le mois M-1 ou antérieur — le mois courant n'est pas clos",
    },

    // 5. Période recommandée M-1 (non-blocking, warning)
    {
      label: "Période M-1 recommandée",
      ok: input.periodIsRecommended,
      blocking: false,
      detail: input.periodIsRecommended
        ? null
        : "Période acceptée mais pas M-1 — vérifier que le mois est entièrement clos",
    },

    // 6. Candidat mono-famille (non-blocking, warning)
    {
      label: "Candidat mono-famille (plus simple pour un premier test)",
      ok: input.topCandidateFamilyCount === 1,
      blocking: false,
      detail:
        input.topCandidateFamilyCount > 1
          ? `${input.topCandidateFamilyCount} familles — plus complexe, acceptable si candidat unique disponible`
          : null,
    },

    // 7. Volume dans la plage idéale (non-blocking, warning)
    {
      label: "Volume de cours dans la plage idéale (3–10)",
      ok: input.topCandidateCourseCount >= 3 && input.topCandidateCourseCount <= 10,
      blocking: false,
      detail:
        input.topCandidateCourseCount < 3
          ? `Volume faible (${input.topCandidateCourseCount} cours) — résultat représentatif réduit`
          : input.topCandidateCourseCount > 10
            ? `Volume élevé (${input.topCandidateCourseCount} cours) — plus de surface d'erreur`
            : null,
    },
  ];

  const blockingFailCount = items.filter((i) => i.blocking && !i.ok).length;
  const warningCount = items.filter((i) => !i.blocking && !i.ok).length;

  return {
    items,
    canGo: blockingFailCount === 0,
    blockingFailCount,
    warningCount,
  };
}
