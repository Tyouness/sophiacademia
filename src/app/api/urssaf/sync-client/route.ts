import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rateLimitSensitive, getClientIp } from "@/lib/security/rate-limit";
import { syncUrssafClientStatus } from "@/lib/urssaf/workflow";
import { runPreliveChecks } from "@/lib/prelive/runner";
import { checkOperationalGuard } from "@/lib/locks/operationalGuard";

type ProfileRole = "admin" | "staff" | "family" | "professor";

async function getUserAndRole(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  const supabase = await createServerSupabaseClient({ canSetCookies: true, accessToken });
  const {
    data: { user },
  } = accessToken ? await supabase.auth.getUser(accessToken) : await supabase.auth.getUser();

  if (!user) {
    return { user: null, role: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return { user, role: (profile?.role ?? null) as ProfileRole | null };
}

const payloadSchema = z.object({
  familyId: z.string().uuid(),
});

export async function POST(request: Request) {
  const { user, role } = await getUserAndRole(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (role !== "staff" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rate = await rateLimitSensitive(`urssaf:sync-client:${ip}:${user.id}`);
  if (!rate.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const result = await syncUrssafClientStatus({
      familyId: payload.familyId,
      actorId: user.id,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal_error";

    if (message === "urssaf_client_not_found") {
      return NextResponse.json({ error: "urssaf_client_not_found" }, { status: 404 });
    }
    if (message === "urssaf_customer_id_missing") {
      return NextResponse.json({ error: "urssaf_customer_id_missing" }, { status: 409 });
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
