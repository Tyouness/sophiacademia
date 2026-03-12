import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getClientIp, rateLimitSensitive } from "@/lib/security/rate-limit";
import { logAudit } from "@/lib/audit";

const inputSchema = z.object({
  userId: z.string().uuid(),
  disabled: z.enum(["true", "false"]),
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
  const rate = await rateLimitSensitive(`staff:disable:${ip}:${user.id}`);
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
  const disabledAt = payload.disabled === "true" ? new Date().toISOString() : null;

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ disabled_at: disabledAt })
    .eq("id", payload.userId)
    .in("role", ["family", "professor"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    actorId: user.id,
    action: payload.disabled === "true" ? "user_disabled" : "user_enabled",
    targetUserId: payload.userId,
  });

  const referer = request.headers.get("referer");
  if (referer) {
    return NextResponse.redirect(referer, { status: 303 });
  }

  return NextResponse.json({ success: true });
}
