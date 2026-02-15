import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMonthRange } from "@/lib/billing/period";

type ProfileRole = "admin" | "staff" | "family" | "professor";

const querySchema = z.object({
  status: z.enum(["pending", "paid", "advance"]).optional(),
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
