/**
 * pilot/scoring.ts — URSSAF-19
 *
 * Fonctions pures pour classer les professeurs éligibles et recommander
 * le meilleur premier candidat pour le pilote terrain réel.
 *
 * Critères de score :
 *  S1. Nombre de familles : 1 famille = profil le plus simple (+10), 2 = +5, 3+ = +0
 *  S2. Volume de cours payés : 3–10 = idéal (+8), 11–20 = acceptable (+5),
 *      >20 = gros volume (+3), 1–2 = sous-représentatif (+2)
 *
 * Le candidat avec le score le plus élevé est marqué `isTopCandidate = true`.
 */

import type { PilotPairResult } from "./eligibility";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PilotCandidateRanking = {
  professorId: string;
  professorName: string | null;
  /** Toutes les familles éligibles de ce professeur */
  familyIds: string[];
  familyNames: (string | null)[];
  totalCourses: number;
  score: number;
  /** true uniquement pour le professeur avec le meilleur score */
  isTopCandidate: boolean;
  /** Texte court lisible expliquant le classement */
  recommendation: string;
};

// ── Calcul du score ───────────────────────────────────────────────────────────

/**
 * Calcule le score d'un professeur pour le premier pilote terrain.
 * Uniquement applicable à des paires de statut "eligible".
 *
 * @param familyCount — nombre de familles éligibles pour ce professeur
 * @param totalCourses — total de cours payés (toutes familles confondues)
 */
export function computePilotCandidateScore(
  familyCount: number,
  totalCourses: number,
): number {
  let score = 0;

  // S1 — Simplicité : moins de familles = test plus simple
  if (familyCount === 1) score += 10;
  else if (familyCount === 2) score += 5;
  // 3+ familles : 0 bonus (trop complexe pour un premier terrain)

  // S2 — Volume de cours
  if (totalCourses >= 3 && totalCourses <= 10) score += 8;
  else if (totalCourses >= 11 && totalCourses <= 20) score += 5;
  else if (totalCourses > 20) score += 3;
  else score += 2; // 1–2 cours

  return score;
}

/**
 * Génère le message de recommandation lisible.
 */
export function buildCandidateRecommendation(
  familyCount: number,
  totalCourses: number,
): string {
  if (familyCount === 1 && totalCourses >= 3 && totalCourses <= 10) {
    return "Candidat idéal — 1 famille, volume modéré (3–10 cours)";
  }
  if (familyCount === 1 && totalCourses < 3) {
    return "Candidat acceptable — 1 famille, volume faible (< 3 cours)";
  }
  if (familyCount === 1 && totalCourses > 10) {
    return "Candidat acceptable — 1 famille, volume élevé";
  }
  if (familyCount === 2 && totalCourses <= 15) {
    return "Acceptable — 2 familles, volume raisonnable";
  }
  return "Complexe — plusieurs familles ou volume très élevé";
}

// ── Ranking principal ──────────────────────────────────────────────────────────

/**
 * Classe les professeurs éligibles par score décroissant.
 *
 * Le premier de la liste (`isTopCandidate = true`) est le meilleur premier
 * candidat pour le pilote terrain. Fonction pure — testable sans DB.
 *
 * @param eligible — paires avec status "eligible" uniquement
 */
export function rankEligibleCandidates(
  eligible: PilotPairResult[],
): PilotCandidateRanking[] {
  // Regrouper par professeur
  const profMap = new Map<
    string,
    {
      pairs: PilotPairResult[];
      familyIds: string[];
      familyNames: (string | null)[];
      totalCourses: number;
    }
  >();

  for (const pair of eligible) {
    if (!profMap.has(pair.professorId)) {
      profMap.set(pair.professorId, {
        pairs: [],
        familyIds: [],
        familyNames: [],
        totalCourses: 0,
      });
    }
    const entry = profMap.get(pair.professorId)!;
    entry.pairs.push(pair);
    entry.familyIds.push(pair.familyId);
    entry.familyNames.push(pair.familyName);
    entry.totalCourses += pair.paidCoursesCount;
  }

  const ranked: PilotCandidateRanking[] = [];

  for (const [professorId, data] of profMap) {
    const score = computePilotCandidateScore(
      data.familyIds.length,
      data.totalCourses,
    );
    ranked.push({
      professorId,
      professorName: data.pairs[0].professorName,
      familyIds: data.familyIds,
      familyNames: data.familyNames,
      totalCourses: data.totalCourses,
      score,
      isTopCandidate: false,
      recommendation: buildCandidateRecommendation(
        data.familyIds.length,
        data.totalCourses,
      ),
    });
  }

  // Tri décroissant par score, puis alphabétique sur le nom en cas d'égalité
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.professorName ?? "").localeCompare(b.professorName ?? "", "fr");
  });

  if (ranked.length > 0) ranked[0].isTopCandidate = true;

  return ranked;
}
