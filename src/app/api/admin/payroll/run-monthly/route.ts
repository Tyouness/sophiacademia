import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runMonthly } from "@/lib/payroll/runMonthly";
import { runPreliveChecks } from "@/lib/prelive/runner";
import { checkOperationalGuard } from "@/lib/locks/operationalGuard";

const querySchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

type ProfileRole = "admin" | "staff" | "family" | "professor";

async function getUserAndRole(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const supabase = await createServerSupabaseClient({ canSetCookies: true, accessToken });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, role: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, disabled_at, deleted_at")
    .eq("id", user.id)
    .single();

  if (!profile || profile.disabled_at || profile.deleted_at) {
    return { supabase, user, role: null };
  }

  return { supabase, user, role: profile.role as ProfileRole };
}

function getPreviousMonthKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = new Date(Date.UTC(year, month - 1, 1));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function GET(request: Request) {
  const { user, role } = await getUserAndRole(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Operational lock: block if prelive checks fail ────────────────────────
  const prelive = await runPreliveChecks();
  const guard = checkOperationalGuard(prelive);
  if (!guard.allowed) {
    return NextResponse.json(
      {
        error: "system_locked",
        reason: guard.reason,
        details: guard.details,
        actionLink: guard.actionLink,
      },
      { status: 423 },
    );
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ period: url.searchParams.get("period") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const period = parsed.data.period ?? getPreviousMonthKey();
  const result = await runMonthly(period, user.id);

  return NextResponse.json({
    period: result.period,
    runId: result.runId,
    status: result.status,
    professorsProcessed: result.professorsProcessed,
    payslipsCreated: result.payslipsCreated,
    familyDocsCreated: result.familyDocsCreated,
    familyDocsFailed: result.familyDocsFailed,
    contribErrors: result.contribErrors,
    errorsCount: result.errorsCount,
    errorDetails: result.errorDetails,
    durationMs: result.durationMs,
  });
}
