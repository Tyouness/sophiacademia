import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { getClientIp, rateLimitSensitive } from "@/lib/security/rate-limit";
import { assertChildBelongsToFamily } from "@/lib/children";
import { upsertPlannedSessions } from "@/lib/planned-sessions";

const requestSchema = z.object({
  familyId: z.string().uuid(),
  subject: z.string().trim().min(1).max(120),
  childId: z.string().uuid().optional(),
});

const scheduleSchema = z.object({
  requestId: z.string().uuid(),
  weeklySchedule: z.array(z.string().datetime()).min(1).max(7),
  weeklySessions: z.number().int().min(1).max(7),
  sessionHours: z.number().min(0.5).max(6),
}).superRefine((value, ctx) => {
  if (value.weeklySchedule.length !== value.weeklySessions) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "weekly_schedule_length_mismatch",
    });
  }
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
  } = accessToken
    ? await supabase.auth.getUser(accessToken)
    : await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, role: null };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, disabled_at, deleted_at")
    .eq("id", user.id)
    .single();

  if (error || !profile || profile.disabled_at || profile.deleted_at) {
    return { supabase, user, role: null };
  }

  return { supabase, user, role: profile.role as ProfileRole };
}

export async function POST(request: Request) {
  const { supabase, user, role } = await getUserAndRole(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "professor" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rate = await rateLimitSensitive(`prof:request:${ip}:${user.id}`);
  if (!rate.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let payload: z.infer<typeof requestSchema>;
  try {
    payload = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("requests")
    .select("id")
    .eq("professor_id", user.id)
    .eq("family_id", payload.familyId)
    .eq("subject", payload.subject)
    .in("status", ["pending", "coords_sent", "approved"]);

  if (existingError) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "Already exists" }, { status: 409 });
  }

  const supabaseAdmin = createAdminSupabaseClient();

  // Validate child ownership if provided
  if (payload.childId) {
    try {
      await assertChildBelongsToFamily(payload.childId, payload.familyId, supabaseAdmin);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "child_error";
      return NextResponse.json({ error: msg }, { status: 409 });
    }
  }
  const { data: profProfile } = await supabaseAdmin
    .from("professor_profiles")
    .select("lat, lng")
    .eq("id", user.id)
    .single();

  if (!profProfile?.lat || !profProfile?.lng) {
    return NextResponse.json(
      { error: "missing_professor_location" },
      { status: 409 },
    );
  }

  const { data: familyProfile } = await supabaseAdmin
    .from("family_profiles")
    .select("lat, lng")
    .eq("id", payload.familyId)
    .single();

  if (!familyProfile?.lat || !familyProfile?.lng) {
    return NextResponse.json(
      { error: "missing_family_location" },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("requests")
    .insert({
      professor_id: user.id,
      family_id: payload.familyId,
      subject: payload.subject,
      child_id: payload.childId ?? null,
      status: "pending",
    })
    .select("id, professor_id, family_id, subject, status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }

  await logAudit({
    actorId: user.id,
    action: "request_created",
    entity: "request",
    entityId: data.id,
    payload: {
      professorId: data.professor_id,
      familyId: data.family_id,
      subject: data.subject,
      status: data.status,
    },
  });

  return NextResponse.json({ data });
}

export async function GET(request: Request) {
  const { user, role } = await getUserAndRole(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabaseAdmin = createAdminSupabaseClient();
  const { data, error } = await supabaseAdmin
    .from("requests")
    .select(
      "id, family_id, child_id, subject, status, family:profiles!requests_family_id_fkey(full_name, phone, addr1, addr2, postcode, city, country), child:family_children(first_name, last_name)",
    )
    .eq("professor_id", user.id)
    .in("status", ["coords_sent", "approved"])
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }

  // Enrich each request row with its planned_sessions.
  // Fetched in one query then merged in-memory to avoid N+1 calls.
  const rows = data ?? [];
  const requestIds = rows.map((r) => r.id as string);

  let plannedByRequest: Record<string, unknown[]> = {};
  if (requestIds.length > 0) {
    try {
      const { data: ps } = await supabaseAdmin
        .from("planned_sessions")
        .select("id, request_id, scheduled_at, duration_hours, status")
        .in("request_id", requestIds)
        .order("scheduled_at", { ascending: true });

      for (const session of ps ?? []) {
        const s = session as { request_id: string;[key: string]: unknown };
        if (!plannedByRequest[s.request_id]) {
          plannedByRequest[s.request_id] = [];
        }
        plannedByRequest[s.request_id].push(s);
      }
    } catch {
      // Non-fatal: planned_sessions may not exist yet in older environments.
      plannedByRequest = {};
    }
  }

  const enriched = rows.map((r) => ({
    ...r,
    planned_sessions: plannedByRequest[r.id as string] ?? [],
  }));

  return NextResponse.json({ data: enriched });
}

export async function PATCH(request: Request) {
  const { supabase, user, role } = await getUserAndRole(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "professor" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: z.infer<typeof scheduleSchema>;
  try {
    payload = scheduleSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabase
    .from("requests")
    .select("id, status, professor_id, family_id, subject")
    .eq("id", payload.requestId)
    .single();

  if (currentError || !current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (current.status !== "coords_sent" && current.status !== "approved") {
    return NextResponse.json({ error: "coords_required" }, { status: 409 });
  }

  await logAudit({
    actorId: user.id,
    action: "request_schedule_set",
    entity: "request",
    entityId: current.id,
    payload: {
      professorId: current.professor_id,
      familyId: current.family_id,
      subject: current.subject,
      weeklySessions: payload.weeklySessions,
      sessionHours: payload.sessionHours,
    },
  });

  try {
    await upsertPlannedSessions(
      payload.requestId,
      payload.weeklySchedule,
      payload.sessionHours,
      supabase,
    );
  } catch (e) {
    console.error("[planned_sessions] upsert failed:", e);
    return NextResponse.json({ error: "schedule_save_failed" }, { status: 500 });
  }

  return NextResponse.json({ data: { id: current.id } });
}
