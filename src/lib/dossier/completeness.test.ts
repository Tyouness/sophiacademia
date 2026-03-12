import { describe, expect, it } from "vitest";
import {
  familyCompleteness,
  professorCompleteness,
  employerReadiness,
  isValidIsoDate,
  professorPayrollReadiness,
} from "./completeness";

describe("professorCompleteness", () => {
  it("returns payroll_ready when all fields are present", () => {
    const result = professorCompleteness({
      full_name: "Marie Dupont",
      birth_date: "1990-05-15",
      addr1: "10 rue de la Paix",
      hasNir: true,
      hasIban: true,
      bic: "BNPAFRPP",
    });
    expect(result.status).toBe("payroll_ready");
    expect(result.missingFields).toHaveLength(0);
    expect(result.score).toBe(100);
  });

  it("returns incomplete when most fields are missing", () => {
    const result = professorCompleteness({});
    expect(result.status).toBe("incomplete");
    expect(result.missingFields).toHaveLength(6);
    expect(result.score).toBe(0);
  });

  it("returns partial when 1 field is missing", () => {
    const result = professorCompleteness({
      full_name: "Marie Dupont",
      birth_date: "1990-05-15",
      addr1: "10 rue de la Paix",
      hasNir: true,
      hasIban: true,
      bic: null,
    });
    expect(result.status).toBe("partial");
    expect(result.missingFields).toEqual(["BIC"]);
    expect(result.score).toBeCloseTo(83, 0);
  });

  it("returns partial when 2 fields are missing", () => {
    const result = professorCompleteness({
      full_name: "Jean Martin",
      birth_date: "1985-02-10",
      addr1: "5 avenue Montaigne",
      hasNir: false,
      hasIban: false,
      bic: null,
    });
    expect(result.status).toBe("incomplete");
    expect(result.missingFields).toContain("NIR (numéro sécurité sociale)");
    expect(result.missingFields).toContain("IBAN");
    expect(result.missingFields).toContain("BIC");
  });

  it("treats empty string full_name as missing", () => {
    const result = professorCompleteness({
      full_name: "  ",
      birth_date: "1990-01-01",
      addr1: "1 rue Test",
      hasNir: true,
      hasIban: true,
      bic: "CAGEFR21",
    });
    expect(result.missingFields).toContain("Nom complet");
  });

  it("score is 50 when half fields are filled", () => {
    const result = professorCompleteness({
      full_name: "Test User",
      birth_date: "1990-01-01",
      addr1: "1 rue Test",
    });
    expect(result.score).toBe(50);
  });
});

describe("familyCompleteness", () => {
  it("returns payroll_ready when all fields are present", () => {
    const result = familyCompleteness({
      rep_first: "Sophie",
      rep_last: "Bernard",
      rep_phone: "0612345678",
      addr1: "12 rue des Fleurs",
      fiscal_consent: true,
      mandate_consent: true,
      legal_notice_accepted: true,
    });
    expect(result.status).toBe("payroll_ready");
    expect(result.missingFields).toHaveLength(0);
    expect(result.score).toBe(100);
  });

  it("returns incomplete when all fields are missing", () => {
    const result = familyCompleteness({});
    expect(result.status).toBe("incomplete");
    expect(result.missingFields).toHaveLength(7);
    expect(result.score).toBe(0);
  });

  it("returns partial when 1 consent is missing", () => {
    const result = familyCompleteness({
      rep_first: "Sophie",
      rep_last: "Bernard",
      rep_phone: "0612345678",
      addr1: "12 rue des Fleurs",
      fiscal_consent: true,
      mandate_consent: true,
      legal_notice_accepted: false,
    });
    expect(result.status).toBe("partial");
    expect(result.missingFields).toEqual(["Mentions légales acceptées"]);
  });

  it("treats false consent as missing", () => {
    const result = familyCompleteness({
      rep_first: "Marc",
      rep_last: "Leclerc",
      rep_phone: "0699887766",
      addr1: "3 place Victor Hugo",
      fiscal_consent: false,
      mandate_consent: true,
      legal_notice_accepted: true,
    });
    expect(result.missingFields).toContain("Consentement fiscal");
  });

  it("treats null consent as missing", () => {
    const result = familyCompleteness({
      rep_first: "Marc",
      rep_last: "Leclerc",
      rep_phone: "0699887766",
      addr1: "3 place Victor Hugo",
      fiscal_consent: null,
      mandate_consent: null,
      legal_notice_accepted: null,
    });
    expect(result.missingFields).toHaveLength(3);
    expect(result.status).toBe("incomplete");
  });

  it("score is proportional", () => {
    const result = familyCompleteness({
      rep_first: "A",
      rep_last: "B",
      rep_phone: "0600000000",
      addr1: "1 rue",
    });
    // 4 of 7 filled
    expect(result.score).toBeCloseTo(57, 0);
  });
});

describe("employerReadiness", () => {
  const FULL: Parameters<typeof employerReadiness>[0] = {
    rep_first: "Sophie",
    rep_last: "Bernard",
    rep_phone: "0612345678",
    addr1: "12 rue des Fleurs",
    birth_date: "1980-05-20",
    fiscal_consent: true,
    mandate_consent: true,
    legal_notice_accepted: true,
    hasFiscalNumber: true,
  };

  it("returns urssaf_ready when all 9 fields are present", () => {
    const result = employerReadiness(FULL);
    expect(result.status).toBe("urssaf_ready");
    expect(result.missingFields).toHaveLength(0);
    expect(result.score).toBe(100);
  });

  it("returns incomplete when all fields are missing", () => {
    const result = employerReadiness({});
    expect(result.status).toBe("incomplete");
    expect(result.missingFields).toHaveLength(9);
    expect(result.score).toBe(0);
  });

  it("returns partial when only birth_date is missing", () => {
    const result = employerReadiness({ ...FULL, birth_date: null });
    expect(result.status).toBe("partial");
    expect(result.missingFields).toEqual(["Date de naissance (représentant)"]);
  });

  it("returns partial when only hasFiscalNumber is missing", () => {
    const result = employerReadiness({ ...FULL, hasFiscalNumber: false });
    expect(result.status).toBe("partial");
    expect(result.missingFields).toEqual(["Numéro fiscal (SPI)"]);
  });

  it("returns partial when birth_date and hasFiscalNumber are both missing (exactly 2 missing)", () => {
    const result = employerReadiness({
      ...FULL,
      birth_date: null,
      hasFiscalNumber: false,
    });
    expect(result.status).toBe("partial");
    expect(result.missingFields).toHaveLength(2);
  });

  it("returns incomplete when 3 fields are missing", () => {
    const result = employerReadiness({
      ...FULL,
      birth_date: null,
      hasFiscalNumber: false,
      fiscal_consent: false,
    });
    expect(result.status).toBe("incomplete");
    expect(result.missingFields).toHaveLength(3);
  });

  it("score is proportional — 7 of 9 filled → ~78%", () => {
    const result = employerReadiness({
      ...FULL,
      birth_date: null,
      hasFiscalNumber: false,
    });
    // 7/9 ≈ 77.8
    expect(result.score).toBeCloseTo(78, 0);
  });

  it("treats false hasFiscalNumber as field missing", () => {
    const result = employerReadiness({ ...FULL, hasFiscalNumber: false });
    expect(result.missingFields).toContain("Numéro fiscal (SPI)");
  });

  it("treats undefined hasFiscalNumber as missing", () => {
    const { hasFiscalNumber: _unused, ...withoutFiscal } = FULL;
    const result = employerReadiness(withoutFiscal);
    expect(result.missingFields).toContain("Numéro fiscal (SPI)");
  });

  it("familyCompleteness payroll_ready does NOT imply urssaf_ready", () => {
    // A family can be payroll_ready (7/7) but not urssaf_ready (missing birth_date + fiscal)
    const payrollReady = familyCompleteness({
      rep_first: "Sophie",
      rep_last: "Bernard",
      rep_phone: "0612345678",
      addr1: "12 rue des Fleurs",
      fiscal_consent: true,
      mandate_consent: true,
      legal_notice_accepted: true,
    });
    expect(payrollReady.status).toBe("payroll_ready");

    const urssafCheck = employerReadiness({
      rep_first: "Sophie",
      rep_last: "Bernard",
      rep_phone: "0612345678",
      addr1: "12 rue des Fleurs",
      fiscal_consent: true,
      mandate_consent: true,
      legal_notice_accepted: true,
      // birth_date and hasFiscalNumber NOT supplied
    });
    expect(urssafCheck.status).not.toBe("urssaf_ready");
    expect(urssafCheck.missingFields).toContain("Date de naissance (représentant)");
    expect(urssafCheck.missingFields).toContain("Numéro fiscal (SPI)");
  });

  it("addr1 null → not urssaf_ready (family_profiles.addr1 not synced yet)", () => {
    // Scenario: legacy family where profiles.addr1 exists but family_profiles.addr1 is null.
    // employerReadiness() must be called WITHOUT the profiles.addr1 fallback so that
    // the gap is correctly flagged — otherwise URSSAF would receive an empty address
    // even though the indicator shows "ready".
    const result = employerReadiness({ ...FULL, addr1: null });
    expect(result.status).not.toBe("urssaf_ready");
    expect(result.missingFields).toContain("Adresse");
  });

  it("addr1 present (from family_profiles) → contributes to urssaf_ready", () => {
    const result = employerReadiness({ ...FULL, addr1: "12 rue des Fleurs" });
    expect(result.missingFields).not.toContain("Adresse (rue)");
  });

  // URSSAF-12 — birth_date must be a real ISO date, not just a truthy string
  it("rejects non-ISO birth_date string like 'abc'", () => {
    const result = employerReadiness({ ...FULL, birth_date: "abc" });
    expect(result.missingFields).toContain("Date de naissance (représentant)");
    expect(result.status).not.toBe("urssaf_ready");
  });

  it("rejects birth_date with month 99 (invalid)", () => {
    const result = employerReadiness({ ...FULL, birth_date: "1990-99-01" });
    expect(result.missingFields).toContain("Date de naissance (représentant)");
  });
});

// ── isValidIsoDate (URSSAF-12) ────────────────────────────────────────────────

describe("isValidIsoDate", () => {
  it("accepts valid YYYY-MM-DD dates", () => {
    expect(isValidIsoDate("1990-05-15")).toBe(true);
    expect(isValidIsoDate("2000-12-31")).toBe(true);
    expect(isValidIsoDate("1970-01-01")).toBe(true);
  });

  it("rejects null and undefined", () => {
    expect(isValidIsoDate(null)).toBe(false);
    expect(isValidIsoDate(undefined)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidIsoDate("")).toBe(false);
  });

  it("rejects non-date strings", () => {
    expect(isValidIsoDate("abc")).toBe(false);
    expect(isValidIsoDate("oui")).toBe(false);
    expect(isValidIsoDate("true")).toBe(false);
  });

  it("rejects invalid month (00 or 13)", () => {
    expect(isValidIsoDate("1990-00-15")).toBe(false);
    expect(isValidIsoDate("1990-13-15")).toBe(false);
  });

  it("rejects invalid day (00)", () => {
    expect(isValidIsoDate("1990-05-00")).toBe(false);
  });

  it("rejects wrong format (DD/MM/YYYY)", () => {
    expect(isValidIsoDate("15/05/1990")).toBe(false);
  });

  it("rejects partial date strings", () => {
    expect(isValidIsoDate("1990-05")).toBe(false);
    expect(isValidIsoDate("1990")).toBe(false);
  });
});

// ── professorPayrollReadiness (URSSAF-12) ─────────────────────────────────────

describe("professorPayrollReadiness", () => {
  const FULL_PROF = {
    full_name: "Marie Dupont",
    birth_date: "1990-05-15",
    addr1: "10 rue de la Paix",
    postcode: "75001",
    city: "Paris",
    hasNir: true,
    hasIban: true,
    bic: "BNPAFRPP",
  };

  it("returns payroll_ready when all 8 fields are present", () => {
    const result = professorPayrollReadiness(FULL_PROF);
    expect(result.status).toBe("payroll_ready");
    expect(result.missingFields).toHaveLength(0);
    expect(result.score).toBe(100);
  });

  it("returns incomplete when all fields are missing", () => {
    const result = professorPayrollReadiness({});
    expect(result.status).toBe("incomplete");
    expect(result.missingFields).toHaveLength(8);
    expect(result.score).toBe(0);
  });

  it("returns partial when only postcode is missing", () => {
    const result = professorPayrollReadiness({ ...FULL_PROF, postcode: null });
    expect(result.status).toBe("partial");
    expect(result.missingFields).toEqual(["Code postal"]);
  });

  it("returns partial when postcode and city are missing", () => {
    const result = professorPayrollReadiness({
      ...FULL_PROF,
      postcode: null,
      city: null,
    });
    expect(result.status).toBe("partial");
    expect(result.missingFields).toContain("Code postal");
    expect(result.missingFields).toContain("Ville");
  });

  it("rejects non-ISO birth_date — key URSSAF-12 faux positif guard", () => {
    const result = professorPayrollReadiness({ ...FULL_PROF, birth_date: "non-renseigné" });
    expect(result.missingFields).toContain("Date de naissance (ISO)");
    expect(result.status).not.toBe("payroll_ready");
  });

  it("rejects truthy but non-ISO birth_date 'abc'", () => {
    const result = professorPayrollReadiness({ ...FULL_PROF, birth_date: "abc" });
    expect(result.missingFields).toContain("Date de naissance (ISO)");
  });

  // URSSAF-12 key fix: addr1 must come from professor_profiles (canonical PDF source)
  // No fallback to profiles.addr1 — if professor_profiles.addr1 is null, PDF shows empty
  it("flags missing addr1 even if birth_date and name are present (no profiles.addr1 fallback)", () => {
    const result = professorPayrollReadiness({ ...FULL_PROF, addr1: null });
    expect(result.missingFields).toContain("Adresse (ligne 1)");
    expect(result.status).not.toBe("payroll_ready");
  });

  it("treats empty string addr1 as missing", () => {
    const result = professorPayrollReadiness({ ...FULL_PROF, addr1: "  " });
    expect(result.missingFields).toContain("Adresse (ligne 1)");
  });

  it("returns incomplete when NIR + IBAN + BIC are all missing", () => {
    const result = professorPayrollReadiness({
      ...FULL_PROF,
      hasNir: false,
      hasIban: false,
      bic: null,
    });
    expect(result.status).toBe("incomplete");
    expect(result.missingFields).toContain("NIR (numéro sécurité sociale)");
    expect(result.missingFields).toContain("IBAN");
    expect(result.missingFields).toContain("BIC");
  });

  it("professorCompleteness payroll_ready does NOT guarantee professorPayrollReadiness payroll_ready", () => {
    // Old check passes (6/6) even with non-ISO birth_date and no postcode/city.
    // New check catches these — core URSSAF-12 improvement.
    const { professorCompleteness: _unused, ...rest } = { professorCompleteness: null };
    // Simulate a professor that would pass the old 6-field check
    const oldStyle = {
      full_name: "Jean Test",
      birth_date: "not-a-date", // truthy but not ISO
      addr1: "1 rue Test",
      hasNir: true,
      hasIban: true,
      bic: "CCFRPPXXX",
      // no postcode, no city
    };
    const newResult = professorPayrollReadiness(oldStyle);
    expect(newResult.status).not.toBe("payroll_ready");
    expect(newResult.missingFields).toContain("Date de naissance (ISO)");
    expect(newResult.missingFields).toContain("Code postal");
    expect(newResult.missingFields).toContain("Ville");
  });
});
