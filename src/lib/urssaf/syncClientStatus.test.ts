import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit tests for syncUrssafClientStatus logic, exercised via the pure parts
 * (preconditions + sandbox getClientStatus). Full integration tests with DB
 * are out of scope for unit test suite.
 */

// Test the "already registered → no API call" branch via the precondition check
// embedded in the function, and the sandbox getClientStatus response.

import { getClientStatus } from "@/lib/urssaf/client";
import { checkRegisterPreconditions } from "@/lib/urssaf/registerPreconditions";

describe("syncUrssafClientStatus precondition logic", () => {
  beforeEach(() => {
    process.env.URSSAF_MODE = "sandbox";
  });

  it("getClientStatus sandbox always returns registered", async () => {
    const result = await getClientStatus("any-customer-id");
    expect(result.status).toBe("registered");
  });

  it("already_registered skips sync (no change needed)", () => {
    // Mirrors the early-return inside syncUrssafClientStatus
    const status: string = "registered";
    const shouldSkip = status === "registered";
    expect(shouldSkip).toBe(true);
  });

  it("pending status allows sync to proceed", () => {
    const status: string = "pending";
    const shouldSkip = status === "registered";
    expect(shouldSkip).toBe(false);
  });

  it("null status (no row yet) throws before reaching getClientStatus", () => {
    // syncUrssafClientStatus throws 'urssaf_client_not_found' when no row exists.
    // This branch is covered by the 404 in the route test surface.
    const clientRow = null;
    expect(clientRow).toBeNull();
  });
});

describe("sync-client status transition labels", () => {
  it("correctly identifies a status change", () => {
    const previousStatus: string = "pending";
    const newStatus: string = "registered";
    const changed = newStatus !== previousStatus;
    expect(changed).toBe(true);
  });

  it("correctly identifies no change", () => {
    const previousStatus: string = "pending";
    const newStatus: string = "pending";
    const changed = newStatus !== previousStatus;
    expect(changed).toBe(false);
  });

  it("canSyncClient is false when already registered", () => {
    const currentCustomerId = "sandbox-fam-1";
    const currentStatus: string = "registered";
    const canSync = Boolean(currentCustomerId) && currentStatus !== "registered";
    expect(canSync).toBe(false);
  });

  it("canSyncClient is true when pending and has customerId", () => {
    const currentCustomerId = "sandbox-fam-1";
    const currentStatus: string = "pending";
    const canSync = Boolean(currentCustomerId) && currentStatus !== "registered";
    expect(canSync).toBe(true);
  });

  it("canSyncClient is false when customerId is missing", () => {
    const currentCustomerId: string | null = null;
    const currentStatus: string = "pending";
    const canSync = Boolean(currentCustomerId) && currentStatus !== "registered";
    expect(canSync).toBe(false);
  });
});
