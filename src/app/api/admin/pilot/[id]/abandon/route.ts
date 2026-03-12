/**
 * POST /api/admin/pilot/[id]/abandon — URSSAF-18/20
 *
 * Abandonne manuellement un pilote en cours.
 * Guards : admin, pilote existant en statut 'running'.
 *
 * Body : { notes: string (min 10, max 1000) }
 * Les notes sont obligatoires pour tracer la raison de l'abandon.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({
  notes: z.string().min(10, "Les notes doivent contenir au moins 10 caractères").max(1000),
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { user, role } = await getUserAndRole(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Notes obligatoires — traçabilité de la raison de l'abandon
  let notes: string;
  try {
    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "notes_required", reason: "Les notes de conclusion sont obligatoires pour un abandon (min. 10 caractères)." },
        { status: 422 },
      );
    }
    notes = parsed.data.notes;
  } catch {
    return NextResponse.json(
      { error: "notes_required", reason: "Les notes de conclusion sont obligatoires." },
      { status: 422 },
    );
  }

  const supabaseAdmin = createAdminSupabaseClient();

  const { data: pilotRun } = await supabaseAdmin
    .from("pilot_runs")
    .select("id, professor_id, status")
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

  const { error: updateError } = await supabaseAdmin
    .from("pilot_runs")
    .update({
      status:    "abandoned",
      closed_at: new Date().toISOString(),
      notes,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  await logAudit({
    actorId:  user.id,
    action:   "pilot_abandoned",
    entity:   "pilot_run",
    entityId: id,
    payload:  { notes: notes ?? null },
    targetUserId: pilotRun.professor_id as string,
  });

  return NextResponse.json({ runId: id, status: "abandoned" });
}
