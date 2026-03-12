require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
const adminName = process.env.BOOTSTRAP_ADMIN_NAME ?? "";
const adminPhone = process.env.BOOTSTRAP_ADMIN_PHONE ?? "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL.",
  );
  process.exit(1);
}

if (!adminEmail) {
  console.error("Missing BOOTSTRAP_ADMIN_EMAIL.");
  process.exit(1);
}

if (!adminEmails.includes(adminEmail)) {
  console.error("BOOTSTRAP_ADMIN_EMAIL must be included in ADMIN_EMAILS.");
  process.exit(1);
}

if (!siteUrl) {
  console.error("Missing NEXT_PUBLIC_SITE_URL.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const redirectTo = `${siteUrl.replace(/\/$/, "")}/auth/callback?next=/auth/set-password`;

async function main() {
  const { data: invite, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(adminEmail, {
      redirectTo,
      data: {
        full_name: adminName,
        phone: adminPhone,
      },
    });

  if (inviteError || !invite?.user) {
    console.error(inviteError?.message ?? "Invite failed");
    process.exit(1);
  }

  const { error: roleError } = await supabase.rpc("set_role_by_admin_emails", {
    target_user_id: invite.user.id,
    target_email: adminEmail,
    admin_emails: adminEmails,
  });

  if (roleError) {
    console.error(roleError.message);
    process.exit(1);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: invite.user.id,
        role: "admin",
        full_name: adminName,
        phone: adminPhone || null,
        disabled_at: null,
        deleted_at: null,
        deleted_by: null,
      },
      { onConflict: "id" },
    );

  if (profileError) {
    console.error(profileError.message);
    process.exit(1);
  }

  console.log("Admin invite sent to", adminEmail);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
