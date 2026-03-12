import type { SupabaseClient } from "@supabase/supabase-js";

export type PlannedSession = {
  id: string;
  request_id: string;
  scheduled_at: string;
  duration_hours: number;
  status: "scheduled" | "cancelled";
  created_at: string;
  updated_at: string;
};

/**
 * Replaces all planned_sessions for a given request.
 * Deletes existing rows, then inserts one row per scheduled_at timestamp.
 * This is a replace-all strategy (safe during the dual-write transition period).
 *
 * Returns the newly inserted rows, or throws on error.
 */
export async function upsertPlannedSessions(
  requestId: string,
  scheduledAt: string[],
  durationHours: number,
  supabase: SupabaseClient,
): Promise<PlannedSession[]> {
  // 1. Delete existing sessions for this request.
  const { error: deleteError } = await supabase
    .from("planned_sessions")
    .delete()
    .eq("request_id", requestId);

  if (deleteError) {
    throw new Error(`planned_sessions_delete_failed: ${deleteError.message}`);
  }

  if (scheduledAt.length === 0) {
    return [];
  }

  // 2. Insert new sessions.
  const rows = scheduledAt.map((ts) => ({
    request_id: requestId,
    scheduled_at: ts,
    duration_hours: durationHours,
    status: "scheduled" as const,
  }));

  const { data, error: insertError } = await supabase
    .from("planned_sessions")
    .insert(rows)
    .select(
      "id, request_id, scheduled_at, duration_hours, status, created_at, updated_at",
    );

  if (insertError) {
    throw new Error(`planned_sessions_insert_failed: ${insertError.message}`);
  }

  return (data ?? []) as PlannedSession[];
}

/**
 * Returns all planned_sessions for a given request, ordered by scheduled_at.
 */
export async function getPlannedSessions(
  requestId: string,
  supabase: SupabaseClient,
): Promise<PlannedSession[]> {
  const { data, error } = await supabase
    .from("planned_sessions")
    .select(
      "id, request_id, scheduled_at, duration_hours, status, created_at, updated_at",
    )
    .eq("request_id", requestId)
    .order("scheduled_at", { ascending: true });

  if (error) {
    throw new Error(`planned_sessions_read_failed: ${error.message}`);
  }

  return (data ?? []) as PlannedSession[];
}
