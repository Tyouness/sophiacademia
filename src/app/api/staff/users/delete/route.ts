import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getClientIp, rateLimitSensitive } from "@/lib/security/rate-limit";
import { logAudit } from "@/lib/audit";

const inputSchema = z.object({
  userId: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient({ canSetCookies: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "staff" && profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rate = await rateLimitSensitive(`staff:delete:${ip}:${user.id}`);
  if (!rate.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let payload: z.infer<typeof inputSchema>;
  try {
    payload = inputSchema.parse(Object.fromEntries(await request.formData()));
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabaseAdmin = createAdminSupabaseClient();

  const { data: targetProfile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", payload.userId)
    .single();

  if (targetProfile?.role !== "family" && targetProfile?.role !== "professor") {
    return NextResponse.json({ error: "Forbidden role" }, { status: 403 });
  }

  const cleanupErrors: string[] = [];
  const cleanupResults = await Promise.all([
    supabaseAdmin.from("audit_logs").delete().or(`actor_id.eq.${payload.userId},target_user_id.eq.${payload.userId}`),
    supabaseAdmin.from("requests").delete().or(`professor_id.eq.${payload.userId},family_id.eq.${payload.userId}`),
    supabaseAdmin.from("courses").delete().or(`professor_id.eq.${payload.userId},family_id.eq.${payload.userId}`),
    supabaseAdmin.from("invoices").delete().eq("family_id", payload.userId),
    supabaseAdmin.from("payslips").delete().or(`professor_id.eq.${payload.userId},family_id.eq.${payload.userId}`),
    supabaseAdmin.from("family_children").delete().eq("family_id", payload.userId),
    supabaseAdmin.from("family_profiles").delete().eq("id", payload.userId),
    supabaseAdmin.from("professor_profiles").delete().eq("id", payload.userId),
    supabaseAdmin.from("profiles").delete().eq("id", payload.userId),
  ]);

  cleanupResults.forEach((result) => {
    if (result.error) {
      cleanupErrors.push(result.error.message);
    }
  });

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(payload.userId);
  if (authError) {
    cleanupErrors.push(authError.message);
  }

  if (cleanupErrors.length > 0) {
    return NextResponse.json({ error: cleanupErrors.join(" | ") }, { status: 500 });
  }

  await logAudit({
    actorId: user.id,
    action: "user_deleted_hard",
    targetUserId: payload.userId,
  });

  const referer = request.headers.get("referer");
  if (referer) {
    return NextResponse.redirect(referer, { status: 303 });
  }

  return NextResponse.json({ success: true });
}
