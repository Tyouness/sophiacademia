import { describe, expect, it } from "vitest";
import { validateNir, maskNir } from "@/lib/payroll/nir";
import { validateIban, maskIban, normaliseIban } from "@/lib/payroll/iban";
import { computeCourseBreakdown } from "@/lib/payroll/computeCourseBreakdown";
import { computeMonthlyPayslipData } from "@/lib/payroll/computeMonthlyPayslip";

// ── NIR ──────────────────────────────────────────────────────────────────────

describe("validateNir", () => {
  // NIR constructed manually: sex=1, year=78, month=12, dept=75, commune=110, order=084
  // Base 13 digits: 1781275110084
  // Key: 97 - (1781275110084 mod 97) = 97 - 68 = 29
  // Full NIR: 178127511008429
  const VALID_NIR = "178127511008429";

  it("accepts a valid NIR", () => {
    expect(validateNir(VALID_NIR).valid).toBe(true);
  });

  it("rejects NIR with wrong length", () => {
    expect(validateNir("12345").valid).toBe(false);
    expect(validateNir("12345").error).toBe("nir_format_invalid");
  });

  it("rejects NIR with letters", () => {
    expect(validateNir("17812751100842A").valid).toBe(false);
    expect(validateNir("17812751100842A").error).toBe("nir_format_invalid");
  });

  it("rejects NIR starting with digit other than 1 or 2", () => {
    // Change sex digit to 3 (invalid)
    expect(validateNir("378127511008428").valid).toBe(false);
    expect(validateNir("378127511008428").error).toBe("nir_sex_invalid");
  });

  it("rejects NIR with invalid key", () => {
    // Flip last digit
    const badKey = VALID_NIR.slice(0, 14) + "0";
    expect(validateNir(badKey).valid).toBe(false);
    expect(validateNir(badKey).error).toBe("nir_key_invalid");
  });

  it("trims whitespace before validating", () => {
    expect(validateNir(`  ${VALID_NIR}  `).valid).toBe(true);
  });
});

describe("maskNir", () => {
  it("masks the order and key parts", () => {
    const masked = maskNir("178127511008429");
    // Should keep sex + year + month + dept, mask commune + order + key
    expect(masked).toContain("1 78 12 75");
    expect(masked).toContain("**");
    expect(masked).not.toContain("110");
    expect(masked).not.toContain("084");
    expect(masked).not.toContain("29");
  });

  it("returns a placeholder for invalid-length NIR", () => {
    expect(maskNir("123")).toBe("*** *** *** *** **");
  });
});

// ── IBAN ─────────────────────────────────────────────────────────────────────

describe("validateIban", () => {
  // Known valid IBAN from Wikipedia: GB29 NWBK 6016 1331 9268 19
  const VALID_GB_IBAN = "GB29NWBK60161331926819";

  it("accepts a known valid IBAN (GB)", () => {
    expect(validateIban(VALID_GB_IBAN).valid).toBe(true);
  });

  it("accepts IBANs with spaces (normalises first)", () => {
    expect(validateIban("GB29 NWBK 6016 1331 9268 19").valid).toBe(true);
  });

  it("rejects IBAN with wrong checksum", () => {
    // Tamper checksum digit
    const bad = "GB30NWBK60161331926819";
    expect(validateIban(bad).valid).toBe(false);
    expect(validateIban(bad).error).toBe("iban_checksum_invalid");
  });

  it("rejects obviously malformed IBAN", () => {
    expect(validateIban("NOT-AN-IBAN").valid).toBe(false);
    expect(validateIban("NOT-AN-IBAN").error).toBe("iban_format_invalid");
  });

  it("rejects empty string", () => {
    expect(validateIban("").valid).toBe(false);
  });
});

describe("normaliseIban", () => {
  it("strips spaces and uppercases", () => {
    expect(normaliseIban("gb29 nwbk 6016")).toBe("GB29NWBK6016");
  });
});

describe("maskIban", () => {
  it("shows first 4 and last 3 characters", () => {
    const masked = maskIban("GB29NWBK60161331926819");
    expect(masked).toMatch(/^GB29/);
    // Last 3 chars of IBAN are 819 — after grouping by 4 they may be split across groups
    expect(masked.replace(/\s+/g, "")).toMatch(/819$/);
    expect(masked).not.toContain("NWBK");
    expect(masked).toContain("*");
  });
});

// ── gross hourly override ─────────────────────────────────────────────────────

describe("grossHourlyOverride in payroll", () => {
  it("uses provided baseGrossHourly instead of system default", () => {
    // At 18 €/h (above SMIC), gross should reflect 18
    const breakdown = computeCourseBreakdown({
      hours: 2,
      distanceKmOneWay: 5,
      distanceKmRoundTrip: 10,
      ikAmount: 6.65,
      baseGrossHourly: 18,
    });
    expect(breakdown.gross_hourly).toBeCloseTo(18, 2);
    expect(breakdown.smic_guard_applied).toBe(false);
    // Gross total = 18 * 2 = 36
    expect(breakdown.gross_total).toBeCloseTo(36, 2);
  });

  it("propagates baseGrossHourly through computeMonthlyPayslipData", () => {
    const courses = [
      {
        id: "c1",
        professor_id: "p1",
        family_id: "f1",
        hours: 2,
        course_date: null,
        paid_at: "2026-02-10T10:00:00Z",
        distance_km_one_way: 5,
        distance_km_round_trip: 10,
        ik_amount: 6.65,
        rate_set_version: "FR_2026_01",
        pricing_policy_version: "pricing_v1",
        rounding_policy_version: "rounding_v1",
      },
    ];

    const withDefault = computeMonthlyPayslipData({ period: "2026-02", courses });
    const withOverride = computeMonthlyPayslipData({ period: "2026-02", courses, baseGrossHourly: 20 });

    // Override should yield higher gross
    expect(withOverride.grossTotal).toBeGreaterThan(withDefault.grossTotal);
    // Hashes must differ (different rates → different computation)
    expect(withOverride.calculationHash).not.toBe(withDefault.calculationHash);
  });

  it("falls back to system default when baseGrossHourly is null", () => {
    const courses = [
      {
        id: "c2",
        professor_id: "p2",
        family_id: "f2",
        hours: 1,
        course_date: null,
        paid_at: "2026-02-15T10:00:00Z",
        distance_km_one_way: 5,
        distance_km_round_trip: 10,
        ik_amount: 6.65,
        rate_set_version: "FR_2026_01",
        pricing_policy_version: "pricing_v1",
        rounding_policy_version: "rounding_v1",
      },
    ];

    const withNull = computeMonthlyPayslipData({ period: "2026-02", courses, baseGrossHourly: null });
    const withUndefined = computeMonthlyPayslipData({ period: "2026-02", courses });

    // Both should produce the same result (system default 15 €/h)
    expect(withNull.grossTotal).toBe(withUndefined.grossTotal);
    expect(withNull.calculationHash).toBe(withUndefined.calculationHash);
  });
});
