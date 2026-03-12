import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { assertApprovedRequest } from "@/lib/requests";
import { assertChildBelongsToFamily } from "@/lib/children";
import { getMonthRange } from "@/lib/billing/period";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { autoApprovePendingCourses } from "@/lib/courses/auto-approve";
import { sendEmail } from "@/lib/notifications/email";

const courseSchema = z.object({
  familyId: z.string().uuid(),
  hours: z.number().positive(),
  coursesCount: z.number().int().positive(),
  subject: z.string().trim().max(120).optional(),
  // courseDate is REQUIRED for all new declarations.
  // Rule: course_date = date of the first (representative) session of the batch.
  // When courses_count = 1 (enforced by the UI), it is the exact session date.
  // When courses_count > 1 (legacy or API), it represents the starting session
  // of the declared period. It is NOT auto-calculated from courses_count.
  // Older rows without course_date use created_at as a display fallback.
  courseDate: z.string().datetime(),
  childId: z.string().uuid().optional(),
});

const querySchema = z.object({
  status: z.enum(["pending", "paid", "advance", "paid_by_urssaf"]).optional(),
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
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;

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
    .select("id, child_id")
    .eq("professor_id", user.id)
    .eq("family_id", payload.familyId)
    .eq("status", "approved")
    .limit(1);

  if (payload.subject) {
    reqQuery = reqQuery.eq("subject", payload.subject);
  }

  if (payload.childId) {
    reqQuery = reqQuery.eq("child_id", payload.childId);
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

  const supabaseAdmin = createAdminSupabaseClient();

  // If childId was provided explicitly, verify it belongs to the target family.
  // (When child_id is inherited from the request it was already validated at request creation.)
  if (payload.childId) {
    try {
      await assertChildBelongsToFamily(payload.childId, payload.familyId, supabaseAdmin);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "child_error";
      return NextResponse.json({ error: msg }, { status: 409 });
    }
  }
  const now = new Date();
  const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const { data: profDetails } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const { data: familyProfile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", payload.familyId)
    .single();


  const { data, error } = await supabase
    .from("courses")
    .insert({
      professor_id: user.id,
      family_id: payload.familyId,
      hours: payload.hours,
      courses_count: payload.coursesCount,
      subject: payload.subject ?? null,
      course_date: payload.courseDate,
      child_id: payload.childId ?? (approvedRequests?.[0] as { child_id?: string | null } | undefined)?.child_id ?? null,
      status: "pending",
      approval_status: "family_pending",
      family_response_deadline: deadline,
      distance_km: null,
      prof_hourly: null,
      prof_total: null,
      prof_net: null,
      indemn_km: null,
    })
    .select("id, professor_id, family_id, subject, status, approval_status")
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
      approvalStatus: data.approval_status,
      hours: payload.hours,
      coursesCount: payload.coursesCount,
      distanceKm: null,
      profHourly: null,
      profTotal: null,
    },
  });

  if (familyProfile?.email) {
    const familyName = familyProfile.full_name ?? "Famille";
    const professorName = profDetails?.full_name ?? profDetails?.email ?? "Professeur";
    const subjectLabel = payload.subject ? `Matiere: ${payload.subject}` : "";
    const text =
      `Bonjour ${familyName},\n\n` +
      `${professorName} a declare un cours de ${payload.hours}h.` +
      (subjectLabel ? ` ${subjectLabel}.` : ".") +
      "\n\n" +
      "Merci de confirmer sous 48h via votre espace famille.";
    try {
      await sendEmail(
        {
          to: familyProfile.email,
          subject: "Cours declare - confirmation sous 48h",
          text,
        },
        accessToken,
      );
    } catch (error) {
      console.warn("[course] email send failed", error);
    }
  }

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

  try {
    await autoApprovePendingCourses();
  } catch (error) {
    console.warn("[courses] auto-approve failed", error);
  }

  const url = new URL(request.url);
  const query = querySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    period: url.searchParams.get("period") ?? undefined,
  });

  if (!query.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const supabaseAdmin = createAdminSupabaseClient();
  let builder = supabaseAdmin
    .from("courses")
    .select(
      "id, family_id, professor_id, subject, status, approval_status, hours, courses_count, course_date, paid_at, created_at, family_response_deadline, family_confirmed_at, family_update_requested_at, family_update_note, staff_canceled_at, staff_canceled_by, distance_km, distance_km_one_way, distance_km_round_trip, ik_amount, distance_source, prof_hourly, prof_total, prof_net, indemn_km, child_id, family:profiles!courses_family_id_fkey(full_name, addr1, addr2, postcode, city, country, lat, lng), child:family_children(first_name, last_name)",
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
