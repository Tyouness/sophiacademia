/**
 * POST /api/admin/pilot/launch — URSSAF-18
 *
 * Déclare et trace le lancement d'un pilote encadré.
 * Insère une ligne dans pilot_runs avec status='running'.
 *
 * Guards :
 *  1. Admin uniquement
 *  2. Système non bloqué (prelive check — 423)
 *  3. Pas de pilote running déjà actif sur (professor_id, period) — 409
 *
 * Body : { professorId, period, familyIds, professorName? }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { runPreliveChecks } from "@/lib/prelive/runner";
import { checkOperationalGuard } from "@/lib/locks/operationalGuard";
import { checkGlobalSinglePilotGuard } from "@/lib/pilot/lifecycle";
import { logAudit } from "@/lib/audit";

const payloadSchema = z.object({
  professorId:   z.string().uuid(),
  period:        z.string().regex(/^\d{4}-\d{2}$/),
  familyIds:     z.array(z.string().uuid()),
  professorName: z.string().max(200).nullable().optional(),
});

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

export async function POST(request: Request) {
  const { user, role } = await getUserAndRole(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // ── Operational lock ──────────────────────────────────────────────────────
  const prelive = await runPreliveChecks();
  const guard = checkOperationalGuard(prelive);
  if (!guard.allowed) {
    return NextResponse.json(
      { error: "system_locked", reason: guard.reason, details: guard.details, actionLink: guard.actionLink },
      { status: 423 },
    );
  }

  // ── Payload ───────────────────────────────────────────────────────────────
  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabaseAdmin = createAdminSupabaseClient();

  // ── Guard : un seul pilote running globalement (URSSAF-19) ───────────────
  const { count: runningCount } = await supabaseAdmin
    .from("pilot_runs")
    .select("id", { count: "exact", head: true })
    .eq("status", "running");

  const globalGuard = checkGlobalSinglePilotGuard(runningCount ?? 0);
  if (!globalGuard.allowed) {
    return NextResponse.json(
      { error: "global_pilot_running", reason: globalGuard.reason },
      { status: 409 },
    );
  }

  // ── Guard : doublon actif ─────────────────────────────────────────────────
  // La contrainte unique partielle en DB attrapera aussi ce cas, mais on
  // retourne un message clair avant d'arriver à une erreur Postgres.
  const { data: existing } = await supabaseAdmin
    .from("pilot_runs")
    .select("id")
    .eq("professor_id", payload.professorId)
    .eq("period", payload.period)
    .eq("status", "running")
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "duplicate_active_pilot", existingRunId: existing.id },
      { status: 409 },
    );
  }

  // ── Insertion ─────────────────────────────────────────────────────────────
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("pilot_runs")
    .insert({
      professor_id:   payload.professorId,
      professor_name: payload.professorName ?? null,
      period:         payload.period,
      family_ids:     payload.familyIds,
      status:         "running",
      launched_by:    user.id,
    })
    .select("id, status, launched_at")
    .single();

  if (insertError || !inserted) {
    // Unique index violation = concurrent duplicate — map to 409
    if (insertError?.code === "23505") {
      return NextResponse.json({ error: "duplicate_active_pilot" }, { status: 409 });
    }
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  await logAudit({
    actorId: user.id,
    action:  "pilot_launched",
    entity:  "pilot_run",
    entityId: inserted.id,
    payload: { professorId: payload.professorId, period: payload.period, familyCount: payload.familyIds.length },
    targetUserId: payload.professorId,
  });

  return NextResponse.json({
    runId:      inserted.id,
    status:     inserted.status,
    launchedAt: inserted.launched_at,
  });
}
