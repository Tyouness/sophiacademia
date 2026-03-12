/**
 * locks/operationalGuard.test.ts — URSSAF-17
 */

import { describe, it, expect } from "vitest";
import { checkOperationalGuard } from "./operationalGuard";
import type { PreliveSummary } from "@/lib/prelive/checks";

const BASE_SUMMARY: PreliveSummary = {
  globalStatus: "ok",
  generatedAt: "2024-01-01T00:00:00.000Z",
  blockingCount: 0,
  warningCount: 0,
  criteria: [],
};

const BLOCKED_SUMMARY: PreliveSummary = {
  ...BASE_SUMMARY,
  globalStatus: "blocked",
  blockingCount: 2,
  criteria: [
    {
      code: "C1",
      label: "Aucune anomalie critique",
      status: "blocked",
      blocking: true,
      detail: "2 anomalies critiques détectées",
      actionLink: "/admin/coherence",
      actionLabel: "Voir les anomalies",
    },
    {
      code: "C2",
      label: "Aucun run bloqué",
      status: "blocked",
      blocking: true,
      detail: "1 run bloqué en statut running",
      actionLink: "/admin/payroll",
      actionLabel: "Voir les runs",
    },
    {
      code: "C4",
      label: "Anomalies importantes",
      status: "warning",
      blocking: false,
      detail: "3 anomalies importantes",
      actionLink: "/admin/coherence",
      actionLabel: "Voir",
    },
  ],
};

// ── OK status ─────────────────────────────────────────────────────────────────

describe("checkOperationalGuard — globalStatus: ok", () => {
  it("allows the action", () => {
    expect(checkOperationalGuard({ ...BASE_SUMMARY, globalStatus: "ok" }).allowed).toBe(true);
  });

  it("returns null reason", () => {
    expect(checkOperationalGuard({ ...BASE_SUMMARY, globalStatus: "ok" }).reason).toBeNull();
  });

  it("returns empty details", () => {
    expect(checkOperationalGuard({ ...BASE_SUMMARY, globalStatus: "ok" }).details).toEqual([]);
  });

  it("returns /admin/prelive as actionLink", () => {
    expect(checkOperationalGuard({ ...BASE_SUMMARY, globalStatus: "ok" }).actionLink).toBe(
      "/admin/prelive",
    );
  });
});

// ── Warning status ────────────────────────────────────────────────────────────

describe("checkOperationalGuard — globalStatus: warning", () => {
  it("allows the action (warning is not a hard lock)", () => {
    const result = checkOperationalGuard({
      ...BASE_SUMMARY,
      globalStatus: "warning",
      warningCount: 1,
      criteria: [
        {
          code: "C5",
          label: "Runs récents",
          status: "warning",
          blocking: false,
          detail: "2 runs en échec dans les 30 derniers jours",
          actionLink: "/admin/payroll",
          actionLabel: "Voir les runs",
        },
      ],
    });
    expect(result.allowed).toBe(true);
  });

  it("returns null reason even with warnings", () => {
    const result = checkOperationalGuard({
      ...BASE_SUMMARY,
      globalStatus: "warning",
      warningCount: 2,
    });
    expect(result.reason).toBeNull();
  });

  it("returns empty details even with warnings", () => {
    const result = checkOperationalGuard({
      ...BASE_SUMMARY,
      globalStatus: "warning",
      warningCount: 1,
    });
    expect(result.details).toEqual([]);
  });
});

// ── Blocked status ────────────────────────────────────────────────────────────

describe("checkOperationalGuard — globalStatus: blocked", () => {
  it("blocks the action", () => {
    expect(checkOperationalGuard(BLOCKED_SUMMARY).allowed).toBe(false);
  });

  it("returns a reason containing the blocking count", () => {
    const { reason } = checkOperationalGuard(BLOCKED_SUMMARY);
    expect(reason).toContain("2");
  });

  it("reason mentions hold state", () => {
    const { reason } = checkOperationalGuard(BLOCKED_SUMMARY);
    expect(reason).toContain("hold");
  });

  it("details include all blocking-criterion details", () => {
    const { details } = checkOperationalGuard(BLOCKED_SUMMARY);
    expect(details).toContain("2 anomalies critiques détectées");
    expect(details).toContain("1 run bloqué en statut running");
  });

  it("details length matches number of blocking criteria", () => {
    expect(checkOperationalGuard(BLOCKED_SUMMARY).details).toHaveLength(2);
  });

  it("does NOT include non-blocking warning criterion in details", () => {
    const { details } = checkOperationalGuard(BLOCKED_SUMMARY);
    expect(details).not.toContain("3 anomalies importantes");
  });

  it("returns /admin/prelive as actionLink", () => {
    expect(checkOperationalGuard(BLOCKED_SUMMARY).actionLink).toBe("/admin/prelive");
  });

  it("singular reason for exactly 1 blocking criterion", () => {
    const single: PreliveSummary = {
      ...BASE_SUMMARY,
      globalStatus: "blocked",
      blockingCount: 1,
      criteria: [
        {
          code: "C1",
          label: "Aucune anomalie critique",
          status: "blocked",
          blocking: true,
          detail: "2 anomalies critiques",
          actionLink: "/admin/coherence",
          actionLabel: "Voir",
        },
      ],
    };
    expect(checkOperationalGuard(single).reason).toBe(
      "Système en état hold — 1 blocage critique actif",
    );
  });

  it("plural reason for 3 blocking criteria", () => {
    const triple: PreliveSummary = {
      ...BASE_SUMMARY,
      globalStatus: "blocked",
      blockingCount: 3,
      criteria: [
        { code: "C1", label: "C1", status: "blocked", blocking: true, detail: "A", actionLink: null, actionLabel: null },
        { code: "C2", label: "C2", status: "blocked", blocking: true, detail: "B", actionLink: null, actionLabel: null },
        { code: "C3", label: "C3", status: "blocked", blocking: true, detail: "C", actionLink: null, actionLabel: null },
      ],
    };
    const { reason } = checkOperationalGuard(triple);
    expect(reason).toContain("3");
    expect(reason).toContain("blocage(s) critique(s)");
  });

  it("excludes null detail values from details array", () => {
    const nullDetail: PreliveSummary = {
      ...BASE_SUMMARY,
      globalStatus: "blocked",
      blockingCount: 1,
      criteria: [
        {
          code: "C1",
          label: "C1",
          status: "blocked",
          blocking: true,
          detail: null,
          actionLink: null,
          actionLabel: null,
        },
      ],
    };
    expect(checkOperationalGuard(nullDetail).details).toHaveLength(0);
  });

  it("includes only details where blocking && status === blocked", () => {
    const mixed: PreliveSummary = {
      ...BASE_SUMMARY,
      globalStatus: "blocked",
      blockingCount: 1,
      criteria: [
        { code: "C1", label: "C1", status: "blocked", blocking: true, detail: "detail-blocking", actionLink: null, actionLabel: null },
        { code: "C2", label: "C2", status: "ok", blocking: true, detail: "detail-ok-blocking", actionLink: null, actionLabel: null },
        { code: "C3", label: "C3", status: "blocked", blocking: false, detail: "detail-blocked-nonblocking", actionLink: null, actionLabel: null },
      ],
    };
    const { details } = checkOperationalGuard(mixed);
    expect(details).toEqual(["detail-blocking"]);
  });
});
