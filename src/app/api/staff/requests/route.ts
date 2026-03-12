import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/notifications/email";

// ─── requests status machine ────────────────────────────────────────────────
//
// requests covers two distinct business phases in a single table:
//
//  PHASE 1 — Candidature (application)
//    pending       Professor applied for a family offer; staff has not acted yet.
//    coords_sent   Staff sent family coordinates to the professor by email.
//                  Professor must call the family to agree on a first session.
//    rejected      Staff refused the application (terminal, no courses allowed).
//
//  PHASE 2 — Active relationship (assignment)
//    approved      Staff validated the application. This is the operational gate:
//                  a request with status=approved is required before any course
//                  declaration is accepted (see assertApprovedRequest in lib/requests.ts).
//    detached      Staff ended the active relationship. ended_at and end_reason
//                  are written on this transition. Courses already declared are
//                  unaffected (courses has no FK back to requests).
//
// NOTE: 'ended' existed as a planned status for natural relationship completion
// but was never implemented. It was removed from the constraint in migration 0023.
//
// Valid transitions:
//   pending → coords_sent → approved → detached
//   pending → rejected
//   coords_sent → rejected
// ─────────────────────────────────────────────────────────────────────────────

const statusSchema = z.enum([
  "pending",
  "coords_sent",
  "approved",
  "rejected",
  "detached",
]);

const actionSchema = z.object({
  action: z.enum(["approve", "reject", "share_coords", "detach"]),
  requestId: z.string().uuid(),
  reason: z.string().trim().max(2000).optional(),
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

export async function GET(request: Request) {
  const { supabase, user, role } = await getUserAndRole(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "staff" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam ? statusSchema.safeParse(statusParam) : null;

  let query = supabase
    .from("requests")
    .select(
      "id, professor_id, family_id, subject, status, rejected_at, ended_at, end_reason, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (status?.success) {
    query = query.eq("status", status.data);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
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

  const { data: current, error: currentError } = await supabase
    .from("requests")
    .select("status")
    .eq("id", payload.requestId)
    .single();

  if (currentError || !current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (payload.action === "share_coords" && current.status !== "pending") {
    return NextResponse.json(
      { error: "already_processed" },
      { status: 409 },
    );
  }

  if (payload.action === "approve" && current.status !== "coords_sent") {
    return NextResponse.json(
      { error: "coords_required" },
      { status: 409 },
    );
  }

  if (payload.action === "reject" && current.status === "approved") {
    return NextResponse.json(
      { error: "already_processed" },
      { status: 409 },
    );
  }

  if (payload.action === "detach" && current.status !== "approved") {
    return NextResponse.json(
      { error: "not_approved" },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const update =
    payload.action === "share_coords"
      ? { status: "coords_sent", updated_at: now }
      : payload.action === "approve"
        ? { status: "approved", updated_at: now }
        : payload.action === "detach"
          ? { status: "detached", ended_at: now, end_reason: payload.reason ?? null, updated_at: now }
          : {
              status: "rejected",
              rejected_at: now,
              end_reason: payload.reason ?? null,
              updated_at: now,
            };

  const { data, error } = await supabase
    .from("requests")
    .update(update)
    .eq("id", payload.requestId)
    .select("id, professor_id, family_id, subject, status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  await logAudit({
    actorId: user.id,
    action:
      payload.action === "approve"
        ? "request_approved"
        : payload.action === "share_coords"
          ? "request_coords_sent"
          : payload.action === "detach"
            ? "request_detached"
            : "request_rejected",
    entity: "request",
    entityId: data.id,
    payload: {
      professorId: data.professor_id,
      familyId: data.family_id,
      subject: data.subject,
      status: data.status,
      reason: payload.reason ?? null,
    },
  });

  if (payload.action === "share_coords") {
    const supabaseAdmin = createAdminSupabaseClient();
    const [{ data: professor }, { data: familyProfile }, { data: familyBase }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", data.professor_id)
          .single(),
        supabaseAdmin
          .from("family_profiles")
          .select("addr1, addr2, postcode, city, country, lat, lng, rep_phone")
          .eq("id", data.family_id)
          .single(),
        supabaseAdmin
          .from("profiles")
          .select("full_name, phone")
          .eq("id", data.family_id)
          .single(),
      ]);

    if (professor?.email) {
      const familyName = familyBase?.full_name ?? "Famille";
      const addressLine = [
        familyProfile?.addr1,
        familyProfile?.addr2,
        familyProfile?.postcode,
        familyProfile?.city,
        familyProfile?.country,
      ]
        .filter((part) => Boolean(part && String(part).trim()))
        .join(", ");
      const mapsLink =
        familyProfile?.lat != null && familyProfile?.lng != null
          ? `https://www.google.com/maps?q=${familyProfile.lat},${familyProfile.lng}`
          : null;
      const familyPhone = familyProfile?.rep_phone ?? familyBase?.phone ?? null;
      const subjectLabel = data.subject ?? "matiere";
      const cityLabel = familyProfile?.city ? ` a ${familyProfile.city}` : "";
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
        ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
        : null;
      const panelUrl = siteUrl ? `${siteUrl}/professor/requests` : null;

      const text =
        `Bonjour ${professor.full_name ?? ""}`.trim() +
        `\n\nVous avez accepte un cours de ${subjectLabel} pour ${familyName}${cityLabel}.` +
        `\nMerci d'appeler la famille sous 24h au ${familyPhone ?? "-"} pour fixer la date du premier cours, puis renseigner cette date dans votre espace professeur.` +
        (panelUrl ? `\n${panelUrl}` : "") +
        `\n\nCoordonnees de la famille (${familyName}):` +
        `\nAdresse: ${addressLine || "-"}` +
        `\nTelephone: ${familyPhone ?? "-"}` +
        (mapsLink ? `\nGoogle Maps: ${mapsLink}` : "");

      try {
        await sendEmail(
          {
            to: professor.email,
            subject: "Coordonnees famille - demande acceptee",
            text,
          },
          accessToken,
        );
      } catch (emailError) {
        console.warn("[requests] share coords email failed", emailError);
      }
    }
  }

  return NextResponse.json({ data });
}
