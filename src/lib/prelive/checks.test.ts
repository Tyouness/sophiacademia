import { describe, expect, it } from "vitest";
import { computePreliveSummary, type PreliveInput } from "./checks";

// ── Helpers ────────────────────────────────────────────────────────────────────

function cleanInput(): PreliveInput {
  return {
    criticalAnomalies: 0,
    importantAnomalies: 0,
    stuckRunsCount: 0,
    professorsWithPayrollIssues: 0,
    familiesWithActiveUrssafAndIssues: 0,
    failedRunsLast30Days: 0,
  };
}

// ── Statut global ──────────────────────────────────────────────────────────────

describe("computePreliveSummary — statut global", () => {
  it("retourne ok quand toutes les données sont propres", () => {
    const result = computePreliveSummary(cleanInput());
    expect(result.globalStatus).toBe("ok");
    expect(result.blockingCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it("retourne blocked si anomalies critiques > 0", () => {
    const result = computePreliveSummary({ ...cleanInput(), criticalAnomalies: 2 });
    expect(result.globalStatus).toBe("blocked");
    expect(result.blockingCount).toBeGreaterThan(0);
  });

  it("retourne blocked si runs bloqués > 0", () => {
    const result = computePreliveSummary({ ...cleanInput(), stuckRunsCount: 1 });
    expect(result.globalStatus).toBe("blocked");
  });

  it("retourne blocked si professeurs avec dossier incomplet > 0", () => {
    const result = computePreliveSummary({
      ...cleanInput(),
      professorsWithPayrollIssues: 1,
    });
    expect(result.globalStatus).toBe("blocked");
  });

  it("retourne warning (pas blocked) si seulement anomalies importantes", () => {
    const result = computePreliveSummary({
      ...cleanInput(),
      importantAnomalies: 3,
    });
    expect(result.globalStatus).toBe("warning");
    expect(result.blockingCount).toBe(0);
    expect(result.warningCount).toBeGreaterThan(0);
  });

  it("retourne warning si seulement runs récents en échec", () => {
    const result = computePreliveSummary({
      ...cleanInput(),
      failedRunsLast30Days: 1,
    });
    expect(result.globalStatus).toBe("warning");
  });

  it("retourne warning si seulement familles URSSAF incomplètes", () => {
    const result = computePreliveSummary({
      ...cleanInput(),
      familiesWithActiveUrssafAndIssues: 2,
    });
    expect(result.globalStatus).toBe("warning");
  });

  it("blocked prend la priorité sur warning", () => {
    const result = computePreliveSummary({
      criticalAnomalies: 1,      // blocked
      importantAnomalies: 5,     // warning
      stuckRunsCount: 0,
      professorsWithPayrollIssues: 0,
      familiesWithActiveUrssafAndIssues: 2, // warning
      failedRunsLast30Days: 0,
    });
    expect(result.globalStatus).toBe("blocked");
    expect(result.blockingCount).toBe(1);
    expect(result.warningCount).toBeGreaterThan(0);
  });
});

// ── Structure des critères ────────────────────────────────────────────────────

describe("computePreliveSummary — structure critères", () => {
  it("retourne exactement 6 critères", () => {
    const result = computePreliveSummary(cleanInput());
    expect(result.criteria).toHaveLength(6);
  });

  it("les 3 premiers critères sont blocking=true", () => {
    const result = computePreliveSummary(cleanInput());
    const blocking = result.criteria.filter((c) => c.blocking);
    expect(blocking).toHaveLength(3);
    expect(blocking.map((c) => c.code)).toEqual([
      "no_critical_consistency_anomalies",
      "no_stuck_payroll_run",
      "no_professor_payroll_incomplete",
    ]);
  });

  it("les 3 derniers critères sont blocking=false", () => {
    const result = computePreliveSummary(cleanInput());
    const nonBlocking = result.criteria.filter((c) => !c.blocking);
    expect(nonBlocking).toHaveLength(3);
    expect(nonBlocking.map((c) => c.code)).toEqual([
      "no_important_consistency_anomalies",
      "no_recent_failed_runs",
      "no_family_urssaf_dossier_incomplete",
    ]);
  });

  it("tous les critères ont un actionLink non null", () => {
    const result = computePreliveSummary(cleanInput());
    for (const c of result.criteria) {
      expect(c.actionLink).not.toBeNull();
    }
  });

  it("detail est null quand le critère est ok", () => {
    const result = computePreliveSummary(cleanInput());
    for (const c of result.criteria) {
      expect(c.status).toBe("ok");
      expect(c.detail).toBeNull();
    }
  });
});

// ── Critère C1 : anomalies critiques ─────────────────────────────────────────

describe("critère C1 — no_critical_consistency_anomalies", () => {
  it("ok si 0 anomalies critiques", () => {
    const { criteria } = computePreliveSummary(cleanInput());
    const c1 = criteria.find((c) => c.code === "no_critical_consistency_anomalies")!;
    expect(c1.status).toBe("ok");
    expect(c1.detail).toBeNull();
  });

  it("blocked si >=1 anomalie critique", () => {
    const { criteria } = computePreliveSummary({
      ...cleanInput(),
      criticalAnomalies: 3,
    });
    const c1 = criteria.find((c) => c.code === "no_critical_consistency_anomalies")!;
    expect(c1.status).toBe("blocked");
    expect(c1.detail).toContain("3");
    expect(c1.actionLink).toBe("/admin/consistency");
  });
});

// ── Critère C2 : runs bloqués ─────────────────────────────────────────────────

describe("critère C2 — no_stuck_payroll_run", () => {
  it("ok si 0 run bloqué", () => {
    const { criteria } = computePreliveSummary(cleanInput());
    const c2 = criteria.find((c) => c.code === "no_stuck_payroll_run")!;
    expect(c2.status).toBe("ok");
  });

  it("blocked si >=1 run bloqué", () => {
    const { criteria } = computePreliveSummary({
      ...cleanInput(),
      stuckRunsCount: 2,
    });
    const c2 = criteria.find((c) => c.code === "no_stuck_payroll_run")!;
    expect(c2.status).toBe("blocked");
    expect(c2.detail).toContain("2");
    expect(c2.actionLink).toBe("/admin/payroll");
  });
});

// ── Critère C3 : professeurs incomplets ──────────────────────────────────────

describe("critère C3 — no_professor_payroll_incomplete", () => {
  it("ok si 0 professeur incomplet", () => {
    const { criteria } = computePreliveSummary(cleanInput());
    const c3 = criteria.find((c) => c.code === "no_professor_payroll_incomplete")!;
    expect(c3.status).toBe("ok");
  });

  it("blocked si >=1 professeur avec dossier incomplet", () => {
    const { criteria } = computePreliveSummary({
      ...cleanInput(),
      professorsWithPayrollIssues: 1,
    });
    const c3 = criteria.find((c) => c.code === "no_professor_payroll_incomplete")!;
    expect(c3.status).toBe("blocked");
    expect(c3.detail).toContain("1 professeur");
  });
});

// ── Critère C4 : anomalies importantes ───────────────────────────────────────

describe("critère C4 — no_important_consistency_anomalies", () => {
  it("ok si 0 anomalie importante", () => {
    const { criteria } = computePreliveSummary(cleanInput());
    const c4 = criteria.find((c) => c.code === "no_important_consistency_anomalies")!;
    expect(c4.status).toBe("ok");
    expect(c4.blocking).toBe(false);
  });

  it("warning (pas blocked) si >=1 anomalie importante", () => {
    const { criteria } = computePreliveSummary({
      ...cleanInput(),
      importantAnomalies: 4,
    });
    const c4 = criteria.find((c) => c.code === "no_important_consistency_anomalies")!;
    expect(c4.status).toBe("warning");
    expect(c4.detail).toContain("4");
  });
});

// ── Critère C5 : runs en échec ────────────────────────────────────────────────

describe("critère C5 — no_recent_failed_runs", () => {
  it("ok si 0 run en échec récent", () => {
    const { criteria } = computePreliveSummary(cleanInput());
    const c5 = criteria.find((c) => c.code === "no_recent_failed_runs")!;
    expect(c5.status).toBe("ok");
    expect(c5.blocking).toBe(false);
  });

  it("warning si >=1 run en échec récent", () => {
    const { criteria } = computePreliveSummary({
      ...cleanInput(),
      failedRunsLast30Days: 2,
    });
    const c5 = criteria.find((c) => c.code === "no_recent_failed_runs")!;
    expect(c5.status).toBe("warning");
    expect(c5.actionLink).toBe("/admin/payroll");
  });
});

// ── Critère C6 : familles URSSAF incomplètes ─────────────────────────────────

describe("critère C6 — no_family_urssaf_dossier_incomplete", () => {
  it("ok si 0 famille incomplète", () => {
    const { criteria } = computePreliveSummary(cleanInput());
    const c6 = criteria.find((c) => c.code === "no_family_urssaf_dossier_incomplete")!;
    expect(c6.status).toBe("ok");
    expect(c6.blocking).toBe(false);
  });

  it("warning si >=1 famille URSSAF active incomplète", () => {
    const { criteria } = computePreliveSummary({
      ...cleanInput(),
      familiesWithActiveUrssafAndIssues: 1,
    });
    const c6 = criteria.find((c) => c.code === "no_family_urssaf_dossier_incomplete")!;
    expect(c6.status).toBe("warning");
    expect(c6.detail).toContain("1 famille");
  });
});

// ── Compteurs blockingCount / warningCount ────────────────────────────────────

describe("compteurs blockingCount / warningCount", () => {
  it("blockingCount = 0 sur données propres", () => {
    expect(computePreliveSummary(cleanInput()).blockingCount).toBe(0);
  });

  it("blockingCount = 2 si deux critères bloquants actifs", () => {
    const result = computePreliveSummary({
      ...cleanInput(),
      criticalAnomalies: 1,   // C1 blocked
      stuckRunsCount: 1,       // C2 blocked
    });
    expect(result.blockingCount).toBe(2);
  });

  it("warningCount = 2 si deux critères de surveillance actifs", () => {
    const result = computePreliveSummary({
      ...cleanInput(),
      importantAnomalies: 1,              // C4 warning
      failedRunsLast30Days: 1,            // C5 warning
    });
    expect(result.warningCount).toBe(2);
    expect(result.blockingCount).toBe(0);
  });

  it("maximum possible : 3 blocants + 3 warnings", () => {
    const result = computePreliveSummary({
      criticalAnomalies: 1,
      importantAnomalies: 1,
      stuckRunsCount: 1,
      professorsWithPayrollIssues: 1,
      familiesWithActiveUrssafAndIssues: 1,
      failedRunsLast30Days: 1,
    });
    expect(result.blockingCount).toBe(3);
    expect(result.warningCount).toBe(3);
    expect(result.globalStatus).toBe("blocked");
  });
});

// ── generatedAt ──────────────────────────────────────────────────────────────

describe("generatedAt", () => {
  it("est une chaîne ISO valide", () => {
    const result = computePreliveSummary(cleanInput());
    expect(new Date(result.generatedAt).toISOString()).toBe(result.generatedAt);
  });
});
