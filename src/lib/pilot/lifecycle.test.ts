/**
 * pilot/lifecycle.test.ts — URSSAF-18
 */

import { describe, it, expect } from "vitest";
import {
  checkPilotLaunchGuard,
  derivePilotStatusFromVerdict,
  isPilotClosed,
  PILOT_RUN_STATUS_LABELS,
} from "./lifecycle";

// ── checkPilotLaunchGuard ─────────────────────────────────────────────────────

describe("checkPilotLaunchGuard — all clear", () => {
  const OK = { preliveStatus: "ok" as const, pairEligible: true, hasActiveRunForSlot: false };

  it("allows launch when all conditions are met", () => {
    expect(checkPilotLaunchGuard(OK).allowed).toBe(true);
  });

  it("returns null reason when allowed", () => {
    expect(checkPilotLaunchGuard(OK).reason).toBeNull();
  });

  it("returns empty details when allowed", () => {
    expect(checkPilotLaunchGuard(OK).details).toEqual([]);
  });

  it("allows launch when prelive is 'warning' (not blocking)", () => {
    expect(
      checkPilotLaunchGuard({ ...OK, preliveStatus: "warning" }).allowed,
    ).toBe(true);
  });
});

describe("checkPilotLaunchGuard — prelive blocked", () => {
  const BLOCKED = { preliveStatus: "blocked" as const, pairEligible: true, hasActiveRunForSlot: false };

  it("blocks launch", () => {
    expect(checkPilotLaunchGuard(BLOCKED).allowed).toBe(false);
  });

  it("includes prelive reason in details", () => {
    const { details } = checkPilotLaunchGuard(BLOCKED);
    expect(details[0]).toContain("hold");
  });

  it("reason equals first detail", () => {
    const result = checkPilotLaunchGuard(BLOCKED);
    expect(result.reason).toBe(result.details[0]);
  });
});

describe("checkPilotLaunchGuard — ineligible pair", () => {
  const INELIGIBLE = { preliveStatus: "ok" as const, pairEligible: false, hasActiveRunForSlot: false };

  it("blocks launch", () => {
    expect(checkPilotLaunchGuard(INELIGIBLE).allowed).toBe(false);
  });

  it("details mention eligibility", () => {
    const { details } = checkPilotLaunchGuard(INELIGIBLE);
    expect(details[0]).toContain("éligible");
  });
});

describe("checkPilotLaunchGuard — active run exists", () => {
  const ACTIVE = { preliveStatus: "ok" as const, pairEligible: true, hasActiveRunForSlot: true };

  it("blocks launch", () => {
    expect(checkPilotLaunchGuard(ACTIVE).allowed).toBe(false);
  });

  it("details mention duplicate run", () => {
    const { details } = checkPilotLaunchGuard(ACTIVE);
    expect(details[0]).toContain("en cours");
  });
});

describe("checkPilotLaunchGuard — multiple blockers", () => {
  const ALL_BLOCKED = { preliveStatus: "blocked" as const, pairEligible: false, hasActiveRunForSlot: true };

  it("accumulates all three blockers in details", () => {
    expect(checkPilotLaunchGuard(ALL_BLOCKED).details).toHaveLength(3);
  });

  it("reason is the first detail (prelive first)", () => {
    const result = checkPilotLaunchGuard(ALL_BLOCKED);
    expect(result.reason).toContain("hold");
  });

  it("is not allowed", () => {
    expect(checkPilotLaunchGuard(ALL_BLOCKED).allowed).toBe(false);
  });
});

// ── derivePilotStatusFromVerdict ──────────────────────────────────────────────

describe("derivePilotStatusFromVerdict", () => {
  it("maps success → completed_success", () => {
    expect(derivePilotStatusFromVerdict("success")).toBe("completed_success");
  });

  it("maps incomplete → completed_incomplete", () => {
    expect(derivePilotStatusFromVerdict("incomplete")).toBe("completed_incomplete");
  });

  it("maps failed → completed_failed", () => {
    expect(derivePilotStatusFromVerdict("failed")).toBe("completed_failed");
  });
});

// ── isPilotClosed ─────────────────────────────────────────────────────────────

describe("isPilotClosed", () => {
  it("running is NOT closed", () => {
    expect(isPilotClosed("running")).toBe(false);
  });

  it("completed_success IS closed", () => {
    expect(isPilotClosed("completed_success")).toBe(true);
  });

  it("completed_incomplete IS closed", () => {
    expect(isPilotClosed("completed_incomplete")).toBe(true);
  });

  it("completed_failed IS closed", () => {
    expect(isPilotClosed("completed_failed")).toBe(true);
  });

  it("abandoned IS closed", () => {
    expect(isPilotClosed("abandoned")).toBe(true);
  });
});

// ── PILOT_RUN_STATUS_LABELS ───────────────────────────────────────────────────

describe("PILOT_RUN_STATUS_LABELS", () => {
  it("covers all 5 statuses", () => {
    const statuses = ["running", "completed_success", "completed_incomplete", "completed_failed", "abandoned"];
    for (const s of statuses) {
      expect(PILOT_RUN_STATUS_LABELS[s as keyof typeof PILOT_RUN_STATUS_LABELS]).toBeTruthy();
    }
  });
});
