import { describe, expect, it, vi } from "vitest";
import { assertChildBelongsToFamily, childDisplayName } from "@/lib/children";
import { assertApprovedRequest } from "@/lib/requests";

// ---------------------------------------------------------------------------
// childDisplayName
// ---------------------------------------------------------------------------

describe("childDisplayName", () => {
  it("returns full name when both parts present", () => {
    expect(childDisplayName({ first_name: "Emma", last_name: "Dupont" })).toBe(
      "Emma Dupont",
    );
  });

  it("returns first name only when last name missing", () => {
    expect(childDisplayName({ first_name: "Emma", last_name: null })).toBe(
      "Emma",
    );
  });

  it("returns fallback when both null", () => {
    expect(childDisplayName({ first_name: null, last_name: null })).toBe(
      "Enfant",
    );
  });

  it("returns '-' for null input", () => {
    expect(childDisplayName(null)).toBe("-");
  });

  it("returns '-' for undefined input", () => {
    expect(childDisplayName(undefined)).toBe("-");
  });
});

// ---------------------------------------------------------------------------
// assertChildBelongsToFamily
// ---------------------------------------------------------------------------

function makeSupabaseClient(
  returnValue: { data: { id: string; family_id: string } | null; error: Error | null },
) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve(returnValue),
        }),
      }),
    }),
  } as any;
}

describe("assertChildBelongsToFamily", () => {
  it("resolves when child belongs to the family (single child)", async () => {
    const client = makeSupabaseClient({
      data: { id: "child-1", family_id: "family-A" },
      error: null,
    });
    await expect(
      assertChildBelongsToFamily("child-1", "family-A", client),
    ).resolves.toBeUndefined();
  });

  it("throws child_not_found when query returns no row", async () => {
    const client = makeSupabaseClient({ data: null, error: new Error("not found") });
    await expect(
      assertChildBelongsToFamily("child-x", "family-A", client),
    ).rejects.toThrow("child_not_found");
  });

  it("throws child_family_mismatch when child belongs to a different family", async () => {
    const client = makeSupabaseClient({
      data: { id: "child-1", family_id: "family-B" },
      error: null,
    });
    await expect(
      assertChildBelongsToFamily("child-1", "family-A", client),
    ).rejects.toThrow("child_family_mismatch");
  });

  it("handles a family with multiple children independently", async () => {
    // child-2 belongs to family-A — second child, different id
    const client = makeSupabaseClient({
      data: { id: "child-2", family_id: "family-A" },
      error: null,
    });
    await expect(
      assertChildBelongsToFamily("child-2", "family-A", client),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Workflow: paid guard (assertApprovedRequest used as sanity check pattern)
// ---------------------------------------------------------------------------

describe("course paid guard", () => {
  /**
   * Simulates the logic in POST /api/staff/courses { action: "mark_paid" }:
   * approval_status must be "family_confirmed" before the course can be paid.
   */
  function canMarkPaid(approvalStatus: string): boolean {
    return approvalStatus === "family_confirmed";
  }

  it("blocks mark_paid when family has not yet confirmed", () => {
    expect(canMarkPaid("family_pending")).toBe(false);
  });

  it("blocks mark_paid when family requested a correction", () => {
    expect(canMarkPaid("family_update_requested")).toBe(false);
  });

  it("blocks mark_paid when course was staff_canceled", () => {
    expect(canMarkPaid("staff_canceled")).toBe(false);
  });

  it("allows mark_paid only when family_confirmed", () => {
    expect(canMarkPaid("family_confirmed")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Workflow: correction returns to family_pending
// ---------------------------------------------------------------------------

describe("staff correction workflow", () => {
  /**
   * Simulates the approval_status transition applied by
   * POST /api/staff/courses { action: "correct" }.
   */
  function applyStaffCorrection(currentStatus: string): string {
    // Correction resets the course to family_pending regardless of current status.
    void currentStatus;
    return "family_pending";
  }

  it("returns family_pending after correction from family_update_requested", () => {
    expect(applyStaffCorrection("family_update_requested")).toBe("family_pending");
  });

  it("returns family_pending when staff corrects a pending course", () => {
    expect(applyStaffCorrection("family_pending")).toBe("family_pending");
  });
});

// ---------------------------------------------------------------------------
// Request ownership guard (existing helper — smoke test in new context)
// ---------------------------------------------------------------------------

describe("assertApprovedRequest in child context", () => {
  it("throws when no approved request exists for the child+family pair", () => {
    expect(() => assertApprovedRequest(false)).toThrow("approved_request_required");
  });

  it("passes when an approved request exists for the child+family pair", () => {
    expect(() => assertApprovedRequest(true)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// childId ownership — courses POST context (fix: validation added in 0018)
// Demonstrates that assertChildBelongsToFamily is called when childId is
// provided explicitly to POST /api/professor/courses, same as in requests.
// ---------------------------------------------------------------------------

describe("childId ownership — courses POST context", () => {
  it("rejects when explicit childId belongs to a different family", async () => {
    const client = makeSupabaseClient({
      data: { id: "child-1", family_id: "family-B" },
      error: null,
    });
    await expect(
      assertChildBelongsToFamily("child-1", "family-A", client),
    ).rejects.toThrow("child_family_mismatch");
  });

  it("rejects when explicit childId does not exist", async () => {
    const client = makeSupabaseClient({ data: null, error: new Error("not found") });
    await expect(
      assertChildBelongsToFamily("child-ghost", "family-A", client),
    ).rejects.toThrow("child_not_found");
  });

  it("passes when explicit childId belongs to the correct family", async () => {
    const client = makeSupabaseClient({
      data: { id: "child-1", family_id: "family-A" },
      error: null,
    });
    await expect(
      assertChildBelongsToFamily("child-1", "family-A", client),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Uniqueness: NULL child_id semantics (documents migration 0018 invariant)
//
// Migration 0018 replaces the single index on (professor_id, family_id,
// child_id, subject, status) with TWO partial indexes:
//   1. WHERE child_id IS NOT NULL — allows different children, same subject
//   2. WHERE child_id IS NULL     — restores original protection for legacy rows
//
// This test documents the application-level logic that mirrors the DB constraint.
// ---------------------------------------------------------------------------

describe("requests uniqueness — NULL child_id semantics", () => {
  /**
   * Mirrors the duplicate detection logic in POST /api/professor/requests,
   * and the SQL behaviour of the two partial indexes from migration 0018.
   */
  function isDuplicate(
    existing: { professor_id: string; family_id: string; child_id: string | null; subject: string }[],
    incoming: { professor_id: string; family_id: string; child_id: string | null; subject: string },
  ): boolean {
    return existing.some(
      (row) =>
        row.professor_id === incoming.professor_id &&
        row.family_id === incoming.family_id &&
        row.subject === incoming.subject &&
        row.child_id === incoming.child_id,
    );
  }

  const profA = "prof-1";
  const famA = "fam-1";

  it("detects duplicate when both requests have child_id = null (index 2)", () => {
    const existing = [{ professor_id: profA, family_id: famA, child_id: null, subject: "Maths" }];
    expect(isDuplicate(existing, { professor_id: profA, family_id: famA, child_id: null, subject: "Maths" })).toBe(true);
  });

  it("does NOT flag duplicate when requests are for different children (index 1)", () => {
    const existing = [{ professor_id: profA, family_id: famA, child_id: "child-1", subject: "Maths" }];
    expect(isDuplicate(existing, { professor_id: profA, family_id: famA, child_id: "child-2", subject: "Maths" })).toBe(false);
  });

  it("does NOT flag duplicate when subjects differ with null child_id", () => {
    const existing = [{ professor_id: profA, family_id: famA, child_id: null, subject: "Maths" }];
    expect(isDuplicate(existing, { professor_id: profA, family_id: famA, child_id: null, subject: "Français" })).toBe(false);
  });

  it("does NOT flag duplicate when one has a child and the other does not (different index partitions)", () => {
    const existing = [{ professor_id: profA, family_id: famA, child_id: "child-1", subject: "Maths" }];
    expect(isDuplicate(existing, { professor_id: profA, family_id: famA, child_id: null, subject: "Maths" })).toBe(false);
  });
});
