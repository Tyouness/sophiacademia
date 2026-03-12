/**
 * pilot/goGuard.test.ts — URSSAF-20
 */

import { describe, it, expect } from "vitest";
import {
  buildFirstRunGoChecklist,
  type FirstRunGoChecklistInput,
} from "./goGuard";

// ── Default "all green" input ─────────────────────────────────────────────────

const ALL_GO: FirstRunGoChecklistInput = {
  preliveStatus: "ok",
  runningPilotCount: 0,
  topCandidateEligible: true,
  topCandidateFamilyCount: 1,
  topCandidateCourseCount: 5,
  periodIsValid: true,
  periodIsRecommended: true,
};

// ── canGo / all green ─────────────────────────────────────────────────────────

describe("buildFirstRunGoChecklist — all green", () => {
  it("canGo is true when all conditions met", () => {
    expect(buildFirstRunGoChecklist(ALL_GO).canGo).toBe(true);
  });

  it("blockingFailCount is 0", () => {
    expect(buildFirstRunGoChecklist(ALL_GO).blockingFailCount).toBe(0);
  });

  it("warningCount is 0", () => {
    expect(buildFirstRunGoChecklist(ALL_GO).warningCount).toBe(0);
  });

  it("returns 7 checklist items", () => {
    expect(buildFirstRunGoChecklist(ALL_GO).items).toHaveLength(7);
  });
});

// ── Blocking items ────────────────────────────────────────────────────────────

describe("buildFirstRunGoChecklist — prelive blocked", () => {
  it("canGo is false", () => {
    const r = buildFirstRunGoChecklist({ ...ALL_GO, preliveStatus: "blocked" });
    expect(r.canGo).toBe(false);
  });

  it("blockingFailCount increments", () => {
    const r = buildFirstRunGoChecklist({ ...ALL_GO, preliveStatus: "blocked" });
    expect(r.blockingFailCount).toBe(1);
  });

  it("prelive warning does NOT block (ok = true but detail set)", () => {
    const r = buildFirstRunGoChecklist({ ...ALL_GO, preliveStatus: "warning" });
    const item = r.items.find((i) => i.label.includes("pré-live"));
    expect(item?.ok).toBe(true);
    expect(item?.detail).toContain("Avertissement");
  });
});

describe("buildFirstRunGoChecklist — running pilot exists", () => {
  it("canGo is false when pilot running", () => {
    const r = buildFirstRunGoChecklist({ ...ALL_GO, runningPilotCount: 1 });
    expect(r.canGo).toBe(false);
  });

  it("detail mentions count", () => {
    const r = buildFirstRunGoChecklist({ ...ALL_GO, runningPilotCount: 2 });
    const item = r.items.find((i) => i.label.includes("Aucun pilote"));
    expect(item?.detail).toContain("2");
  });
});

describe("buildFirstRunGoChecklist — top candidate not eligible", () => {
  it("canGo is false", () => {
    const r = buildFirstRunGoChecklist({ ...ALL_GO, topCandidateEligible: false });
    expect(r.canGo).toBe(false);
  });
});

describe("buildFirstRunGoChecklist — period invalid", () => {
  it("canGo is false when period invalid", () => {
    const r = buildFirstRunGoChecklist({ ...ALL_GO, periodIsValid: false });
    expect(r.canGo).toBe(false);
  });
});

// ── Non-blocking warnings ─────────────────────────────────────────────────────

describe("buildFirstRunGoChecklist — warnings (non-blocking)", () => {
  it("canGo remains true with period not recommended", () => {
    const r = buildFirstRunGoChecklist({ ...ALL_GO, periodIsRecommended: false });
    expect(r.canGo).toBe(true);
    expect(r.warningCount).toBe(1);
  });

  it("canGo remains true with 2 families", () => {
    const r = buildFirstRunGoChecklist({ ...ALL_GO, topCandidateFamilyCount: 2 });
    expect(r.canGo).toBe(true);
    expect(r.warningCount).toBe(1);
  });

  it("canGo remains true with low course count", () => {
    const r = buildFirstRunGoChecklist({ ...ALL_GO, topCandidateCourseCount: 1 });
    expect(r.canGo).toBe(true);
    expect(r.warningCount).toBe(1);
  });

  it("canGo remains true with high course count", () => {
    const r = buildFirstRunGoChecklist({ ...ALL_GO, topCandidateCourseCount: 25 });
    expect(r.canGo).toBe(true);
    expect(r.warningCount).toBe(1);
  });

  it("3 warnings do not block", () => {
    const r = buildFirstRunGoChecklist({
      ...ALL_GO,
      periodIsRecommended: false,
      topCandidateFamilyCount: 3,
      topCandidateCourseCount: 30,
    });
    expect(r.canGo).toBe(true);
    expect(r.warningCount).toBe(3);
  });
});

// ── Multiple blocking failures ────────────────────────────────────────────────

describe("buildFirstRunGoChecklist — multiple blockers", () => {
  it("accumulates blocking failures", () => {
    const r = buildFirstRunGoChecklist({
      ...ALL_GO,
      preliveStatus: "blocked",
      runningPilotCount: 1,
      topCandidateEligible: false,
      periodIsValid: false,
    });
    expect(r.blockingFailCount).toBe(4);
    expect(r.canGo).toBe(false);
  });
});

// ── Item structure ────────────────────────────────────────────────────────────

describe("buildFirstRunGoChecklist — item structure", () => {
  it("all items have required fields", () => {
    const { items } = buildFirstRunGoChecklist(ALL_GO);
    for (const item of items) {
      expect(typeof item.label).toBe("string");
      expect(typeof item.ok).toBe("boolean");
      expect(typeof item.blocking).toBe("boolean");
    }
  });

  it("green items have null detail", () => {
    const { items } = buildFirstRunGoChecklist(ALL_GO);
    for (const item of items) {
      expect(item.detail).toBeNull();
    }
  });
});
