import { createAdminSupabaseClient } from "@/lib/supabase/server";

function randomDigits() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

export async function generateUsername(lastName: string) {
  const base = lastName.trim().charAt(0).toLowerCase() || "u";
  const supabaseAdmin = createAdminSupabaseClient();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${base}.${randomDigits()}`;
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", candidate)
      .maybeSingle();

    if (!data) {
      return candidate;
    }
  }

  return `${base}.${randomDigits()}`;
}
