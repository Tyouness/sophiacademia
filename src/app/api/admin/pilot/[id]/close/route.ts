/**
 * POST /api/admin/pilot/[id]/close — URSSAF-18
 *
 * Évalue les artefacts de validation pour le pilote et le clôture.
 * Détermine le statut final : completed_success / completed_incomplete / completed_failed.
 *
 * Guards : admin, pilote existant et en statut 'running'.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { runPilotValidationForPair } from "@/lib/pilot/validation-runner";
import { derivePilotStatusFromVerdict } from "@/lib/pilot/lifecycle";
import { logAudit } from "@/lib/audit";

type ProfileRole = "admin" | "staff" | "family" | "professor";

async function getUserAndRole(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const supabase = await createServerSupabaseClient({ canSetCookies: true, accessToken });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return { user, role: (profile?.role ?? null) as ProfileRole | null };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { user, role } = await getUserAndRole(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabaseAdmin = createAdminSupabaseClient();

  // Fetch the pilot run
  const { data: pilotRun } = await supabaseAdmin
    .from("pilot_runs")
    .select("id, professor_id, period, status")
    .eq("id", id)
    .maybeSingle();

  if (!pilotRun) {
    return NextResponse.json({ error: "pilot_run_not_found" }, { status: 404 });
  }
  if (pilotRun.status !== "running") {
    return NextResponse.json(
      { error: "pilot_already_closed", currentStatus: pilotRun.status },
      { status: 409 },
    );
  }

  // Evaluate artifacts for this (professor_id, period)
  const validationResult = await runPilotValidationForPair(
    pilotRun.professor_id as string,
    pilotRun.period as string,
  );

  // If no paid courses found at all, treat as failed
  const verdict = validationResult?.verdict ?? "failed";
  const newStatus = derivePilotStatusFromVerdict(verdict);

  const { error: updateError } = await supabaseAdmin
    .from("pilot_runs")
    .update({ status: newStatus, closed_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  await logAudit({
    actorId:  user.id,
    action:   "pilot_closed",
    entity:   "pilot_run",
    entityId: id,
    payload:  { newStatus, verdict, missingCount: validationResult?.missingCount ?? null },
    targetUserId: pilotRun.professor_id as string,
  });

  return NextResponse.json({
    runId:     id,
    status:    newStatus,
    verdict,
    artifacts: validationResult?.artifacts ?? [],
  });
}
