/**
 * pilot/scoring.test.ts — URSSAF-19
 */

import { describe, it, expect } from "vitest";
import {
  computePilotCandidateScore,
  buildCandidateRecommendation,
  rankEligibleCandidates,
} from "./scoring";
import type { PilotPairResult } from "./eligibility";

// ── computePilotCandidateScore ────────────────────────────────────────────────

describe("computePilotCandidateScore — S1 famille", () => {
  it("1 famille = +10 (max bonus)", () => {
    expect(computePilotCandidateScore(1, 5)).toBe(18); // 10 + 8
  });

  it("2 familles = +5", () => {
    expect(computePilotCandidateScore(2, 5)).toBe(13); // 5 + 8
  });

  it("3+ familles = +0", () => {
    expect(computePilotCandidateScore(3, 5)).toBe(8); // 0 + 8
  });
});

describe("computePilotCandidateScore — S2 volume cours", () => {
  it("3–10 cours = +8 (idéal)", () => {
    expect(computePilotCandidateScore(1, 3)).toBe(18);
    expect(computePilotCandidateScore(1, 10)).toBe(18);
  });

  it("11–20 cours = +5", () => {
    expect(computePilotCandidateScore(1, 11)).toBe(15);
    expect(computePilotCandidateScore(1, 20)).toBe(15);
  });

  it("cours > 20 = +3", () => {
    expect(computePilotCandidateScore(1, 21)).toBe(13);
  });

  it("1–2 cours = +2", () => {
    expect(computePilotCandidateScore(1, 1)).toBe(12);
    expect(computePilotCandidateScore(1, 2)).toBe(12);
  });
});

// ── buildCandidateRecommendation ──────────────────────────────────────────────

describe("buildCandidateRecommendation", () => {
  it("1 famille + 3–10 cours = candidat idéal", () => {
    expect(buildCandidateRecommendation(1, 5)).toContain("idéal");
  });

  it("1 famille + 1 cours = volume faible", () => {
    expect(buildCandidateRecommendation(1, 1)).toContain("faible");
  });

  it("1 famille + 11 cours = volume élevé", () => {
    expect(buildCandidateRecommendation(1, 11)).toContain("élevé");
  });

  it("2 familles + 10 cours = acceptable", () => {
    expect(buildCandidateRecommendation(2, 10)).toContain("2 familles");
  });

  it("3 familles = complexe", () => {
    expect(buildCandidateRecommendation(3, 5)).toContain("Complexe");
  });
});

// ── rankEligibleCandidates ────────────────────────────────────────────────────

function makePair(
  professorId: string,
  familyId: string,
  paidCoursesCount: number,
  professorName: string | null = null,
): PilotPairResult {
  return {
    professorId,
    professorName,
    familyId,
    familyName: null,
    paidCoursesCount,
    status: "eligible",
    blockers: [],
  };
}

describe("rankEligibleCandidates — empty list", () => {
  it("returns empty array", () => {
    expect(rankEligibleCandidates([])).toEqual([]);
  });
});

describe("rankEligibleCandidates — single professor", () => {
  it("marks single professor as top candidate", () => {
    const pairs = [makePair("prof-1", "fam-1", 5)];
    const result = rankEligibleCandidates(pairs);
    expect(result).toHaveLength(1);
    expect(result[0].isTopCandidate).toBe(true);
  });

  it("aggregates totalCourses from multiple families", () => {
    const pairs = [
      makePair("prof-1", "fam-1", 5),
      makePair("prof-1", "fam-2", 3),
    ];
    const result = rankEligibleCandidates(pairs);
    expect(result[0].totalCourses).toBe(8);
    expect(result[0].familyIds).toHaveLength(2);
  });
});

describe("rankEligibleCandidates — ranking order", () => {
  it("1 famille 5 cours scores higher than 3 familles 5 cours", () => {
    const pairs = [
      makePair("prof-complex", "fam-1", 2, "Prof C"),
      makePair("prof-complex", "fam-2", 2, "Prof C"),
      makePair("prof-complex", "fam-3", 1, "Prof C"),
      makePair("prof-simple", "fam-4", 5, "Prof S"),
    ];
    const result = rankEligibleCandidates(pairs);
    expect(result[0].professorId).toBe("prof-simple");
    expect(result[0].isTopCandidate).toBe(true);
    expect(result[1].isTopCandidate).toBe(false);
  });

  it("only the first candidate has isTopCandidate = true", () => {
    const pairs = [
      makePair("prof-1", "fam-1", 5),
      makePair("prof-2", "fam-2", 4),
    ];
    const result = rankEligibleCandidates(pairs);
    const topCandidates = result.filter((r) => r.isTopCandidate);
    expect(topCandidates).toHaveLength(1);
  });

  it("ties broken alphabetically on professor name", () => {
    // Both have 1 family + 5 courses = same score
    const pairs = [
      makePair("prof-b", "fam-1", 5, "Zara"),
      makePair("prof-a", "fam-2", 5, "Albert"),
    ];
    const result = rankEligibleCandidates(pairs);
    expect(result[0].professorName).toBe("Albert");
  });
});

describe("rankEligibleCandidates — ineligible pairs ignored via input assumption", () => {
  it("eligible pair is included", () => {
    const pairs = [makePair("prof-1", "fam-1", 5)];
    expect(rankEligibleCandidates(pairs)).toHaveLength(1);
  });
});
