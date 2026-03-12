import UserListTable from "@/components/UserListTable";
import UserInviteForm from "@/components/UserInviteForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function StaffUsersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, role, phone, username, addr1, addr2, postcode, city, country, lat, lng, created_at, disabled_at, deleted_at",
    )
    .in("role", ["family", "professor"])
    .order("full_name", { ascending: true });

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-gray-900">Utilisateurs</h2>
        <p className="mt-1 text-sm text-gray-500">
          Creation et suivi des familles et professeurs.
        </p>
      </div>

      <UserInviteForm
        actionUrl="/api/staff/users/create"
        allowedRoles={["family", "professor"]}
        title="Nouvelle invitation"
        description="Creation des familles et professeurs depuis un compte staff."
      />

      <UserListTable mode="staff" users={profiles ?? []} />
    </main>
  );
}
