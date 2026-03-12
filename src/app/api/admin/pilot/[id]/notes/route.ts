/**
 * PATCH /api/admin/pilot/[id]/notes — URSSAF-19
 *
 * Enregistre des observations terrain sur un pilote en cours.
 * Uniquement disponible si status=running.
 *
 * Body : { notes: string (max 2000 chars) }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
} from "@/lib/supabase/server";

const bodySchema = z.object({
  notes: z.string().max(2000),
});

type ProfileRole = "admin" | "staff" | "family" | "professor";

async function getUserAndRole(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  const supabase = await createServerSupabaseClient({
    canSetCookies: true,
    accessToken,
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return { user, role: (profile?.role ?? null) as ProfileRole | null };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { user, role } = await getUserAndRole(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // ── Payload ───────────────────────────────────────────────────────────────
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabaseAdmin = createAdminSupabaseClient();

  // ── Vérifier que le pilote existe et est en cours ──────────────────────────
  const { data: run } = await supabaseAdmin
    .from("pilot_runs")
    .select("id, status")
    .eq("id", id)
    .single();

  if (!run) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (run.status !== "running") {
    return NextResponse.json(
      {
        error: "pilot_not_running",
        reason:
          "Les observations ne peuvent être ajoutées que sur un pilote en cours.",
      },
      { status: 409 },
    );
  }

  // ── Mise à jour ───────────────────────────────────────────────────────────
  const { error: updateError } = await supabaseAdmin
    .from("pilot_runs")
    .update({ notes: body.notes })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
