/**
 * pilot/period.test.ts — URSSAF-20
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getCurrentPeriod,
  getRecommendedPeriod,
  validatePilotPeriod,
} from "./period";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fige Date.now() sur une date UTC connue pour rendre les tests déterministes */
function mockNow(year: number, month: number /* 1-based */) {
  const ts = Date.UTC(year, month - 1, 15, 10, 0, 0);
  vi.useFakeTimers();
  vi.setSystemTime(new Date(ts));
}

afterEach(() => vi.useRealTimers());

// ── getCurrentPeriod ──────────────────────────────────────────────────────────

describe("getCurrentPeriod", () => {
  it("returns current YYYY-MM", () => {
    mockNow(2026, 3);
    expect(getCurrentPeriod()).toBe("2026-03");
  });

  it("handles January correctly", () => {
    mockNow(2026, 1);
    expect(getCurrentPeriod()).toBe("2026-01");
  });
});

// ── getRecommendedPeriod ──────────────────────────────────────────────────────

describe("getRecommendedPeriod", () => {
  it("returns M-1", () => {
    mockNow(2026, 3);
    expect(getRecommendedPeriod()).toBe("2026-02");
  });

  it("crosses year boundary correctly (January → December of prev year)", () => {
    mockNow(2026, 1);
    expect(getRecommendedPeriod()).toBe("2025-12");
  });

  it("returns YYYY-MM format", () => {
    mockNow(2026, 3);
    const result = getRecommendedPeriod();
    expect(result).toMatch(/^\d{4}-\d{2}$/);
  });
});

// ── validatePilotPeriod ───────────────────────────────────────────────────────

describe("validatePilotPeriod — invalid format", () => {
  it("rejects non-YYYY-MM format", () => {
    const r = validatePilotPeriod("2026/03");
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("Format");
  });

  it("rejects empty string", () => {
    expect(validatePilotPeriod("").valid).toBe(false);
  });
});

describe("validatePilotPeriod — current/future month rejected", () => {
  it("rejects current month", () => {
    mockNow(2026, 3);
    const r = validatePilotPeriod("2026-03");
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("clos");
  });

  it("rejects future month", () => {
    mockNow(2026, 3);
    const r = validatePilotPeriod("2026-04");
    expect(r.valid).toBe(false);
  });
});

describe("validatePilotPeriod — too old", () => {
  it("rejects period > 12 months ago", () => {
    mockNow(2026, 3);
    const r = validatePilotPeriod("2025-02"); // 13 months ago
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("ancienne");
  });
});

describe("validatePilotPeriod — valid periods", () => {
  it("accepts M-1 as valid and recommended", () => {
    mockNow(2026, 3);
    const r = validatePilotPeriod("2026-02");
    expect(r.valid).toBe(true);
    expect(r.reason).toBeNull();
    expect(r.isRecommended).toBe(true);
  });

  it("accepts M-2 as valid but not recommended", () => {
    mockNow(2026, 3);
    const r = validatePilotPeriod("2026-01");
    expect(r.valid).toBe(true);
    expect(r.isRecommended).toBe(false);
  });

  it("accepts exactly 12 months ago", () => {
    mockNow(2026, 3);
    const r = validatePilotPeriod("2025-03"); // exactly 12 months
    expect(r.valid).toBe(true);
  });

  it("isRecommended is false for M-2", () => {
    mockNow(2026, 3);
    expect(validatePilotPeriod("2026-01").isRecommended).toBe(false);
  });
});
