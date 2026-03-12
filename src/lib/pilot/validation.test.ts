/**
 * pilot/validation.test.ts — URSSAF-15
 *
 * Tests unitaires de checkPilotArtifacts() et computePilotValidationReport().
 * Aucun appel DB — données 100 % injectées.
 */

import { describe, it, expect } from "vitest";
import {
  checkPilotArtifacts,
  computePilotValidationReport,
  type PilotValidationInput,
} from "./validation";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Base fully-valid input — all 7 artifacts present. */
function makeInput(
  overrides: Partial<PilotValidationInput> = {},
): PilotValidationInput {
  return {
    professorId: "prof-1",
    professorName: "Alice Dupont",
    period: "2026-01",
    paidCoursesCount: 3,
    paidCourseIds: ["c1", "c2", "c3"],
    payslipId: "ps-1",
    payslipNumber: "PAY-2026-00001",
    payslipLinesCount: 3,
    contributionLinesCount: 7,
    familiesInScope: ["fam-1", "fam-2"],
    familiesWithDocument: ["fam-1", "fam-2"],
    criticalAnomalyCount: 0,
    ...overrides,
  };
}

// ── A1 — Cours payés ──────────────────────────────────────────────────────────

describe("checkPilotArtifacts — A1 paid_courses", () => {
  it("présent si paidCoursesCount > 0", () => {
    const r = checkPilotArtifacts(makeInput());
    const a1 = r.artifacts.find((a) => a.code === "paid_courses")!;
    expect(a1.status).toBe("present");
    expect(a1.detail).toContain("3 cours");
  });

  it("manquant si paidCoursesCount === 0 → verdict failed", () => {
    const r = checkPilotArtifacts(
      makeInput({ paidCoursesCount: 0, paidCourseIds: [] }),
    );
    const a1 = r.artifacts.find((a) => a.code === "paid_courses")!;
    expect(a1.status).toBe("missing");
    expect(r.verdict).toBe("failed");
  });
});

// ── A2 — Bulletin généré ──────────────────────────────────────────────────────

describe("checkPilotArtifacts — A2 payslip_exists", () => {
  it("présent si payslipId non null", () => {
    const r = checkPilotArtifacts(makeInput());
    const a2 = r.artifacts.find((a) => a.code === "payslip_exists")!;
    expect(a2.status).toBe("present");
  });

  it("manquant si payslipId null → verdict failed", () => {
    const r = checkPilotArtifacts(
      makeInput({ payslipId: null, payslipNumber: null }),
    );
    const a2 = r.artifacts.find((a) => a.code === "payslip_exists")!;
    expect(a2.status).toBe("missing");
    expect(r.verdict).toBe("failed");
  });
});

// ── A3 — Numéro légal ─────────────────────────────────────────────────────────

describe("checkPilotArtifacts — A3 payslip_number", () => {
  it("présent si payslip existe + number non null", () => {
    const r = checkPilotArtifacts(makeInput());
    const a3 = r.artifacts.find((a) => a.code === "payslip_number")!;
    expect(a3.status).toBe("present");
    expect(a3.detail).toBe("PAY-2026-00001");
  });

  it("manquant si number null → verdict incomplete", () => {
    const r = checkPilotArtifacts(makeInput({ payslipNumber: null }));
    const a3 = r.artifacts.find((a) => a.code === "payslip_number")!;
    expect(a3.status).toBe("missing");
    expect(r.verdict).toBe("incomplete");
  });

  it("manquant si payslipId null (A2 manque aussi)", () => {
    const r = checkPilotArtifacts(
      makeInput({ payslipId: null, payslipNumber: null }),
    );
    const a3 = r.artifacts.find((a) => a.code === "payslip_number")!;
    expect(a3.status).toBe("missing");
  });
});

// ── A4 — Lignes de bulletin ───────────────────────────────────────────────────

describe("checkPilotArtifacts — A4 payslip_lines", () => {
  it("présent si payslipLinesCount > 0", () => {
    const r = checkPilotArtifacts(makeInput());
    const a4 = r.artifacts.find((a) => a.code === "payslip_lines")!;
    expect(a4.status).toBe("present");
    expect(a4.detail).toContain("3 lignes");
  });

  it("manquant si payslipLinesCount === 0 → incomplete", () => {
    const r = checkPilotArtifacts(makeInput({ payslipLinesCount: 0 }));
    const a4 = r.artifacts.find((a) => a.code === "payslip_lines")!;
    expect(a4.status).toBe("missing");
    expect(r.verdict).toBe("incomplete");
  });
});

// ── A5 — Cotisations sociales ─────────────────────────────────────────────────

describe("checkPilotArtifacts — A5 contribution_lines", () => {
  it("présent si contributionLinesCount > 0", () => {
    const r = checkPilotArtifacts(makeInput());
    const a5 = r.artifacts.find((a) => a.code === "contribution_lines")!;
    expect(a5.status).toBe("present");
    expect(a5.detail).toContain("7 cotisations");
  });

  it("manquant si 0 cotisations → incomplete", () => {
    const r = checkPilotArtifacts(makeInput({ contributionLinesCount: 0 }));
    const a5 = r.artifacts.find((a) => a.code === "contribution_lines")!;
    expect(a5.status).toBe("missing");
    expect(r.verdict).toBe("incomplete");
  });
});

// ── A6 — Documents famille ────────────────────────────────────────────────────

describe("checkPilotArtifacts — A6 family_documents", () => {
  it("présent si toutes les familles ont un document", () => {
    const r = checkPilotArtifacts(makeInput());
    const a6 = r.artifacts.find((a) => a.code === "family_documents")!;
    expect(a6.status).toBe("present");
    expect(a6.detail).toContain("2 document(s)");
  });

  it("partial si certaines familles ont un doc mais pas toutes → incomplete", () => {
    const r = checkPilotArtifacts(
      makeInput({
        familiesInScope: ["fam-1", "fam-2"],
        familiesWithDocument: ["fam-1"],
      }),
    );
    const a6 = r.artifacts.find((a) => a.code === "family_documents")!;
    expect(a6.status).toBe("partial");
    expect(a6.detail).toContain("1/2 présent(s)");
    expect(a6.detail).toContain("1 manquant(s)");
    expect(r.verdict).toBe("incomplete");
  });

  it("manquant si aucune famille n'a de document → incomplete", () => {
    const r = checkPilotArtifacts(
      makeInput({
        familiesInScope: ["fam-1", "fam-2"],
        familiesWithDocument: [],
      }),
    );
    const a6 = r.artifacts.find((a) => a.code === "family_documents")!;
    expect(a6.status).toBe("missing");
    expect(r.verdict).toBe("incomplete");
  });

  it("manquant si aucune famille en scope → incomplete", () => {
    const r = checkPilotArtifacts(
      makeInput({ familiesInScope: [], familiesWithDocument: [] }),
    );
    const a6 = r.artifacts.find((a) => a.code === "family_documents")!;
    expect(a6.status).toBe("missing");
    expect(r.verdict).toBe("incomplete");
  });
});

// ── A7 — Anomalies critiques ──────────────────────────────────────────────────

describe("checkPilotArtifacts — A7 no_critical_anomalies", () => {
  it("présent si 0 anomalie critique", () => {
    const r = checkPilotArtifacts(makeInput());
    const a7 = r.artifacts.find((a) => a.code === "no_critical_anomalies")!;
    expect(a7.status).toBe("present");
    expect(a7.detail).toBeNull();
  });

  it("manquant si anomalies critiques → incomplete", () => {
    const r = checkPilotArtifacts(makeInput({ criticalAnomalyCount: 2 }));
    const a7 = r.artifacts.find((a) => a.code === "no_critical_anomalies")!;
    expect(a7.status).toBe("missing");
    expect(a7.detail).toContain("2 anomalie(s) critique(s)");
    expect(r.verdict).toBe("incomplete");
  });
});

// ── Verdict global ────────────────────────────────────────────────────────────

describe("checkPilotArtifacts — verdict", () => {
  it("success si tous les artefacts sont présents", () => {
    const r = checkPilotArtifacts(makeInput());
    expect(r.verdict).toBe("success");
    expect(r.missingCount).toBe(0);
  });

  it("failed si paidCoursesCount === 0 même si payslip existe", () => {
    const r = checkPilotArtifacts(
      makeInput({ paidCoursesCount: 0, paidCourseIds: [] }),
    );
    expect(r.verdict).toBe("failed");
  });

  it("failed si payslipId null (run n'a pas produit de bulletin)", () => {
    const r = checkPilotArtifacts(
      makeInput({ payslipId: null, payslipNumber: null }),
    );
    expect(r.verdict).toBe("failed");
  });

  it("incomplete si plusieurs artefacts manquent mais payslip présent", () => {
    const r = checkPilotArtifacts(
      makeInput({
        payslipNumber: null,
        payslipLinesCount: 0,
        contributionLinesCount: 0,
      }),
    );
    expect(r.verdict).toBe("incomplete");
    expect(r.missingCount).toBeGreaterThanOrEqual(3);
  });

  it("missingCount = 0 ↔ success", () => {
    const r = checkPilotArtifacts(makeInput());
    expect(r.missingCount).toBe(0);
    expect(r.verdict).toBe("success");
  });

  it("retourne professorId, professorName, period", () => {
    const r = checkPilotArtifacts(makeInput());
    expect(r.professorId).toBe("prof-1");
    expect(r.professorName).toBe("Alice Dupont");
    expect(r.period).toBe("2026-01");
  });

  it("retourne 7 artefacts dans tous les cas", () => {
    const r = checkPilotArtifacts(makeInput());
    expect(r.artifacts).toHaveLength(7);
  });
});

// ── computePilotValidationReport ─────────────────────────────────────────────

describe("computePilotValidationReport", () => {
  it("rapport vide si aucun résultat", () => {
    const report = computePilotValidationReport([]);
    expect(report.successCount).toBe(0);
    expect(report.incompleteCount).toBe(0);
    expect(report.failedCount).toBe(0);
    expect(report.results).toHaveLength(0);
    expect(report.generatedAt).toBeTruthy();
  });

  it("compte correctement success / incomplete / failed", () => {
    const s = checkPilotArtifacts(makeInput({ period: "2026-01" }));
    const i = checkPilotArtifacts(
      makeInput({ period: "2026-02", payslipNumber: null }),
    );
    const f = checkPilotArtifacts(
      makeInput({ period: "2026-03", payslipId: null, payslipNumber: null }),
    );
    const report = computePilotValidationReport([s, i, f]);
    expect(report.successCount).toBe(1);
    expect(report.incompleteCount).toBe(1);
    expect(report.failedCount).toBe(1);
  });

  it("trie failed → incomplete → success", () => {
    const s = checkPilotArtifacts(makeInput({ period: "2026-01" }));
    const i = checkPilotArtifacts(
      makeInput({ period: "2026-01", payslipNumber: null }),
    );
    const f = checkPilotArtifacts(
      makeInput({ period: "2026-01", payslipId: null, payslipNumber: null }),
    );
    const report = computePilotValidationReport([s, i, f]);
    expect(report.results[0].verdict).toBe("failed");
    expect(report.results[1].verdict).toBe("incomplete");
    expect(report.results[2].verdict).toBe("success");
  });

  it("à verdict égal, trie par période décroissante", () => {
    const older = checkPilotArtifacts(makeInput({ period: "2025-11" }));
    const newer = checkPilotArtifacts(makeInput({ period: "2026-02" }));
    const report = computePilotValidationReport([older, newer]);
    expect(report.results[0].period).toBe("2026-02");
    expect(report.results[1].period).toBe("2025-11");
  });

  it("nom null n'écrase pas le tri", () => {
    const a = checkPilotArtifacts(
      makeInput({ professorName: null, period: "2026-01" }),
    );
    const b = checkPilotArtifacts(
      makeInput({ professorName: "Zara", period: "2026-01" }),
    );
    const report = computePilotValidationReport([a, b]);
    // Les deux sont success — le tri par période est stable, pas d'erreur
    expect(report.results).toHaveLength(2);
  });
});
