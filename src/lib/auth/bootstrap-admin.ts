import { createAdminSupabaseClient } from "@/lib/supabase/server";

function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function bootstrapAdminRole(user: {
  id: string;
  email?: string | null;
}) {
  const adminEmails = getAdminEmails();
  if (!user.email || adminEmails.length === 0) {
    return { updated: false };
  }

  const normalizedEmail = user.email.toLowerCase();
  if (!adminEmails.includes(normalizedEmail)) {
    return { updated: false };
  }

  const supabaseAdmin = createAdminSupabaseClient();
  const { error } = await supabaseAdmin.rpc("set_role_by_admin_emails", {
    target_user_id: user.id,
    target_email: user.email,
    admin_emails: adminEmails,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { updated: true };
}
