import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMonthRange } from "@/lib/billing/period";
import { autoApprovePendingCourses } from "@/lib/courses/auto-approve";

type ProfileRole = "admin" | "staff" | "family" | "professor";

const querySchema = z.object({
  status: z.enum(["pending", "paid", "advance", "paid_by_urssaf"]).optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

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

export async function GET(request: Request) {
  const { supabase, user, role } = await getUserAndRole(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "family" && role !== "admin" && role !== "staff") {
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

  let builder = supabase
    .from("courses")
    .select(
      "id, family_id, professor_id, subject, status, approval_status, hours, courses_count, course_date, paid_at, created_at, family_response_deadline, family_confirmed_at, family_update_requested_at, family_update_note, staff_canceled_at, distance_km, distance_km_one_way, distance_km_round_trip, ik_amount, distance_source, prof_hourly, prof_total, prof_net, indemn_km, child_id, child:family_children(first_name, last_name)",
    )
    .eq("family_id", user.id)
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
