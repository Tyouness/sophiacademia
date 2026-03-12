import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

const childCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  level: z.string().trim().max(60).optional(),
  subjects: z.array(z.string().trim().max(60)).max(20).optional(),
});

const childUpdateSchema = z.object({
  childId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  level: z.string().trim().max(60).optional(),
  subjects: z.array(z.string().trim().max(60)).max(20).optional(),
});

async function getAuthenticatedFamily(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, disabled_at, deleted_at")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    profile.disabled_at ||
    profile.deleted_at ||
    (profile.role !== "family" && profile.role !== "admin" && profile.role !== "staff")
  ) {
    return { supabase, user: null };
  }

  return { supabase, user, role: profile.role };
}

// GET /api/family/children — list children for the authenticated family
export async function GET(request: Request) {
  const { supabase, user } = await getAuthenticatedFamily(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("family_children")
    .select("id, family_id, first_name, last_name, level, subjects, created_at")
    .eq("family_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

// POST /api/family/children — create a new child
export async function POST(request: Request) {
  const { supabase, user } = await getAuthenticatedFamily(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof childCreateSchema>;
  try {
    payload = childCreateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("family_children")
    .insert({
      family_id: user.id,
      first_name: payload.firstName,
      last_name: payload.lastName,
      level: payload.level ?? null,
      subjects: payload.subjects ?? [],
    })
    .select("id, family_id, first_name, last_name, level, subjects, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }

  await logAudit({
    actorId: user.id,
    action: "child_created",
    entity: "family_children",
    entityId: data.id,
    payload: {
      familyId: user.id,
      firstName: data.first_name,
      lastName: data.last_name,
      level: data.level,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
}

// PATCH /api/family/children — update an existing child
export async function PATCH(request: Request) {
  const { supabase, user } = await getAuthenticatedFamily(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof childUpdateSchema>;
  try {
    payload = childUpdateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Verify ownership: only the family owning this child can update it
  const supabaseAdmin = createAdminSupabaseClient();
  const { data: existing } = await supabaseAdmin
    .from("family_children")
    .select("id, family_id")
    .eq("id", payload.childId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.family_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (payload.firstName !== undefined) {
    updates.first_name = payload.firstName;
  }
  if (payload.lastName !== undefined) {
    updates.last_name = payload.lastName;
  }
  if (payload.level !== undefined) {
    updates.level = payload.level;
  }
  if (payload.subjects !== undefined) {
    updates.subjects = payload.subjects;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("family_children")
    .update(updates)
    .eq("id", payload.childId)
    .select("id, family_id, first_name, last_name, level, subjects, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  await logAudit({
    actorId: user.id,
    action: "child_updated",
    entity: "family_children",
    entityId: data.id,
    payload: { updates },
  });

  return NextResponse.json({ data });
}
