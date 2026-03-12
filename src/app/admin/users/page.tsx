import UserListTable from "@/components/UserListTable";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AdminUsersPageProps = {
  searchParams?: Promise<{ role?: string; status?: string }>;
};

const allowedRoles = new Set(["admin", "staff", "family", "professor"]);
const allowedStatuses = new Set(["active", "disabled", "deleted", "all"]);

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const supabase = await createServerSupabaseClient();
  const resolvedParams = await searchParams;
  const roleParam = resolvedParams?.role ?? "all";
  const statusParam = resolvedParams?.status ?? "active";
  const roleFilter = allowedRoles.has(roleParam) ? roleParam : "all";
  const statusFilter = allowedStatuses.has(statusParam) ? statusParam : "active";

  let query = supabase
    .from("profiles")
    .select(
      "id, username, full_name, email, role, phone, addr1, addr2, postcode, city, country, lat, lng, disabled_at, deleted_at, created_at",
    )
    .order("created_at", { ascending: false });

  if (roleFilter !== "all") {
    query = query.eq("role", roleFilter);
  }

  if (statusFilter === "active") {
    query = query.is("deleted_at", null).is("disabled_at", null);
  } else if (statusFilter === "disabled") {
    query = query.is("deleted_at", null).not("disabled_at", "is", null);
  } else if (statusFilter === "deleted") {
    query = query.not("deleted_at", "is", null);
  }

  const { data: profiles } = await query;

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Utilisateurs</h2>
            <p className="mt-1 text-sm text-gray-500">
              Gestion des roles, statuts et invitations.
            </p>
          </div>
          <a
            href="/admin/users/new"
            className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
          >
            Inviter un utilisateur
          </a>
        </div>

        <form method="get" className="mt-6 flex flex-wrap gap-3 text-sm">
          <select
            name="role"
            defaultValue={roleFilter}
            className="rounded-full border border-blue-100 bg-white px-4 py-2 text-xs"
          >
            <option value="all">Tous les roles</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="family">Famille</option>
            <option value="professor">Professeur</option>
          </select>
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-full border border-blue-100 bg-white px-4 py-2 text-xs"
          >
            <option value="active">Actifs</option>
            <option value="disabled">Desactives</option>
            <option value="deleted">Supprimes</option>
            <option value="all">Tous</option>
          </select>
          <button
            type="submit"
            className="rounded-full border border-blue-100 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-blue-600"
          >
            Filtrer
          </button>
        </form>
      </div>

      <UserListTable mode="admin" users={profiles ?? []} />
    </main>
  );
}
