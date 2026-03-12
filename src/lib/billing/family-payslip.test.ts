import { describe, expect, it } from "vitest";
import { groupLinesByFamily, type FamilyPayslipLine } from "@/lib/billing/family-payslip";

// ── groupLinesByFamily ────────────────────────────────────────────────────────

describe("groupLinesByFamily", () => {
  const FAM_A = "aaaaaaaa-0000-0000-0000-000000000001";
  const FAM_B = "bbbbbbbb-0000-0000-0000-000000000002";

  const line = (
    course_id: string,
    family_id: string | null,
    hours = 1,
    net_amount = 10,
    indemn_km = 2,
  ): FamilyPayslipLine => ({ course_id, family_id, hours, net_amount, indemn_km });

  it("groups lines by family_id correctly", () => {
    const lines = [
      line("c1", FAM_A, 2, 20, 3),
      line("c2", FAM_B, 1, 10, 2),
      line("c3", FAM_A, 1, 10, 1.5),
    ];

    const groups = groupLinesByFamily(lines);

    expect(groups.size).toBe(2);

    const groupA = groups.get(FAM_A);
    expect(groupA).toBeDefined();
    expect(groupA!.lines).toHaveLength(2);
    expect(groupA!.net_total).toBeCloseTo(30, 2);
    expect(groupA!.reimbursements_total).toBeCloseTo(4.5, 2);

    const groupB = groups.get(FAM_B);
    expect(groupB).toBeDefined();
    expect(groupB!.lines).toHaveLength(1);
    expect(groupB!.net_total).toBeCloseTo(10, 2);
    expect(groupB!.reimbursements_total).toBeCloseTo(2, 2);
  });

  it("handles a single family", () => {
    const lines = [
      line("c1", FAM_A, 2, 25, 4),
      line("c2", FAM_A, 1, 15, 2),
    ];

    const groups = groupLinesByFamily(lines);

    expect(groups.size).toBe(1);
    const groupA = groups.get(FAM_A);
    expect(groupA!.net_total).toBeCloseTo(40, 2);
    expect(groupA!.reimbursements_total).toBeCloseTo(6, 2);
    expect(groupA!.lines).toHaveLength(2);
  });

  it("excludes lines with null family_id", () => {
    const lines = [
      line("c1", FAM_A, 1, 10, 2),
      line("c2", null, 1, 10, 2),  // sans famille — doit être exclu
    ];

    const groups = groupLinesByFamily(lines);

    expect(groups.size).toBe(1);
    expect(groups.get(FAM_A)!.lines).toHaveLength(1);
    // c2 absent
    expect(groups.get(FAM_A)!.lines[0].course_id).toBe("c1");
  });

  it("returns an empty map when all lines have null family_id", () => {
    const lines = [
      line("c1", null),
      line("c2", null),
    ];

    expect(groupLinesByFamily(lines).size).toBe(0);
  });

  it("returns an empty map for empty input", () => {
    expect(groupLinesByFamily([]).size).toBe(0);
  });

  it("computes totals with 2-decimal precision", () => {
    // 3 × 10.333... = 30.999... — must not accumulate float drift beyond 2 decimals
    const threeLines = [
      line("c1", FAM_A, 1, 10.333, 0),
      line("c2", FAM_A, 1, 10.333, 0),
      line("c3", FAM_A, 1, 10.333, 0),
    ];

    const groups = groupLinesByFamily(threeLines);
    const netTotal = groups.get(FAM_A)!.net_total;

    // Should be rounded at each step — check result is a well-formed 2-decimal number
    expect(Number.isFinite(netTotal)).toBe(true);
    expect(String(netTotal).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });

  it("preserves family_id on each FamilyGroup", () => {
    const lines = [line("c1", FAM_B, 2, 20, 5)];
    const groups = groupLinesByFamily(lines);
    expect(groups.get(FAM_B)!.family_id).toBe(FAM_B);
  });

  it("handles multi-family with floating-point IK totals", () => {
    const lines = [
      line("c1", FAM_A, 2, 30, 13.3),
      line("c2", FAM_B, 1, 15, 6.65),
      line("c3", FAM_A, 1, 15, 6.65),
    ];

    const groups = groupLinesByFamily(lines);

    expect(groups.get(FAM_A)!.reimbursements_total).toBeCloseTo(19.95, 2);
    expect(groups.get(FAM_B)!.reimbursements_total).toBeCloseTo(6.65, 2);
    // Neither family has the other's lines
    expect(groups.get(FAM_A)!.lines.every((l) => l.course_id !== "c2")).toBe(true);
    expect(groups.get(FAM_B)!.lines.every((l) => l.course_id !== "c1")).toBe(true);
  });
});
