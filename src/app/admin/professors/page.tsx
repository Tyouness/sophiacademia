import UserListTable from "@/components/UserListTable";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminProfessorsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, username, full_name, email, role, phone, addr1, addr2, postcode, city, country, lat, lng, disabled_at, deleted_at, created_at",
    )
    .eq("role", "professor")
    .order("full_name", { ascending: true });

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-gray-900">Gestion profs</h2>
        <p className="mt-1 text-sm text-gray-500">Administration des comptes professeurs.</p>
      </div>
      <UserListTable mode="admin" users={profiles ?? []} />
    </main>
  );
}
