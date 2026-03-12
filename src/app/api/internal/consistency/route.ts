import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runConsistencyChecks } from "@/lib/consistency/runner";

/**
 * GET /api/internal/consistency
 *
 * Exécute les contrôles de cohérence inter-tables et retourne le rapport JSON.
 * Accès réservé aux admins.
 *
 * Utilisé par la page /admin/consistency (via fetch depuis le client) ou
 * directement par des outils de monitoring.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const report = await runConsistencyChecks();
  return NextResponse.json(report);
}
