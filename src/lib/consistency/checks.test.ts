import { describe, expect, it } from "vitest";
import {
  checkPaidCoursesWithoutLines,
  checkPayslipsWithoutContributions,
  checkPayslipsWithoutFamilyDocs,
  checkUrssafRegisteredWithoutDate,
  checkStuckPayrollRuns,
  checkPayslipsMissingNumber,
  checkProfessorReadinessIssues,
  checkFamilyUrssafReadinessIssues,
  runChecks,
  type ConsistencyInput,
} from "@/lib/consistency/checks";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCourse(id: string) {
  return {
    id,
    professor_id: "prof-1",
    family_id: "fam-1",
    paid_at: "2026-02-10T10:00:00Z",
  };
}

function makePayslip(id: string, period = "2026-02", number: string | null = "BS-0001") {
  return { id, professor_id: "prof-1", period, number };
}

function makeUrssafClient(id: string, status: string, registered_at: string | null) {
  return { id, family_id: "fam-1", status, registered_at };
}

function makeStuckRun(id: string) {
  return { id, period: "2026-02", started_at: "2026-02-10T08:00:00Z" };
}

function emptyInput(): ConsistencyInput {
  return {
    paidCourses: [],
    lineCourseIds: new Set(),
    payslips: [],
    payslipIdsWithContribs: new Set(),
    payslipIdsWithFamilyDocs: new Set(),
    payslipIdsWithLines: new Set(),
    urssafClients: [],
    stuckRuns: [],
    professorReadinessIssues: [],
    familyReadinessIssues: [],
  };
}

// ── checkPaidCoursesWithoutLines ──────────────────────────────────────────────

describe("checkPaidCoursesWithoutLines", () => {
  it("returns no anomaly when all paid courses have lines", () => {
    const courses = [makeCourse("c1"), makeCourse("c2")];
    const lineIds = new Set(["c1", "c2"]);
    expect(checkPaidCoursesWithoutLines(courses, lineIds)).toHaveLength(0);
  });

  it("detects a paid course missing from payslip_lines", () => {
    const courses = [makeCourse("c1"), makeCourse("c2")];
    const lineIds = new Set(["c1"]); // c2 missing
    const anomalies = checkPaidCoursesWithoutLines(courses, lineIds);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].code).toBe("paid_course_without_payslip_line");
    expect(anomalies[0].severity).toBe("critique");
    expect(anomalies[0].entityId).toBe("c2");
  });

  it("flags all courses when set is empty", () => {
    const courses = [makeCourse("c1"), makeCourse("c2")];
    expect(checkPaidCoursesWithoutLines(courses, new Set())).toHaveLength(2);
  });

  it("returns no anomaly when paidCourses is empty", () => {
    expect(checkPaidCoursesWithoutLines([], new Set(["c1"]))).toHaveLength(0);
  });
});

// ── checkPayslipsWithoutContributions ─────────────────────────────────────────

describe("checkPayslipsWithoutContributions", () => {
  it("flags payslip with lines but no contributions", () => {
    const payslips = [makePayslip("p1")];
    const withLines = new Set(["p1"]);
    const withContribs = new Set<string>();
    const anomalies = checkPayslipsWithoutContributions(payslips, withContribs, withLines);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].code).toBe("payslip_without_contributions");
    expect(anomalies[0].severity).toBe("critique");
  });

  it("does NOT flag payslip without lines (empty run — not an anomaly)", () => {
    const payslips = [makePayslip("p1")];
    const withLines = new Set<string>(); // no lines → skip
    const withContribs = new Set<string>();
    expect(checkPayslipsWithoutContributions(payslips, withContribs, withLines)).toHaveLength(0);
  });

  it("does NOT flag payslip that has both lines and contributions", () => {
    const payslips = [makePayslip("p1")];
    const withLines = new Set(["p1"]);
    const withContribs = new Set(["p1"]);
    expect(checkPayslipsWithoutContributions(payslips, withContribs, withLines)).toHaveLength(0);
  });
});

// ── checkPayslipsWithoutFamilyDocs ────────────────────────────────────────────

describe("checkPayslipsWithoutFamilyDocs", () => {
  it("flags payslip with lines but no family document", () => {
    const payslips = [makePayslip("p1")];
    const withLines = new Set(["p1"]);
    const withDocs = new Set<string>();
    const anomalies = checkPayslipsWithoutFamilyDocs(payslips, withDocs, withLines);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].code).toBe("payslip_without_family_document");
    expect(anomalies[0].severity).toBe("important");
  });

  it("does NOT flag payslip without lines", () => {
    const payslips = [makePayslip("p1")];
    const withLines = new Set<string>();
    const withDocs = new Set<string>();
    expect(checkPayslipsWithoutFamilyDocs(payslips, withDocs, withLines)).toHaveLength(0);
  });

  it("does NOT flag payslip with both lines and family doc", () => {
    const payslips = [makePayslip("p1")];
    const withLines = new Set(["p1"]);
    const withDocs = new Set(["p1"]);
    expect(checkPayslipsWithoutFamilyDocs(payslips, withDocs, withLines)).toHaveLength(0);
  });
});

// ── checkUrssafRegisteredWithoutDate ─────────────────────────────────────────

describe("checkUrssafRegisteredWithoutDate", () => {
  it("flags registered client without registered_at", () => {
    const clients = [makeUrssafClient("u1", "registered", null)];
    const anomalies = checkUrssafRegisteredWithoutDate(clients);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].code).toBe("urssaf_registered_without_date");
    expect(anomalies[0].severity).toBe("important");
  });

  it("does NOT flag registered client WITH registered_at", () => {
    const clients = [makeUrssafClient("u1", "registered", "2026-01-15T10:00:00Z")];
    expect(checkUrssafRegisteredWithoutDate(clients)).toHaveLength(0);
  });

  it("does NOT flag pending client without registered_at", () => {
    const clients = [makeUrssafClient("u1", "pending", null)];
    expect(checkUrssafRegisteredWithoutDate(clients)).toHaveLength(0);
  });
});

// ── checkStuckPayrollRuns ─────────────────────────────────────────────────────

describe("checkStuckPayrollRuns", () => {
  it("flags stuck run", () => {
    const runs = [makeStuckRun("r1")];
    const anomalies = checkStuckPayrollRuns(runs);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].code).toBe("payroll_run_stuck_running");
    expect(anomalies[0].severity).toBe("secondaire");
    expect(anomalies[0].entityId).toBe("r1");
  });

  it("returns empty when no stuck runs", () => {
    expect(checkStuckPayrollRuns([])).toHaveLength(0);
  });
});

// ── checkPayslipsMissingNumber ────────────────────────────────────────────────

describe("checkPayslipsMissingNumber", () => {
  it("flags payslip with null number", () => {
    const payslips = [makePayslip("p1", "2026-02", null)];
    const anomalies = checkPayslipsMissingNumber(payslips);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].code).toBe("payslip_missing_number");
    expect(anomalies[0].severity).toBe("secondaire");
  });

  it("does NOT flag payslip with a number", () => {
    const payslips = [makePayslip("p1", "2026-02", "BS-0042")];
    expect(checkPayslipsMissingNumber(payslips)).toHaveLength(0);
  });
});

// ── runChecks (intégration pure) ──────────────────────────────────────────────

describe("runChecks", () => {
  it("returns empty report on clean data", () => {
    const report = runChecks(emptyInput());
    expect(report.totalAnomalies).toBe(0);
    expect(report.bySeverity.critique).toBe(0);
    expect(report.bySeverity.important).toBe(0);
    expect(report.bySeverity.secondaire).toBe(0);
    expect(report.anomalies).toHaveLength(0);
    expect(report.generatedAt).toBeTruthy();
  });

  it("aggregates all anomaly types and counts correctly", () => {
    const input: ConsistencyInput = {
      // 2 courses, neither in payslip_lines → 2 critique
      paidCourses: [makeCourse("c1"), makeCourse("c2")],
      lineCourseIds: new Set(),
      // 1 payslip with lines, no contribs, no family docs → 1 critique + 1 important
      payslips: [makePayslip("p1"), makePayslip("p2", "2026-02", null)],
      payslipIdsWithLines: new Set(["p1"]),
      payslipIdsWithContribs: new Set(),
      payslipIdsWithFamilyDocs: new Set(),
      // 1 registered without date → 1 important
      urssafClients: [makeUrssafClient("u1", "registered", null)],
      // 1 stuck run → 1 secondaire
      stuckRuns: [makeStuckRun("r1")],
      professorReadinessIssues: [],
      familyReadinessIssues: [],
    };

    const report = runChecks(input);

    // p1: no contribs (critique) + no family docs (important)
    // p2: no number (secondaire), no lines → not flagged for contribs/family docs
    expect(report.bySeverity.critique).toBe(3);  // c1 + c2 + p1 (no contribs)
    expect(report.bySeverity.important).toBe(2); // p1 (no family docs) + u1
    expect(report.bySeverity.secondaire).toBe(2); // r1 + p2 (no number)
    expect(report.totalAnomalies).toBe(7);
  });

  it("bySeverity counts match filtered anomalies", () => {
    const input: ConsistencyInput = {
      paidCourses: [makeCourse("c1")],
      lineCourseIds: new Set(), // 1 critique
      payslips: [],
      payslipIdsWithLines: new Set(),
      payslipIdsWithContribs: new Set(),
      payslipIdsWithFamilyDocs: new Set(),
      urssafClients: [],
      stuckRuns: [],
      professorReadinessIssues: [],
      familyReadinessIssues: [],
    };
    const report = runChecks(input);
    expect(report.bySeverity.critique).toBe(
      report.anomalies.filter((a) => a.severity === "critique").length,
    );
  });
});

// ── checkProfessorReadinessIssues (URSSAF-12) ───────────────────────────────────

describe("checkProfessorReadinessIssues", () => {
  it("returns no anomaly when list is empty", () => {
    expect(checkProfessorReadinessIssues([])).toHaveLength(0);
  });

  it("flags a professor with missing NIR and IBAN", () => {
    const issues = [
      {
        professorId: "prof-1",
        missingFields: ["NIR (numéro sécurité sociale)", "IBAN"],
      },
    ];
    const anomalies = checkProfessorReadinessIssues(issues);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].code).toBe("professor_dossier_incomplete_with_paid_courses");
    expect(anomalies[0].severity).toBe("critique");
    expect(anomalies[0].entityType).toBe("professor_profile");
    expect(anomalies[0].entityId).toBe("prof-1");
    expect(anomalies[0].detail).toContain("NIR");
    expect(anomalies[0].detail).toContain("IBAN");
  });

  it("produces one anomaly per professor with issues", () => {
    const issues = [
      { professorId: "prof-1", missingFields: ["Code postal"] },
      { professorId: "prof-2", missingFields: ["IBAN", "BIC"] },
    ];
    const anomalies = checkProfessorReadinessIssues(issues);
    expect(anomalies).toHaveLength(2);
    expect(anomalies.map((a) => a.entityId)).toEqual(["prof-1", "prof-2"]);
  });
});

// ── checkFamilyUrssafReadinessIssues (URSSAF-12) ──────────────────────────────

describe("checkFamilyUrssafReadinessIssues", () => {
  it("returns no anomaly when list is empty", () => {
    expect(checkFamilyUrssafReadinessIssues([])).toHaveLength(0);
  });

  it("flags a family with missing birth_date and fiscal number", () => {
    const issues = [
      {
        familyId: "fam-1",
        clientStatus: "registered",
        missingFields: ["Date de naissance (représentant)", "Numéro fiscal (SPI)"],
      },
    ];
    const anomalies = checkFamilyUrssafReadinessIssues(issues);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].code).toBe("family_dossier_incomplete_with_urssaf_client");
    expect(anomalies[0].severity).toBe("important");
    expect(anomalies[0].entityType).toBe("family_profile");
    expect(anomalies[0].entityId).toBe("fam-1");
    expect(anomalies[0].detail).toContain("registered");
    expect(anomalies[0].detail).toContain("Date de naissance");
  });

  it("flags pending status family as well", () => {
    const issues = [
      {
        familyId: "fam-2",
        clientStatus: "pending",
        missingFields: ["Adresse"],
      },
    ];
    const anomalies = checkFamilyUrssafReadinessIssues(issues);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].detail).toContain("pending");
  });

  it("produces one anomaly per family with issues", () => {
    const issues = [
      { familyId: "fam-1", clientStatus: "registered", missingFields: ["Adresse"] },
      { familyId: "fam-2", clientStatus: "pending", missingFields: ["Téléphone"] },
    ];
    expect(checkFamilyUrssafReadinessIssues(issues)).toHaveLength(2);
  });
});

// ── runChecks includes URSSAF-12 readiness checks ──────────────────────────────

describe("runChecks — URSSAF-12 readiness integration", () => {
  it("includes professor readiness critique in total count", () => {
    const input = {
      ...emptyInput(),
      professorReadinessIssues: [
        { professorId: "prof-1", missingFields: ["NIR (numéro sécurité sociale)"] },
      ],
    };
    const report = runChecks(input);
    expect(report.bySeverity.critique).toBe(1);
    expect(report.totalAnomalies).toBe(1);
    expect(report.anomalies[0].code).toBe(
      "professor_dossier_incomplete_with_paid_courses",
    );
  });

  it("includes family readiness important in total count", () => {
    const input = {
      ...emptyInput(),
      familyReadinessIssues: [
        {
          familyId: "fam-1",
          clientStatus: "registered",
          missingFields: ["Date de naissance (représentant)"],
        },
      ],
    };
    const report = runChecks(input);
    expect(report.bySeverity.important).toBe(1);
    expect(report.totalAnomalies).toBe(1);
    expect(report.anomalies[0].code).toBe(
      "family_dossier_incomplete_with_urssaf_client",
    );
  });

  it("combines readiness issues with other anomaly types correctly", () => {
    const input = {
      ...emptyInput(),
      paidCourses: [makeCourse("c1")],
      lineCourseIds: new Set<string>(), // 1 critique
      professorReadinessIssues: [
        { professorId: "prof-1", missingFields: ["BIC"] }, // 1 more critique
      ],
      familyReadinessIssues: [
        {
          familyId: "fam-1",
          clientStatus: "registered",
          missingFields: ["Adresse"],
        }, // 1 important
      ],
    };
    const report = runChecks(input);
    expect(report.bySeverity.critique).toBe(2);
    expect(report.bySeverity.important).toBe(1);
    expect(report.totalAnomalies).toBe(3);
  });
});
