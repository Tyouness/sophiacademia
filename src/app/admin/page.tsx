import StatCard from "@/components/StatCard";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });

  const { count: activeStaff } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "staff")
    .is("disabled_at", null)
    .is("deleted_at", null);

  const adminClient = createAdminSupabaseClient();
  const { data: inviteData } = await adminClient.auth.admin.listUsers({
    perPage: 1000,
  });
  const pendingInvites = inviteData?.users
    ? inviteData.users.filter((entry) => !entry.last_sign_in_at).length
    : 0;

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-gray-900">
          Vue d'ensemble
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Synthese des comptes et activites recentes.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Utilisateurs" value={totalUsers ?? 0} />
        <StatCard label="Staff actifs" value={activeStaff ?? 0} />
        <StatCard label="Invitations en attente" value={pendingInvites} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-md">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            Compte connecte
          </p>
          <p className="mt-3 text-sm text-gray-700">{user?.email}</p>
          <p className="mt-2 text-xs text-gray-500">
            Role: {profile?.role ?? "inconnu"}
          </p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-md">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            Raccourcis
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/admin/users"
              className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
            >
              Utilisateurs
            </a>
            <a
              href="/admin/requests"
              className="rounded-full border border-blue-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-blue-600"
            >
              Demandes
            </a>
            <a
              href="/admin/audit"
              className="rounded-full border border-blue-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-blue-600"
            >
              Audit
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
