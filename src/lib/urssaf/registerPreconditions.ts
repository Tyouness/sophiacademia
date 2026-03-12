/**
 * Pure precondition check for URSSAF employer registration.
 * Used by FamilyUrssafPanel (UI gating) and documented here to mirror the
 * server-side guards in register-client/route.ts.
 *
 * Relaunching is allowed when:
 *   - urssafStatus is null    → no urssaf_clients row yet (never attempted)
 *   - urssafStatus is 'pending' → row exists but API not yet called
 *
 * Blocked when:
 *   - urssafStatus is 'registered' → already done, relaunching not allowed
 *   - readinessStatus is not 'urssaf_ready' → dossier fields incomplete
 */

export type EmployerReadinessStatus = "incomplete" | "partial" | "urssaf_ready";

export type RegisterPrecheck = {
  canRegister: boolean;
  /**
   * null             → no blocker (canRegister = true)
   * 'already_registered' → family has status='registered', blocked
   * 'dossier_not_ready'  → readiness is not urssaf_ready
   */
  blockerCode: "already_registered" | "dossier_not_ready" | null;
  blockerLabel: string | null;
};

export function checkRegisterPreconditions(opts: {
  readinessStatus: EmployerReadinessStatus;
  urssafStatus: string | null;
}): RegisterPrecheck {
  const { readinessStatus, urssafStatus } = opts;

  if (urssafStatus === "registered") {
    return {
      canRegister: false,
      blockerCode: "already_registered",
      blockerLabel: "Cette famille est déjà enregistrée chez URSSAF.",
    };
  }

  if (readinessStatus !== "urssaf_ready") {
    return {
      canRegister: false,
      blockerCode: "dossier_not_ready",
      blockerLabel: "Le dossier n'est pas encore complet pour l'activation URSSAF.",
    };
  }

  return { canRegister: true, blockerCode: null, blockerLabel: null };
}
