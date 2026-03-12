/**
 * Tests for src/lib/billing/payslip-contributions.ts
 *
 * Covered:
 *   - buildEmployeeContributionRows: nombre de lignes, natures, cohérence des totaux
 *   - buildEmployerContributionRows: nombre de lignes, déduction forfaitaire, cohérence
 */

import { describe, it, expect } from "vitest";
import {
  buildEmployeeContributionRows,
  buildEmployerContributionRows,
} from "./payslip-contributions";
import type { EmployeeContribsDetail } from "./payslip-contributions";

const PAYSLIP_ID = "test-payslip-id";
const RATE_SET_VERSION = "FR_2026_01";

// ── Données de référence ─────────────────────────────────────────────────────
// grossTotal = 10h × 15 €/h = 150 €
const GROSS_TOTAL = 150;
const TOTAL_HOURS = 10;

// employee_contribs calculées manuellement pour 10h × 15 €/h :
// retraite_ss_plaf   : 150 × 0.069 = 10.35
// retraite_ss_deplaf : 150 × 0.004 = 0.60
// agirc_arrco_t1     : 150 × 0.0401 = 6.015 → 6.02
// ciid               : 150 × 0.0104 = 1.56
// csg_deductible     : 150 × 0.9825 × 0.068 = 10.032... → 10.03
// csg_non_deductible : 150 × 0.9825 × 0.024 = 3.537  → 3.54
// crds               : 150 × 0.9825 × 0.005 = 0.736... → 0.74
const MOCK_EMPLOYEE_CONTRIBS: EmployeeContribsDetail = {
  retraite_ss_plaf: 10.35,
  retraite_ss_deplaf: 0.6,
  agirc_arrco_t1: 6.02,
  ciid: 1.56,
  csg_deductible: 10.03,
  csg_non_deductible: 3.54,
  crds: 0.74,
  total: 32.84,
};

// ── buildEmployeeContributionRows ─────────────────────────────────────────────

describe("buildEmployeeContributionRows", () => {
  const rows = buildEmployeeContributionRows({
    payslipId: PAYSLIP_ID,
    grossTotal: GROSS_TOTAL,
    contribs: MOCK_EMPLOYEE_CONTRIBS,
    rateSetVersion: RATE_SET_VERSION,
  });

  it("produces exactly 7 salariale rows", () => {
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.type === "salariale")).toBe(true);
  });

  it("every row has payslip_id and rate_set_version set correctly", () => {
    expect(rows.every((r) => r.payslip_id === PAYSLIP_ID)).toBe(true);
    expect(rows.every((r) => r.rate_set_version === RATE_SET_VERSION)).toBe(true);
  });

  it("contains all expected nature keys", () => {
    const natures = rows.map((r) => r.nature);
    expect(natures).toContain("retraite_ss_plaf");
    expect(natures).toContain("retraite_ss_deplaf");
    expect(natures).toContain("agirc_arrco_t1");
    expect(natures).toContain("ciid");
    expect(natures).toContain("csg_deductible");
    expect(natures).toContain("csg_non_deductible");
    expect(natures).toContain("crds");
  });

  it("amounts match the provided contribs detail", () => {
    const byNature = Object.fromEntries(rows.map((r) => [r.nature, r.amount]));
    expect(byNature["retraite_ss_plaf"]).toBe(MOCK_EMPLOYEE_CONTRIBS.retraite_ss_plaf);
    expect(byNature["retraite_ss_deplaf"]).toBe(MOCK_EMPLOYEE_CONTRIBS.retraite_ss_deplaf);
    expect(byNature["agirc_arrco_t1"]).toBe(MOCK_EMPLOYEE_CONTRIBS.agirc_arrco_t1);
    expect(byNature["ciid"]).toBe(MOCK_EMPLOYEE_CONTRIBS.ciid);
    expect(byNature["csg_deductible"]).toBe(MOCK_EMPLOYEE_CONTRIBS.csg_deductible);
    expect(byNature["csg_non_deductible"]).toBe(MOCK_EMPLOYEE_CONTRIBS.csg_non_deductible);
    expect(byNature["crds"]).toBe(MOCK_EMPLOYEE_CONTRIBS.crds);
  });

  it("CSG/CRDS rows have base = gross × csgBaseRatio (0.9825)", () => {
    const expectedBase = Number((GROSS_TOTAL * 0.9825).toFixed(2)); // 147.38
    const csgRow = rows.find((r) => r.nature === "csg_deductible");
    expect(csgRow?.base).toBeCloseTo(expectedBase, 2);

    const crdsRow = rows.find((r) => r.nature === "crds");
    expect(crdsRow?.base).toBeCloseTo(expectedBase, 2);
  });

  it("non-CSG rows have base = grossTotal", () => {
    const retraiteRow = rows.find((r) => r.nature === "retraite_ss_plaf");
    expect(retraiteRow?.base).toBe(GROSS_TOTAL);
  });

  it("rates are populated and positive", () => {
    expect(rows.every((r) => r.rate != null && r.rate > 0)).toBe(true);
  });

  it("all labels are non-empty strings", () => {
    expect(rows.every((r) => typeof r.label === "string" && r.label.length > 0)).toBe(true);
  });
});

// ── buildEmployerContributionRows ─────────────────────────────────────────────

describe("buildEmployerContributionRows", () => {
  const rows = buildEmployerContributionRows({
    payslipId: PAYSLIP_ID,
    grossTotal: GROSS_TOTAL,
    totalHours: TOTAL_HOURS,
    rateSetVersion: RATE_SET_VERSION,
  });

  it("produces exactly 12 patronale rows (11 rates + 1 deduction)", () => {
    expect(rows).toHaveLength(12);
    expect(rows.every((r) => r.type === "patronale")).toBe(true);
  });

  it("includes a deduction_forfaitaire_pat row with negative amount", () => {
    const deductRow = rows.find((r) => r.nature === "deduction_forfaitaire_pat");
    expect(deductRow).toBeDefined();
    expect(deductRow!.amount).toBeLessThan(0);
  });

  it("deduction amount equals -2.0 × totalHours", () => {
    const deductRow = rows.find((r) => r.nature === "deduction_forfaitaire_pat");
    expect(deductRow!.amount).toBeCloseTo(-2.0 * TOTAL_HOURS, 2); // -20 €
  });

  it("deduction row has null base and null rate", () => {
    const deductRow = rows.find((r) => r.nature === "deduction_forfaitaire_pat");
    expect(deductRow!.base).toBeNull();
    expect(deductRow!.rate).toBeNull();
  });

  it("all non-deduction rows have positive amounts", () => {
    const nonDeduct = rows.filter((r) => r.nature !== "deduction_forfaitaire_pat");
    expect(nonDeduct.every((r) => r.amount > 0)).toBe(true);
  });

  it("contains all expected employer nature keys", () => {
    const natures = rows.map((r) => r.nature);
    expect(natures).toContain("maladie_maternite");
    expect(natures).toContain("csa");
    expect(natures).toContain("compl_incap_inval_deces");
    expect(natures).toContain("at_mp");
    expect(natures).toContain("retraite_ss_plaf_pat");
    expect(natures).toContain("retraite_ss_deplaf_pat");
    expect(natures).toContain("agirc_arrco_t1_pat");
    expect(natures).toContain("allocations_familiales");
    expect(natures).toContain("chomage");
    expect(natures).toContain("autres_pat");
    expect(natures).toContain("sante_travail");
    expect(natures).toContain("deduction_forfaitaire_pat");
  });

  it("maladie_maternite amount is correct (13% of gross)", () => {
    const row = rows.find((r) => r.nature === "maladie_maternite");
    expect(row!.amount).toBeCloseTo(GROSS_TOTAL * 0.13, 2); // 19.50
  });

  it("retraite_ss_plaf_pat amount is correct (8.55% of gross)", () => {
    const row = rows.find((r) => r.nature === "retraite_ss_plaf_pat");
    expect(row!.amount).toBeCloseTo(GROSS_TOTAL * 0.0855, 2); // 12.83
  });

  it("net total patronal (sum incl. deduction) is less than gross sum without deduction", () => {
    const gross = rows
      .filter((r) => r.nature !== "deduction_forfaitaire_pat")
      .reduce((s, r) => s + r.amount, 0);
    const net = rows.reduce((s, r) => s + r.amount, 0);
    expect(net).toBeLessThan(gross);
  });

  it("every row has correct payslip_id and rate_set_version", () => {
    expect(rows.every((r) => r.payslip_id === PAYSLIP_ID)).toBe(true);
    expect(rows.every((r) => r.rate_set_version === RATE_SET_VERSION)).toBe(true);
  });

  it("all labels are non-empty strings", () => {
    expect(rows.every((r) => typeof r.label === "string" && r.label.length > 0)).toBe(true);
  });
});
