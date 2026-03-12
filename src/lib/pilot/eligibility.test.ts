import { describe, expect, it } from "vitest";
import {
  computePairEligibility,
  computePilotEligibilityReport,
  type PilotPairInput,
  type PilotPairResult,
} from "./eligibility";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fullInput(overrides: Partial<PilotPairInput> = {}): PilotPairInput {
  return {
    professorId: "prof-1",
    professorName: "Marie Dupont",
    familyId: "fam-1",
    familyName: "Famille Martin",
    paidCoursesCount: 3,
    professorPayrollReady: true,
    professorMissingFields: [],
    familyPayrollReady: true,
    familyMissingFields: [],
    hasCourseWithoutPayslipLine: false,
    ...overrides,
  };
}

// ── computePairEligibility ─────────────────────────────────────────────────────

describe("computePairEligibility", () => {
  it("retourne eligible quand tous les critères sont remplis", () => {
    const result = computePairEligibility(fullInput());
    expect(result.status).toBe("eligible");
    expect(result.blockers).toHaveLength(0);
    expect(result.professorId).toBe("prof-1");
    expect(result.familyId).toBe("fam-1");
    expect(result.paidCoursesCount).toBe(3);
  });

  // E1 — Aucun cours payé
  it("E1 — ineligible si paidCoursesCount === 0", () => {
    const result = computePairEligibility(fullInput({ paidCoursesCount: 0 }));
    expect(result.status).toBe("ineligible");
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toContain("Aucun cours payé");
  });

  // E2 — Dossier professeur
  it("E2 — ineligible si dossier professeur incomplet (sans détail de champs)", () => {
    const result = computePairEligibility(
      fullInput({ professorPayrollReady: false, professorMissingFields: [] }),
    );
    expect(result.status).toBe("ineligible");
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toContain("Dossier professeur incomplet");
  });

  it("E2 — liste les champs manquants dans le blocker", () => {
    const result = computePairEligibility(
      fullInput({
        professorPayrollReady: false,
        professorMissingFields: ["NIR (numéro sécurité sociale)", "IBAN"],
      }),
    );
    expect(result.blockers[0]).toContain("NIR");
    expect(result.blockers[0]).toContain("IBAN");
  });

  // E3 — Dossier famille
  it("E3 — ineligible si dossier famille incomplet", () => {
    const result = computePairEligibility(
      fullInput({ familyPayrollReady: false, familyMissingFields: ["Téléphone"] }),
    );
    expect(result.status).toBe("ineligible");
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toContain("Dossier famille incomplet");
    expect(result.blockers[0]).toContain("Téléphone");
  });

  // E4 — Cohérence cours/bulletin
  it("E4 — ineligible si un cours est absent de payslip_lines", () => {
    const result = computePairEligibility(
      fullInput({ hasCourseWithoutPayslipLine: true }),
    );
    expect(result.status).toBe("ineligible");
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toContain("pas couverts par un bulletin");
  });

  // Cumul de blockers
  it("accumule plusieurs blockers si plusieurs critères échouent", () => {
    const result = computePairEligibility(
      fullInput({
        paidCoursesCount: 0,
        professorPayrollReady: false,
        professorMissingFields: ["IBAN"],
        familyPayrollReady: false,
        familyMissingFields: ["Adresse"],
        hasCourseWithoutPayslipLine: true,
      }),
    );
    expect(result.status).toBe("ineligible");
    expect(result.blockers).toHaveLength(4);
  });

  it("E2+E3 — retourne 2 blockers si prof ET famille incomplètes", () => {
    const result = computePairEligibility(
      fullInput({
        professorPayrollReady: false,
        professorMissingFields: ["BIC"],
        familyPayrollReady: false,
        familyMissingFields: ["Consentement fiscal"],
      }),
    );
    expect(result.blockers).toHaveLength(2);
    expect(result.blockers.some((b) => b.includes("professeur"))).toBe(true);
    expect(result.blockers.some((b) => b.includes("famille"))).toBe(true);
  });

  it("préserve les IDs et le nombre de cours dans le résultat", () => {
    const result = computePairEligibility(
      fullInput({ professorId: "p-abc", familyId: "f-xyz", paidCoursesCount: 7 }),
    );
    expect(result.professorId).toBe("p-abc");
    expect(result.familyId).toBe("f-xyz");
    expect(result.paidCoursesCount).toBe(7);
  });

  it("préserve les noms dans le résultat", () => {
    const result = computePairEligibility(
      fullInput({ professorName: "Jean Test", familyName: "Famille Test" }),
    );
    expect(result.professorName).toBe("Jean Test");
    expect(result.familyName).toBe("Famille Test");
  });

  it("gère les noms null sans erreur", () => {
    const result = computePairEligibility(
      fullInput({ professorName: null, familyName: null }),
    );
    expect(result.professorName).toBeNull();
    expect(result.familyName).toBeNull();
  });
});

// ── computePilotEligibilityReport ─────────────────────────────────────────────

describe("computePilotEligibilityReport", () => {
  function makeResult(
    status: "eligible" | "ineligible",
    professorName: string,
    overrides: Partial<PilotPairResult> = {},
  ): PilotPairResult {
    return {
      professorId: `prof-${professorName}`,
      professorName,
      familyId: `fam-${professorName}`,
      familyName: `Famille ${professorName}`,
      paidCoursesCount: 2,
      status,
      blockers: status === "ineligible" ? ["Dossier incomplet"] : [],
      ...overrides,
    };
  }

  it("retourne 0 éligible et 0 inéligible sur liste vide", () => {
    const report = computePilotEligibilityReport([]);
    expect(report.eligibleCount).toBe(0);
    expect(report.ineligibleCount).toBe(0);
    expect(report.pairs).toHaveLength(0);
  });

  it("comptabilise correctement les éligibles et inéligibles", () => {
    const pairs = [
      makeResult("eligible", "Alice"),
      makeResult("eligible", "Bob"),
      makeResult("ineligible", "Charlie"),
    ];
    const report = computePilotEligibilityReport(pairs);
    expect(report.eligibleCount).toBe(2);
    expect(report.ineligibleCount).toBe(1);
    expect(report.pairs).toHaveLength(3);
  });

  it("trie les éligibles en premier", () => {
    const pairs = [
      makeResult("ineligible", "Zara"),
      makeResult("eligible", "Marie"),
    ];
    const report = computePilotEligibilityReport(pairs);
    expect(report.pairs[0].status).toBe("eligible");
    expect(report.pairs[1].status).toBe("ineligible");
  });

  it("trie alphabétiquement par nom de professeur dans chaque groupe", () => {
    const pairs = [
      makeResult("eligible", "Zoe"),
      makeResult("eligible", "Alice"),
      makeResult("eligible", "Martin"),
    ];
    const report = computePilotEligibilityReport(pairs);
    expect(report.pairs[0].professorName).toBe("Alice");
    expect(report.pairs[1].professorName).toBe("Martin");
    expect(report.pairs[2].professorName).toBe("Zoe");
  });

  it("les inéligibles sont aussi triés alphabétiquement", () => {
    const pairs = [
      makeResult("ineligible", "Zara"),
      makeResult("ineligible", "Ana"),
    ];
    const report = computePilotEligibilityReport(pairs);
    expect(report.pairs[0].professorName).toBe("Ana");
    expect(report.pairs[1].professorName).toBe("Zara");
  });

  it("tri mixte : éligibles (alpha) puis inéligibles (alpha)", () => {
    const pairs = [
      makeResult("ineligible", "Zara"),
      makeResult("eligible", "Zoe"),
      makeResult("eligible", "Alice"),
      makeResult("ineligible", "Ana"),
    ];
    const report = computePilotEligibilityReport(pairs);
    const names = report.pairs.map((p) => p.professorName);
    expect(names).toEqual(["Alice", "Zoe", "Ana", "Zara"]);
  });

  it("gère les noms null dans le tri sans erreur", () => {
    const pairs = [
      makeResult("eligible", "Alice", { professorName: null }),
      makeResult("eligible", "Bob"),
    ];
    expect(() => computePilotEligibilityReport(pairs)).not.toThrow();
  });

  it("ne mute pas le tableau d'entrée", () => {
    const pairs = [
      makeResult("ineligible", "Z"),
      makeResult("eligible", "A"),
    ];
    const original = [...pairs];
    computePilotEligibilityReport(pairs);
    expect(pairs[0].status).toBe(original[0].status);
    expect(pairs[1].status).toBe(original[1].status);
  });

  it("generatedAt est une date ISO valide", () => {
    const report = computePilotEligibilityReport([]);
    expect(new Date(report.generatedAt).toISOString()).toBe(report.generatedAt);
  });
});

// ── Scénarios end-to-end ──────────────────────────────────────────────────────

describe("scénarios complets", () => {
  it("scénario ideal : prof + famille prêts, cours couverts → éligible", () => {
    const input = fullInput();
    const result = computePairEligibility(input);
    expect(result.status).toBe("eligible");
    expect(result.blockers).toHaveLength(0);
  });

  it("scénario dossier prof partiel (manque BIC uniquement) → inéligible", () => {
    const result = computePairEligibility(
      fullInput({
        professorPayrollReady: false,
        professorMissingFields: ["BIC"],
      }),
    );
    expect(result.status).toBe("ineligible");
    expect(result.blockers[0]).toContain("BIC");
  });

  it("scénario famille sans consentements → inéligible", () => {
    const result = computePairEligibility(
      fullInput({
        familyPayrollReady: false,
        familyMissingFields: [
          "Consentement fiscal",
          "Consentement mandat SAP",
          "Mentions légales acceptées",
        ],
      }),
    );
    expect(result.blockers[0]).toContain("Consentement fiscal");
  });

  it("scénario cours non couverts (run non encore lancé) → E4 bloque", () => {
    const result = computePairEligibility(
      fullInput({ hasCourseWithoutPayslipLine: true }),
    );
    expect(result.blockers[0]).toContain("bulletin");
  });

  it("scénario URSSAF-12 faux positif corrigé : addr1 profil vide ≠ eligible", () => {
    // Si addr1 est vide dans professor_profiles, professorPayrollReady = false
    const result = computePairEligibility(
      fullInput({
        professorPayrollReady: false,
        professorMissingFields: ["Adresse (ligne 1)", "Code postal", "Ville"],
      }),
    );
    expect(result.status).toBe("ineligible");
    expect(result.blockers[0]).toContain("Adresse");
  });
});
