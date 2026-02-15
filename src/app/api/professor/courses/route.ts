import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { assertApprovedRequest } from "@/lib/requests";
import { getMonthRange } from "@/lib/billing/period";

const courseSchema = z.object({
  familyId: z.string().uuid(),
  hours: z.number().positive(),
  coursesCount: z.number().int().positive(),
  subject: z.string().trim().max(120).optional(),
});

const querySchema = z.object({
  status: z.enum(["pending", "paid", "advance"]).optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
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

  let payload: z.infer<typeof courseSchema>;
  try {
    payload = courseSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  let reqQuery = supabase
    .from("requests")
    .select("id")
    .eq("professor_id", user.id)
    .eq("family_id", payload.familyId)
    .eq("status", "approved")
    .limit(1);

  if (payload.subject) {
    reqQuery = reqQuery.eq("subject", payload.subject);
  }

  const { data: approvedRequests, error: approvedError } = await reqQuery;
  if (approvedError) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  try {
    assertApprovedRequest(Boolean(approvedRequests?.length));
  } catch {
    return NextResponse.json(
      { error: "approved_request_required" },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("courses")
    .insert({
      professor_id: user.id,
      family_id: payload.familyId,
      hours: payload.hours,
      courses_count: payload.coursesCount,
      subject: payload.subject ?? null,
      status: "pending",
    })
    .select("id, professor_id, family_id, subject, status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }

  await logAudit({
    actorId: user.id,
    action: "course_declared",
    entity: "course",
    entityId: data.id,
    payload: {
      professorId: data.professor_id,
      familyId: data.family_id,
      subject: data.subject,
      status: data.status,
      hours: payload.hours,
      coursesCount: payload.coursesCount,
    },
  });

  return NextResponse.json({ data });
}

export async function GET(request: Request) {
  const { supabase, user, role } = await getUserAndRole(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "professor" && role !== "admin" && role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = querySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    period: url.searchParams.get("period") ?? undefined,
  });

  if (!query.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  let builder = supabase
    .from("courses")
    .select(
      "id, family_id, professor_id, subject, status, hours, courses_count, paid_at, created_at",
    )
    .eq("professor_id", user.id)
    .order("created_at", { ascending: false });

  if (query.data.status) {
    builder = builder.eq("status", query.data.status);
  }

  if (query.data.period) {
    const { start, end } = getMonthRange(query.data.period);
    builder = builder.gte("created_at", start).lt("created_at", end);
  }

  const { data, error } = await builder;
  if (error) {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
