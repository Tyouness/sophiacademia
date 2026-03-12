import { describe, expect, it } from "vitest";
import { assertApprovedRequest } from "@/lib/requests";

describe("assertApprovedRequest", () => {
  it("throws when missing approved request", () => {
    expect(() => assertApprovedRequest(false)).toThrow(
      "approved_request_required",
    );
  });

  it("does not throw when approved request exists", () => {
    expect(() => assertApprovedRequest(true)).not.toThrow();
  });
});
