/**
 * decision/synthesis.test.ts — URSSAF-16
 *
 * Tests unitaires de computeDecisionSynthesis().
 * Aucun appel DB — données 100 % injectées.
 */

import { describe, it, expect } from "vitest";
import {
  computeDecisionSynthesis,
  type DecisionInput,
} from "./synthesis";
import type { PreliveSummary } from "@/lib/prelive/checks";
import type { PilotChecksResult } from "@/lib/pilot/runner";
import type { PilotValidationReport } from "@/lib/pilot/validation";

// ── Helpers / fixtures ────────────────────────────────────────────────────────

function makePrelive(
  globalStatus: "ok" | "blocked" | "warning",
  {
    blockingCount = 0,
    warningCount = 0,
    blockedCriteria = [] as Array<{ code: string; detail: string }>,
    warnCriteria = [] as Array<{ code: string; detail: string }>,
  } = {},
): PreliveSummary {
  const criteria = [
    ...blockedCriteria.map((c) => ({
      code: c.code,
      label: c.code,
      status: "blocked" as const,
      blocking: true,
      detail: c.detail,
      actionLink: "/admin/prelive",
      actionLabel: "Voir",
    })),
    ...warnCriteria.map((c) => ({
      code: c.code,
      label: c.code,
      status: "warning" as const,
      blocking: false,
      detail: c.detail,
      actionLink: "/admin/consistency",
      actionLabel: "Voir",
    })),
  ];
  return {
    globalStatus,
    generatedAt: "2026-03-12T00:00:00.000Z",
    blockingCount,
    warningCount,
    criteria,
  };
}

function makeEligibility(
  eligibleCount: number,
  {
    preliveBlocked = false,
    preliveBlockers = [] as string[],
  } = {},
): PilotChecksResult {
  return {
    report: {
      generatedAt: "2026-03-12T00:00:00.000Z",
      eligibleCount,
      ineligibleCount: 0,
      pairs: [],
    },
    preliveBlocked,
    preliveBlockers,
  };
}

function makeValidation(
  successCount: number,
  incompleteCount: number,
  failedCount: number,
): PilotValidationReport {
  return {
    generatedAt: "2026-03-12T00:00:00.000Z",
    successCount,
    incompleteCount,
    failedCount,
    results: [],
  };
}

function makeInput(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    prelive: makePrelive("ok"),
    eligibility: makeEligibility(2),
    validation: makeValidation(1, 0, 0),
    ...overrides,
  };
}

// ── Verdict global ────────────────────────────────────────────────────────────

describe("computeDecisionSynthesis — verdict", () => {
  it("hold si preliveGlobalStatus === blocked", () => {
    const s = computeDecisionSynthesis(
      makeInput({
        prelive: makePrelive("blocked", {
          blockingCount: 1,
          blockedCriteria: [
            { code: "no_critical_consistency_anomalies", detail: "2 anomalies critiques" },
          ],
        }),
      }),
    );
    expect(s.verdict).toBe("hold");
  });

  it("go si prelive ok ET eligibleCount > 0", () => {
    const s = computeDecisionSynthesis(makeInput());
    expect(s.verdict).toBe("go");
  });

  it("attention si prelive ok ET 0 éligibles", () => {
    const s = computeDecisionSynthesis(
      makeInput({ eligibility: makeEligibility(0) }),
    );
    expect(s.verdict).toBe("attention");
  });

  it("attention si prelive warning ET eligibleCount > 0", () => {
    const s = computeDecisionSynthesis(
      makeInput({
        prelive: makePrelive("warning", { warningCount: 1 }),
        eligibility: makeEligibility(1),
      }),
    );
    expect(s.verdict).toBe("attention");
  });

  it("attention si prelive warning ET 0 éligibles", () => {
    const s = computeDecisionSynthesis(
      makeInput({
        prelive: makePrelive("warning", { warningCount: 1 }),
        eligibility: makeEligibility(0),
      }),
    );
    expect(s.verdict).toBe("attention");
  });

  it("hold prend priorité sur eligibleCount > 0", () => {
    const s = computeDecisionSynthesis(
      makeInput({
        prelive: makePrelive("blocked", { blockingCount: 2 }),
        eligibility: makeEligibility(5),
      }),
    );
    expect(s.verdict).toBe("hold");
  });
});

// ── Comptes ───────────────────────────────────────────────────────────────────

describe("computeDecisionSynthesis — comptes", () => {
  it("reporte les comptes des trois rapports", () => {
    const s = computeDecisionSynthesis(
      makeInput({
        prelive: makePrelive("warning", { warningCount: 2 }),
        eligibility: makeEligibility(3),
        validation: makeValidation(1, 2, 1),
      }),
    );
    expect(s.eligiblePilotCount).toBe(3);
    expect(s.pilotSuccessCount).toBe(1);
    expect(s.pilotIncompleteCount).toBe(2);
    expect(s.pilotFailedCount).toBe(1);
    expect(s.warningCount).toBe(2);
  });

  it("blockingCount remonte depuis prelive", () => {
    const s = computeDecisionSynthesis(
      makeInput({
        prelive: makePrelive("blocked", { blockingCount: 3 }),
      }),
    );
    expect(s.blockingCount).toBe(3);
  });
});

// ── Priorités ─────────────────────────────────────────────────────────────────

describe("computeDecisionSynthesis — priorities", () => {
  it("aucune priorité si go sans pilotes incomplets ni warnings", () => {
    const s = computeDecisionSynthesis(makeInput());
    const blocking = s.priorities.filter((p) => p.blocking);
    // Aucun bloquant
    expect(blocking).toHaveLength(0);
    // Les warnings sont absents aussi car prelive = "ok"
    expect(s.priorities.filter((p) => !p.blocking)).toHaveLength(0);
  });

  it("priorité bloquante par critère bloqué", () => {
    const s = computeDecisionSynthesis(
      makeInput({
        prelive: makePrelive("blocked", {
          blockingCount: 2,
          blockedCriteria: [
            { code: "c1", detail: "Anomalie critique" },
            { code: "c2", detail: "Run bloqué" },
          ],
        }),
      }),
    );
    const blocking = s.priorities.filter((p) => p.blocking);
    expect(blocking).toHaveLength(2);
    expect(blocking[0].rank).toBe(1);
    expect(blocking[0].blocking).toBe(true);
    expect(blocking[0].label).toBe("Anomalie critique");
    expect(blocking[1].label).toBe("Run bloqué");
  });

  it("priorité bloquante si preliveBlocked (run bloqué dans eligibility)", () => {
    const s = computeDecisionSynthesis(
      makeInput({
        prelive: makePrelive("ok"),
        eligibility: makeEligibility(2, {
          preliveBlocked: true,
          preliveBlockers: ["1 run bloqué en statut running"],
        }),
      }),
    );
    const blocking = s.priorities.filter((p) => p.blocking);
    expect(blocking).toHaveLength(1);
    expect(blocking[0].label).toContain("run bloqué");
    expect(blocking[0].href).toBe("/admin/payroll");
  });

  it("priorité non bloquante pour pilotes incomplets", () => {
    const s = computeDecisionSynthesis(
      makeInput({
        validation: makeValidation(0, 2, 0),
      }),
    );
    const p = s.priorities.find((x) => x.href === "/admin/pilot/results" && x.label.includes("incomplet"));
    expect(p).toBeDefined();
    expect(p!.blocking).toBe(false);
  });

  it("priorité non bloquante pour pilotes en échec", () => {
    const s = computeDecisionSynthesis(
      makeInput({ validation: makeValidation(0, 0, 3) }),
    );
    const p = s.priorities.find((x) => x.label.includes("échec"));
    expect(p).toBeDefined();
    expect(p!.blocking).toBe(false);
  });

  it("avertissement si 0 éligible et prelive non bloqué", () => {
    const s = computeDecisionSynthesis(
      makeInput({ eligibility: makeEligibility(0) }),
    );
    const p = s.priorities.find((x) => x.label.includes("Aucun dossier pilote"));
    expect(p).toBeDefined();
    expect(p!.href).toBe("/admin/pilot");
  });

  it("pas d'avertissement 0 éligible si prelive bloqué", () => {
    const s = computeDecisionSynthesis(
      makeInput({
        prelive: makePrelive("blocked", { blockingCount: 1 }),
        eligibility: makeEligibility(0),
      }),
    );
    const p = s.priorities.find((x) => x.label.includes("Aucun dossier pilote"));
    // Ne doit pas apparaître si le système est de toute façon bloqué
    expect(p).toBeUndefined();
  });

  it("priorités de surveillance remontent les warnings de prelive", () => {
    const s = computeDecisionSynthesis(
      makeInput({
        prelive: makePrelive("warning", {
          warningCount: 1,
          warnCriteria: [{ code: "w1", detail: "Bulletin sans contribution" }],
        }),
        eligibility: makeEligibility(1),
      }),
    );
    const w = s.priorities.find((x) => x.label.includes("Bulletin sans contribution"));
    expect(w).toBeDefined();
    expect(w!.blocking).toBe(false);
  });

  it("rang des priorités croissant et sans trou", () => {
    const s = computeDecisionSynthesis(
      makeInput({
        prelive: makePrelive("blocked", {
          blockingCount: 1,
          blockedCriteria: [{ code: "c1", detail: "Critique" }],
        }),
        validation: makeValidation(0, 1, 1),
      }),
    );
    const ranks = s.priorities.map((p) => p.rank);
    expect(ranks).toEqual(ranks.map((_, i) => i + 1));
  });

  it("generatedAt est une date ISO valide", () => {
    const s = computeDecisionSynthesis(makeInput());
    expect(new Date(s.generatedAt).toISOString()).toBe(s.generatedAt);
  });
});
