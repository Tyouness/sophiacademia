import StatCard from "@/components/StatCard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMonthKey, getMonthRange } from "@/lib/billing/period";

export default async function ProfessorPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  const monthKey = getMonthKey(new Date());
  const { start, end } = getMonthRange(monthKey);

  const [approvedRequests, monthlyCourses, payslips] = await Promise.all([
    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("professor_id", user?.id ?? "")
      .eq("status", "approved"),
    supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .eq("professor_id", user?.id ?? "")
      .gte("created_at", start)
      .lt("created_at", end),
    supabase
      .from("payslips")
      .select("id", { count: "exact", head: true })
      .eq("professor_id", user?.id ?? "")
      .eq("period", monthKey),
  ]);

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-gray-900">Espace professeur</h2>
        <p className="mt-1 text-sm text-gray-500">
          Tableau de bord en cours de configuration.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Cours actifs"
          value={approvedRequests.count ?? 0}
          helper="Demandes approuvees"
        />
        <StatCard
          label="Cours du mois"
          value={monthlyCourses.count ?? 0}
          helper="Declarations en cours"
        />
        <StatCard
          label="Paiements"
          value={payslips.count ?? 0}
          helper="Bulletins du mois"
        />
      </div>

      <div className="rounded-xl bg-white p-6 shadow-md">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
          Compte connecte
        </p>
        <p className="mt-3 text-sm text-gray-700">{user?.email}</p>
        <p className="mt-2 text-xs text-gray-500">
          Role: {profile?.role ?? "inconnu"}
        </p>
      </div>
    </main>
  );
}
