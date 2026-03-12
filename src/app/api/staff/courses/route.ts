import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { ensureCoursePricingSnapshot } from "@/lib/payroll/course-approval";
import { sendEmail } from "@/lib/notifications/email";
import { handleCoursePaid } from "@/lib/billing/course-paid";

const actionSchema = z.object({
  action: z.enum(["mark_paid", "correct", "cancel"]).optional(),
  courseId: z.string().uuid(),
  hours: z.number().positive().optional(),
  coursesCount: z.number().int().positive().optional(),
  familyId: z.string().uuid().optional(),
  subject: z.string().trim().max(120).optional(),
  note: z.string().trim().max(2000).optional(),
  distanceKmOneWay: z.number().positive().optional(),
  distanceSource: z.string().trim().max(120).optional(),
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

  if (role !== "staff" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: z.infer<typeof actionSchema>;
  try {
    payload = actionSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const action = payload.action ?? "mark_paid";

  const { data: current, error: currentError } = await supabase
    .from("courses")
    .select("id, professor_id, family_id, subject, status, approval_status, hours, courses_count, prof_total")
    .eq("id", payload.courseId)
    .single();

  if (currentError || !current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (current.approval_status === "staff_canceled") {
    return NextResponse.json({ error: "already_canceled" }, { status: 409 });
  }

  if (action === "mark_paid") {
    if (current.status !== "pending") {
      return NextResponse.json({ error: "already_paid" }, { status: 409 });
    }

    if (current.approval_status !== "family_confirmed") {
      return NextResponse.json({ error: "family_confirmation_required" }, { status: 409 });
    }

    const now = new Date().toISOString();
    try {
      await ensureCoursePricingSnapshot({
        courseId: payload.courseId,
        manualDistanceKmOneWay: payload.distanceKmOneWay ?? null,
        distanceSource: payload.distanceSource ?? (payload.distanceKmOneWay ? "manual" : null),
      });
    } catch (error) {
      console.warn("[course] pricing snapshot failed", error);
      return NextResponse.json({ error: "distance_required" }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("courses")
      .update({ status: "paid", paid_at: now, updated_at: now })
      .eq("id", payload.courseId)
      .select("id, professor_id, family_id, subject, status")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    await logAudit({
      actorId: user.id,
      action: "course_paid",
      entity: "course",
      entityId: data.id,
      payload: {
        professorId: data.professor_id,
        familyId: data.family_id,
        subject: data.subject,
        status: data.status,
      },
    });

    await handleCoursePaid(
      {
        id: data.id,
        professor_id: data.professor_id,
        family_id: data.family_id,
        paid_at: now,
      },
      user.id,
    );

    return NextResponse.json({ data });
  }

  if (current.status === "paid") {
    return NextResponse.json({ error: "already_paid" }, { status: 409 });
  }

  const supabaseAdmin = createAdminSupabaseClient();
  const now = new Date();
  const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  if (action === "cancel") {
    const { data: familyContact } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", current.family_id)
      .single();

    const { data, error } = await supabaseAdmin
      .from("courses")
      .update({
        approval_status: "staff_canceled",
        staff_canceled_at: now.toISOString(),
        staff_canceled_by: user.id,
        staff_correction_note: payload.note ?? null,
        updated_at: now.toISOString(),
      })
      .eq("id", payload.courseId)
      .select("id, professor_id, family_id, subject, approval_status")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    await logAudit({
      actorId: user.id,
      action: "course_staff_canceled",
      entity: "course",
      entityId: data.id,
      payload: {
        professorId: data.professor_id,
        familyId: data.family_id,
        subject: data.subject,
        approvalStatus: data.approval_status,
        note: payload.note ?? null,
      },
    });

    if (familyContact?.email) {
      const familyName = familyContact.full_name ?? "Famille";
      const text =
        `Bonjour ${familyName},\n\n` +
        "Votre declaration de cours a ete annulee par le staff.";
      try {
        await sendEmail(
          {
            to: familyContact.email,
            subject: "Cours annule",
            text,
          },
          accessToken,
        );
      } catch (error) {
        console.warn("[course] cancel email failed", error);
      }
    }

    return NextResponse.json({ data });
  }

  const nextFamilyId = payload.familyId ?? current.family_id;
  const nextHours = payload.hours ?? current.hours;
  const nextCoursesCount = payload.coursesCount ?? current.courses_count;
  const nextSubject = payload.subject ?? current.subject;

  const { data: familyContact } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", nextFamilyId)
    .single();

  const { data, error } = await supabaseAdmin
    .from("courses")
    .update({
      family_id: nextFamilyId,
      hours: nextHours,
      courses_count: nextCoursesCount,
      subject: nextSubject ?? null,
      approval_status: "family_pending",
      family_response_deadline: deadline,
      family_confirmed_at: null,
      family_update_requested_at: null,
      family_update_note: null,
      staff_corrected_at: now.toISOString(),
      staff_corrected_by: user.id,
      staff_correction_note: payload.note ?? null,
      distance_km: null,
      distance_km_one_way: null,
      distance_km_round_trip: null,
      duration_minutes: null,
      distance_source: null,
      distance_fetched_at: null,
      ik_amount: null,
      ik_rate_version: null,
      rate_set_version: null,
      pricing_policy_version: null,
      rounding_policy_version: null,
      prof_hourly: null,
      prof_total: null,
      prof_net: null,
      indemn_km: null,
      updated_at: now.toISOString(),
    })
    .eq("id", payload.courseId)
    .select("id, professor_id, family_id, subject, approval_status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  await logAudit({
    actorId: user.id,
    action: "course_staff_corrected",
    entity: "course",
    entityId: data.id,
    payload: {
      professorId: data.professor_id,
      familyId: data.family_id,
      subject: data.subject,
      approvalStatus: data.approval_status,
      hours: nextHours,
      coursesCount: nextCoursesCount,
      note: payload.note ?? null,
    },
  });

  if (familyContact?.email) {
    const familyName = familyContact.full_name ?? "Famille";
    const text =
      `Bonjour ${familyName},\n\n` +
      "Votre declaration de cours a ete corrigee par le staff." +
      ` Nouvelle duree: ${nextHours}h.\n\n` +
      "Merci de confirmer sous 48h via votre espace famille.";
    try {
      await sendEmail(
        {
          to: familyContact.email,
          subject: "Cours corrige - confirmation requise",
          text,
        },
        accessToken,
      );
    } catch (error) {
      console.warn("[course] correction email failed", error);
    }
  }

  return NextResponse.json({ data });
}
