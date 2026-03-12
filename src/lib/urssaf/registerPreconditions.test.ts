import { describe, expect, it } from "vitest";
import { checkRegisterPreconditions } from "./registerPreconditions";

describe("checkRegisterPreconditions", () => {
  it("allows registration when urssaf_ready and no urssaf_clients row (status null)", () => {
    const r = checkRegisterPreconditions({ readinessStatus: "urssaf_ready", urssafStatus: null });
    expect(r.canRegister).toBe(true);
    expect(r.blockerCode).toBeNull();
    expect(r.blockerLabel).toBeNull();
  });

  it("allows relaunch when urssaf_ready and status is pending", () => {
    const r = checkRegisterPreconditions({ readinessStatus: "urssaf_ready", urssafStatus: "pending" });
    expect(r.canRegister).toBe(true);
    expect(r.blockerCode).toBeNull();
  });

  it("blocks registration when already registered", () => {
    const r = checkRegisterPreconditions({ readinessStatus: "urssaf_ready", urssafStatus: "registered" });
    expect(r.canRegister).toBe(false);
    expect(r.blockerCode).toBe("already_registered");
    expect(r.blockerLabel).toBeTruthy();
  });

  it("blocks when dossier is incomplete and status is null", () => {
    const r = checkRegisterPreconditions({ readinessStatus: "incomplete", urssafStatus: null });
    expect(r.canRegister).toBe(false);
    expect(r.blockerCode).toBe("dossier_not_ready");
  });

  it("blocks when dossier is partial even if status is pending", () => {
    const r = checkRegisterPreconditions({ readinessStatus: "partial", urssafStatus: "pending" });
    expect(r.canRegister).toBe(false);
    expect(r.blockerCode).toBe("dossier_not_ready");
  });

  it("already_registered takes priority even when readiness is urssaf_ready", () => {
    const r = checkRegisterPreconditions({ readinessStatus: "urssaf_ready", urssafStatus: "registered" });
    expect(r.canRegister).toBe(false);
    expect(r.blockerCode).toBe("already_registered");
  });
});
