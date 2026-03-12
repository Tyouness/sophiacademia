/**
 * requests — business role summary
 *
 * The `requests` table covers two distinct phases of the professor ↔ family
 * relationship under a single entity.
 *
 * PHASE 1 — Candidature (application)
 *   pending       A professor applied for a family offer.
 *   coords_sent   Staff sent the family's contact details to the professor.
 *   rejected      Staff refused the application (terminal).
 *
 * PHASE 2 — Active relationship (assignment)
 *   approved      The relationship is live. This is the required gate for all
 *                 course declarations — see assertApprovedRequest below.
 *   detached      Staff ended the relationship (ended_at + end_reason written).
 *                 Already-declared courses are unaffected (no FK back to requests).
 *
 * Valid transitions:
 *   pending → coords_sent → approved → detached
 *   pending → rejected
 *   coords_sent → rejected
 *
 * The `planned_sessions` table holds the recurring schedule for an approved
 * request (FK planned_sessions.request_id → requests.id).
 *
 * courses has NO foreign key to requests. The only link is the guard below:
 * before creating a course the API verifies an approved request exists for
 * (professor_id, family_id, subject, child_id).
 */

/**
 * Guard for course declaration.
 *
 * A course can only be declared when an approved request exists for the
 * (professor, family, subject, child) combination. This is the sole mechanism
 * preventing course creation outside an active relationship.
 *
 * Called by POST /api/professor/courses before any insertion.
 */
export function assertApprovedRequest(exists: boolean) {
  if (!exists) {
    throw new Error("approved_request_required");
  }
}
