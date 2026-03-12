import { NextResponse } from "next/server";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";
import { createUserSchema } from "@/lib/security/validation";
import { sanitizeText } from "@/lib/security/sanitize";
import { getClientIp, rateLimitSensitive } from "@/lib/security/rate-limit";
import { logAudit } from "@/lib/audit";
import { generateUsername } from "@/lib/auth/username";
import { buildAddressHash, buildAddressLine, geocodeAddress } from "@/lib/geo/google";
import { z } from "zod";

const childSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120).optional().or(z.literal("")),
  level: z.string().trim().min(1).max(120),
  subjects: z.array(z.string().trim().min(1)).min(1),
});

const familyInviteSchema = z.object({
  children: z.array(childSchema).min(1),
  freq: z.string().trim().optional(),
  periods: z.array(z.string().trim().min(1)).optional(),
  duration: z.number().min(0.5).max(8).optional(),
});

const professorInviteSchema = z
  .object({
    subjects: z.array(z.string().trim().min(1)).min(1),
    maxLevel: z.string().trim().min(1).max(120),
    professionType: z.enum(["student", "employee", "other"]),
    professionTitle: z.string().trim().min(1).max(160),
    schoolName: z.string().trim().max(200).optional().or(z.literal("")),
    employerName: z.string().trim().max(200).optional().or(z.literal("")),
    jobTitle: z.string().trim().max(200).optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (value.professionType === "student" && !value.schoolName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "school_required" });
    }
    if (value.professionType === "employee") {
      if (!value.employerName) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "employer_required" });
      }
      if (!value.jobTitle) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "job_required" });
      }
    }
  });

const addressSchema = z.object({
  addr1: z.string().trim().min(1).max(200),
  addr2: z.string().trim().max(200).optional().or(z.literal("")),
  postcode: z.string().trim().min(1).max(32),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  try {
    console.info(`[${correlationId}] admin create start`);
    const supabase = await createServerSupabaseClient({ canSetCookies: true });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn(`[${correlationId}] admin create unauthorized`);
      return NextResponse.json(
        { error: "Unauthorized", correlationId },
        { status: 401 },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      console.warn(`[${correlationId}] admin create forbidden user=${user.id}`);
      return NextResponse.json(
        { error: "Forbidden", correlationId },
        { status: 403 },
      );
    }

    const ip = getClientIp(request);
    const rate = await rateLimitSensitive(`admin:create:${ip}:${user.id}`);
    if (!rate.success) {
      console.warn(`[${correlationId}] admin create rate limited user=${user.id}`);
      return NextResponse.json(
        { error: "Too many requests", correlationId },
        { status: 429 },
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    let body: Record<string, unknown> = {};
    console.info(`[${correlationId}] admin create content-type=${contentType}`);

    if (contentType.includes("application/json")) {
      body = (await request.json()) as Record<string, unknown>;
    } else {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
    }

    let payload: ReturnType<typeof createUserSchema.parse>;
    let familyPayload: z.infer<typeof familyInviteSchema> | null = null;
    let professorPayload: z.infer<typeof professorInviteSchema> | null = null;
    let addressPayload: z.infer<typeof addressSchema> | null = null;
    try {
      payload = createUserSchema.parse({
        role: body.role,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone ?? "",
        birthDate: body.birthDate ?? "",
      });
      if (payload.role === "family") {
        familyPayload = familyInviteSchema.parse(body.family ?? {});
      }
      if (payload.role === "professor") {
        professorPayload = professorInviteSchema.parse(body.professor ?? {});
      }
      if (
        (payload.role === "family" || payload.role === "professor") &&
        body.address &&
        typeof body.address === "object"
      ) {
        addressPayload = addressSchema.parse(body.address);
      }
    } catch {
      console.warn(`[${correlationId}] admin create invalid payload`);
      return NextResponse.json(
        { error: "Invalid payload", correlationId },
        { status: 400 },
      );
    }

    console.info(
      `[${correlationId}] admin create payload email=${payload.email} role=${payload.role}`,
    );

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[${correlationId}] missing SUPABASE_SERVICE_ROLE_KEY`);
      return NextResponse.json(
        { error: "server_misconfigured", correlationId },
        { status: 500 },
      );
    }

    const fullName = sanitizeText(
      `${payload.firstName} ${payload.lastName}`.trim(),
    );
    const phone = payload.phone ? sanitizeText(payload.phone) : null;
    const username = await generateUsername(payload.lastName);

    const address = addressPayload
      ? {
          addr1: sanitizeText(addressPayload.addr1),
          addr2: addressPayload.addr2 ? sanitizeText(addressPayload.addr2) : "",
          postcode: sanitizeText(addressPayload.postcode),
          city: sanitizeText(addressPayload.city),
          country: sanitizeText(addressPayload.country),
        }
      : null;
    const addressLine = address ? buildAddressLine(address) : null;
    const addressHash = addressLine ? buildAddressHash(addressLine) : null;
    let lat: number | null = null;
    let lng: number | null = null;
    let geocodedAt: string | null = null;
    if (addressLine) {
      try {
        const geocoded = await geocodeAddress(addressLine);
        lat = geocoded.location.lat;
        lng = geocoded.location.lng;
        geocodedAt = new Date().toISOString();
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown";
        console.warn(`[${correlationId}] geocode failed: ${message}`);
      }
    }

    const supabaseAdmin = createAdminSupabaseClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      console.error(`[${correlationId}] missing NEXT_PUBLIC_SITE_URL`);
      return NextResponse.json(
        { error: "server_misconfigured", correlationId },
        { status: 500 },
      );
    }
    const redirectTo = `${siteUrl.replace(/\/$/, "")}/auth/callback?next=/auth/set-password`;
    console.info(`[${correlationId}] inviteUserByEmail start`);

    const { data: invite, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(payload.email, {
        redirectTo,
        data: {
          full_name: fullName,
          phone,
          first_name: payload.firstName,
          last_name: payload.lastName,
          username,
        },
      });

    if (inviteError || !invite?.user) {
      const message = inviteError?.message ?? "Invite failed";
      const lower = message.toLowerCase();
      const status = (inviteError as { status?: number } | null)?.status;

      if (lower.includes("rate limit")) {
        console.warn(`[${correlationId}] invite rate limited status=${status ?? "n/a"}`);
        return NextResponse.json(
          { error: "email_rate_limited", correlationId },
          { status: 429 },
        );
      }

      if (
        lower.includes("already") ||
        lower.includes("exists") ||
        lower.includes("registered")
      ) {
        console.warn(`[${correlationId}] invite already exists status=${status ?? "n/a"}`);
        return NextResponse.json(
          { error: "already_exists", correlationId },
          { status: 409 },
        );
      }

      console.error(
        `[${correlationId}] inviteUserByEmail failed: ${message} status=${status ?? "n/a"}`,
      );
      return NextResponse.json(
        { error: "internal_error", correlationId },
        { status: 500 },
      );
    }

    console.info(`[${correlationId}] inviteUserByEmail success user=${invite.user.id}`);

    const { error: upsertError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: invite.user.id,
          role: payload.role,
          full_name: fullName,
          email: payload.email,
          birth_date: payload.birthDate || null,
          username,
          phone,
          addr1: address?.addr1 ?? null,
          addr2: address?.addr2 ?? null,
          postcode: address?.postcode ?? null,
          city: address?.city ?? null,
          country: address?.country ?? null,
          lat,
          lng,
          address_hash: addressHash,
          geocoded_at: geocodedAt,
          disabled_at: null,
          deleted_at: null,
          deleted_by: null,
        },
        { onConflict: "id" },
      );

    if (upsertError) {
      console.error(
        `[${correlationId}] profiles upsert failed: ${upsertError.message}`,
      );
      return NextResponse.json(
        { error: "internal_error", correlationId },
        { status: 500 },
      );
    }

    console.info(`[${correlationId}] profiles upsert success user=${invite.user.id}`);

    if (payload.role === "family" && familyPayload) {
      const now = new Date().toISOString();
      const childRows = familyPayload.children.map((child) => {
        const first = sanitizeText(child.firstName);
        const last = child.lastName ? sanitizeText(child.lastName) : "";
        const subjects = child.subjects.map((subject) => sanitizeText(subject));
        return {
          family_id: invite.user.id,
          first_name: first,
          last_name: last,
          level: sanitizeText(child.level),
          subjects,
          created_at: now,
        };
      });

      const uniqueSubjects = Array.from(
        new Set(childRows.flatMap((child) => child.subjects)),
      );
      const primaryLevel = childRows[0]?.level ?? null;

      const repFirst = sanitizeText(payload.firstName);
      const repLast = sanitizeText(payload.lastName);
      const { error: familyError } = await supabaseAdmin
        .from("family_profiles")
        .upsert(
          {
            id: invite.user.id,
            rep_first: repFirst,
            rep_last: repLast,
            rep_phone: phone,
            level: primaryLevel,
            subjects: uniqueSubjects,
            freq: familyPayload.freq ?? null,
            duration: familyPayload.duration ?? null,
            periods: familyPayload.periods ?? null,
            addr1: address?.addr1 ?? null,
            addr2: address?.addr2 ?? null,
            postcode: address?.postcode ?? null,
            city: address?.city ?? null,
            country: address?.country ?? null,
            address: address?.addr1 ?? null,
            lat,
            lng,
            address_hash: addressHash,
            geocoded_at: geocodedAt,
            updated_at: now,
          },
          { onConflict: "id" },
        );

      if (familyError) {
        console.error(
          `[${correlationId}] family_profiles upsert failed: ${familyError.message}`,
        );
        return NextResponse.json(
          { error: "internal_error", correlationId },
          { status: 500 },
        );
      }

      if (childRows.length > 0) {
        const { error: childrenError } = await supabaseAdmin
          .from("family_children")
          .insert(childRows);
        if (childrenError) {
          console.error(
            `[${correlationId}] family_children insert failed: ${childrenError.message}`,
          );
          return NextResponse.json(
            { error: "internal_error", correlationId },
            { status: 500 },
          );
        }
      }

    }

    if (payload.role === "professor" && professorPayload) {
      const now = new Date().toISOString();
      const skills = professorPayload.subjects.map((subject) => ({
        subject: sanitizeText(subject),
        max_level: sanitizeText(professorPayload.maxLevel),
      }));

      const { error: professorError } = await supabaseAdmin
        .from("professor_profiles")
        .upsert(
          {
            id: invite.user.id,
            skills,
            profession_type: professorPayload.professionType,
            profession_title: sanitizeText(professorPayload.professionTitle),
            school_name: professorPayload.schoolName
              ? sanitizeText(professorPayload.schoolName)
              : null,
            employer_name: professorPayload.employerName
              ? sanitizeText(professorPayload.employerName)
              : null,
            job_title: professorPayload.jobTitle
              ? sanitizeText(professorPayload.jobTitle)
              : null,
            addr1: address?.addr1 ?? null,
            addr2: address?.addr2 ?? null,
            postcode: address?.postcode ?? null,
            city: address?.city ?? null,
            country: address?.country ?? null,
            address: address?.addr1 ?? null,
            lat,
            lng,
            address_hash: addressHash,
            geocoded_at: geocodedAt,
            birth_date: payload.birthDate || null,
            employment_status: professorPayload.professionType,
            updated_at: now,
          },
          { onConflict: "id" },
        );

      if (professorError) {
        console.error(
          `[${correlationId}] professor_profiles upsert failed: ${professorError.message}`,
        );
        return NextResponse.json(
          { error: "internal_error", correlationId },
          { status: 500 },
        );
      }
    }

    await logAudit({
      actorId: user.id,
      action: "user_invited",
      targetUserId: invite.user.id,
      roleSet: payload.role,
      metadata: {
        role: payload.role,
        email: payload.email,
        full_name: fullName,
        phone,
        username,
      },
    });

    console.info(`[${correlationId}] admin create complete user=${invite.user.id}`);

    return NextResponse.json({ success: true, userId: invite.user.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error(`[${correlationId}] admin create failed: ${message}`);
    return NextResponse.json(
      { error: "internal_error", correlationId },
      { status: 500 },
    );
  }
}
