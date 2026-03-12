import { describe, expect, it, vi, beforeEach } from "vitest";
import { computeMonthlyPayslipData } from "@/lib/payroll/computeMonthlyPayslip";
import type { PaidCourseRow } from "@/lib/payroll/computeMonthlyPayslip";
import { aggregateRunResults } from "@/lib/payroll/runMonthly";
import type { ProfessorRunResult } from "@/lib/payroll/computeMonthlyPayslip";

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeCourse(overrides: Partial<PaidCourseRow> = {}): PaidCourseRow {
  return {
    id: crypto.randomUUID(),
    professor_id: "prof-1",
    family_id: "fam-1",
    hours: 1.5,
    course_date: "2026-02-10",
    paid_at: "2026-02-10T10:00:00Z",
    distance_km_one_way: 10,
    distance_km_round_trip: 20,
    ik_amount: 0.20 * 20,
    rate_set_version: "FR_2026_01",
    pricing_policy_version: "pricing_v1",
    rounding_policy_version: "rounding_v1",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeMonthlyPayslipData — pure function tests (no DB)
// ─────────────────────────────────────────────────────────────────────────────

describe("computeMonthlyPayslipData", () => {
  it("computes a valid result for a single course", () => {
    const course = makeCourse({ hours: 2 });
    const result = computeMonthlyPayslipData({
      period: "2026-02",
      courses: [course],
    });

    expect(result.period).toBe("2026-02");
    expect(result.courseIds).toEqual([course.id]);
    expect(result.totalHours).toBe(2);
    expect(result.grossTotal).toBeGreaterThan(0);
    expect(result.netTotal).toBeGreaterThan(0);
    expect(result.netTotal).toBeLessThan(result.grossTotal);
    expect(result.calculationHash).toHaveLength(64); // SHA-256 hex
  });

  it("accumulates hours and amounts across multiple courses", () => {
    const c1 = makeCourse({ hours: 1 });
    const c2 = makeCourse({ hours: 2 });
    const result = computeMonthlyPayslipData({
      period: "2026-02",
      courses: [c1, c2],
    });

    expect(result.totalHours).toBe(3);
    expect(result.courseIds).toHaveLength(2);
    // Two courses separately vs together should give same total
    const r1 = computeMonthlyPayslipData({ period: "2026-02", courses: [c1] });
    const r2 = computeMonthlyPayslipData({ period: "2026-02", courses: [c2] });
    expect(result.grossTotal).toBeCloseTo(r1.grossTotal + r2.grossTotal, 2);
  });

  it("uses baseGrossHourly override when provided", () => {
    const course = makeCourse({ hours: 1 });
    const defaultResult = computeMonthlyPayslipData({
      period: "2026-02",
      courses: [course],
    });
    const overrideResult = computeMonthlyPayslipData({
      period: "2026-02",
      courses: [course],
      baseGrossHourly: 20, // Higher rate
    });

    expect(overrideResult.grossTotal).toBeGreaterThan(defaultResult.grossTotal);
  });

  it("throws on missing distance data", () => {
    const course = makeCourse({ distance_km_one_way: null, ik_amount: null });
    expect(() =>
      computeMonthlyPayslipData({ period: "2026-02", courses: [course] }),
    ).toThrow("missing_distance_or_ik");
  });

  it("returns consistent hash for same input", () => {
    const course = makeCourse({ id: "fixed-id-1" });
    const r1 = computeMonthlyPayslipData({ period: "2026-02", courses: [course] });
    const r2 = computeMonthlyPayslipData({ period: "2026-02", courses: [course] });
    expect(r1.calculationHash).toBe(r2.calculationHash);
  });

  it("returns different hash for different input", () => {
    const c1 = makeCourse({ id: "fixed-id-a", hours: 1 });
    const c2 = makeCourse({ id: "fixed-id-b", hours: 2 });
    const r1 = computeMonthlyPayslipData({ period: "2026-02", courses: [c1] });
    const r2 = computeMonthlyPayslipData({ period: "2026-02", courses: [c2] });
    expect(r1.calculationHash).not.toBe(r2.calculationHash);
  });

  it("employeeContribsDetail.total equals sum of individual components", () => {
    const course = makeCourse({ hours: 2 });
    const result = computeMonthlyPayslipData({
      period: "2026-02",
      courses: [course],
    });
    const d = result.employeeContribsDetail;
    const sumComponents = Number(
      (
        d.retraite_ss_plaf +
        d.retraite_ss_deplaf +
        d.agirc_arrco_t1 +
        d.ciid +
        d.csg_deductible +
        d.csg_non_deductible +
        d.crds
      ).toFixed(2),
    );
    expect(d.total).toBeCloseTo(sumComponents, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// aggregateRunResults — tested via the exported pure function
// ─────────────────────────────────────────────────────────────────────────────

describe("aggregateRunResults", () => {
  function makeProf(overrides: Partial<ProfessorRunResult> = {}): ProfessorRunResult {
    return {
      professorId: "p-" + Math.random().toString(36).slice(2, 8),
      payslipId: null,
      familyDocsCreated: 0,
      familyDocsFailed: 0,
      familyDocErrors: [],
      ...overrides,
    };
  }

  it("returns success when all professors processed without errors", () => {
    const results = [
      makeProf({ payslipId: "slip-1" }),
      makeProf({ payslipId: "slip-2" }),
    ];
    const agg = aggregateRunResults(results);
    expect(agg.status).toBe("success");
    expect(agg.payslipsCreated).toBe(2);
    expect(agg.errorsCount).toBe(0);
    expect(agg.errorDetails).toHaveLength(0);
  });

  it("returns partial when some professors errored and some succeeded", () => {
    const results = [
      makeProf({ payslipId: "slip-1" }),
      makeProf({ payslipId: null, error: "missing_distance_or_ik:course-x" }),
    ];
    const agg = aggregateRunResults(results);
    expect(agg.status).toBe("partial");
    expect(agg.payslipsCreated).toBe(1);
    expect(agg.errorsCount).toBe(1);
  });

  it("returns failed when all professors errored", () => {
    const results = [
      makeProf({ payslipId: null, error: "some_error" }),
      makeProf({ payslipId: null, error: "another_error" }),
    ];
    const agg = aggregateRunResults(results);
    expect(agg.status).toBe("failed");
    expect(agg.payslipsCreated).toBe(0);
  });

  it("returns success when no paid courses exist (empty run)", () => {
    const agg = aggregateRunResults([]);
    expect(agg.status).toBe("success");
    expect(agg.payslipsCreated).toBe(0);
    expect(agg.errorsCount).toBe(0);
  });

  it("does not count null payslipId without error as a failure", () => {
    // payslipId=null + no error = no paid courses for that prof in period
    const results = [
      makeProf({ payslipId: null }), // No paid courses — not an error
      makeProf({ payslipId: "slip-2" }),
    ];
    const agg = aggregateRunResults(results);
    expect(agg.status).toBe("success");
    expect(agg.payslipsCreated).toBe(1);
  });

  it("increments family_docs_created and family_docs_failed correctly", () => {
    const results = [
      makeProf({ payslipId: "slip-1", familyDocsCreated: 2, familyDocsFailed: 0 }),
      makeProf({ payslipId: "slip-2", familyDocsCreated: 1, familyDocsFailed: 1,
        familyDocErrors: [{ familyId: "fam-abc", message: "upload: network timeout" }] }),
    ];
    const agg = aggregateRunResults(results);
    expect(agg.familyDocsCreated).toBe(3);
    expect(agg.familyDocsFailed).toBe(1);
    // Family doc error should appear in error_details
    expect(agg.errorDetails.some((e) => e.message === "upload: network timeout")).toBe(true);
  });

  it("reflects family doc failure in status (partial)", () => {
    const results = [
      makeProf({
        payslipId: "slip-1",
        familyDocsCreated: 0,
        familyDocsFailed: 1,
        familyDocErrors: [{ familyId: "fam-xyz", message: "upload: storage quota exceeded" }],
      }),
    ];
    const agg = aggregateRunResults(results);
    // No fatal prof error, but a family doc failed → partial
    expect(agg.status).toBe("partial");
    expect(agg.familyDocsFailed).toBe(1);
    expect(agg.payslipsCreated).toBe(1);
  });

  it("reflects contrib error as non-blocking in error_details with partial status", () => {
    const results = [
      makeProf({
        payslipId: "slip-1",
        contribError: "unique constraint violation on payslip_contribution_lines",
        familyDocsCreated: 1,
      }),
    ];
    const agg = aggregateRunResults(results);
    // Bulletin was created (payslipId set), but contrib persistence failed → partial
    expect(agg.status).toBe("partial");
    expect(agg.payslipsCreated).toBe(1);
    expect(agg.contribErrors).toBe(1);
    expect(agg.errorDetails.some((e) => e.message.includes("contrib:"))).toBe(true);
  });

  it("accumulates all error types in error_details", () => {
    const profA = makeProf({ professorId: "p-a", payslipId: "slip-a",
      contribError: "db_error" });
    const profB = makeProf({ professorId: "p-b", payslipId: "slip-b",
      familyDocsFailed: 2,
      familyDocErrors: [
        { familyId: "fam-1", message: "upload: timeout" },
        { familyId: "fam-2", message: "upsert: foreign key" },
      ] });
    const profC = makeProf({ professorId: "p-c", payslipId: null,
      error: "missing_distance_or_ik:course-z" });

    const agg = aggregateRunResults([profA, profB, profC]);
    expect(agg.status).toBe("partial");
    expect(agg.payslipsCreated).toBe(2);
    expect(agg.familyDocsFailed).toBe(2);
    expect(agg.contribErrors).toBe(1);
    // 1 fatal + 1 contrib + 2 family doc
    expect(agg.errorDetails).toHaveLength(4);
  });

  it("caps errorDetails at 50 entries even when there are many errors", () => {
    // 60 fatal errors
    const results = Array.from({ length: 60 }, (_, i) =>
      makeProf({ professorId: `p-${i}`, payslipId: null, error: `some_error_${i}` }),
    );
    const agg = aggregateRunResults(results);
    expect(agg.errorsCount).toBe(60); // full count preserved
    expect(agg.errorDetails.length).toBeLessThanOrEqual(50); // details capped
  });
});
