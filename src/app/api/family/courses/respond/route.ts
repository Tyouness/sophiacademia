import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/notifications/email";
import { ensureCoursePricingSnapshot } from "@/lib/payroll/course-approval";

const payloadSchema = z.object({
  courseId: z.string().uuid(),
  action: z.enum(["accept", "request_change"]),
  note: z.string().trim().max(2000).optional(),
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

  if (role !== "family") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabase
    .from("courses")
    .select("id, family_id, approval_status")
    .eq("id", payload.courseId)
    .single();

  if (currentError || !current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (current.family_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (current.approval_status !== "family_pending") {
    return NextResponse.json({ error: "already_processed" }, { status: 409 });
  }

  const now = new Date().toISOString();
  if (payload.action === "accept") {
    try {
      await ensureCoursePricingSnapshot({ courseId: payload.courseId });
    } catch (error) {
      console.warn("[course] pricing snapshot failed", error);
      return NextResponse.json({ error: "distance_required" }, { status: 409 });
    }
  }

  const update =
    payload.action === "accept"
      ? {
          approval_status: "family_confirmed",
          family_confirmed_at: now,
          updated_at: now,
        }
      : {
          approval_status: "family_update_requested",
          family_update_requested_at: now,
          family_update_note: payload.note ?? null,
          updated_at: now,
        };

  const { data, error } = await supabase
    .from("courses")
    .update(update)
    .eq("id", payload.courseId)
    .select("id, professor_id, family_id, subject, approval_status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  await logAudit({
    actorId: user.id,
    action:
      payload.action === "accept"
        ? "course_family_confirmed"
        : "course_family_update_requested",
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

  if (payload.action === "request_change") {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

    if (adminEmails.length > 0) {
      try {
        await sendEmail(
          {
            to: adminEmails,
            subject: "Demande de modification d'un cours",
            text:
              "Une famille a demande une modification sur un cours declare. " +
              `Cours: ${data.id}. Note: ${payload.note ?? "-"}.`,
          },
          accessToken,
        );
      } catch (error) {
        console.warn("[course] admin email failed", error);
      }
    }
  }

  return NextResponse.json({ data });
}
