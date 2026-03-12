import StatCard from "@/components/StatCard";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function StaffPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  // ── Alertes URSSAF ─────────────────────────────────────────────
  // Familles avec une erreur URSSAF active (last_error non vide)
  const { count: urssafErrorCount } = await supabase
    .from("urssaf_clients")
    .select("id", { count: "exact", head: true })
    .not("last_error", "is", null);

  // Familles dont le dossier employeur n'est pas encore au statut urssaf_ready
  // (employer_readiness est calculé côté app, mais on compte les familles sans customer_id
  //  comme indicateur proxy de non-inscription URSSAF)
  const { count: urssafUnregisteredCount } = await supabase
    .from("urssaf_clients")
    .select("id", { count: "exact", head: true })
    .is("urssaf_customer_id", null);

  // ── Paie mensuelle ─────────────────────────────────────────────
  // Runs récents avec statut dégradé (partial ou failed)
  const { data: recentRuns } = await supabase
    .from("payroll_runs")
    .select("id, period, status, started_at, errors_count")
    .in("status", ["partial", "failed"])
    .order("started_at", { ascending: false })
    .limit(5);

  const degradedRunCount = recentRuns?.length ?? 0;

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-gray-900">
          Operations staff
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Gestion quotidienne des demandes et heures declarees.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Demandes" value="-" helper="Validation rapide" />
        <StatCard label="Heures" value="-" helper="Suivi des statuts" />
        <StatCard label="Utilisateurs" value="-" helper="Familles et profs" />
      </div>

      {/* ── Section alertes opérationnelles ───────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">
          Alertes URSSAF &amp; Paie
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Erreurs URSSAF actives"
            value={urssafErrorCount ?? 0}
            helper="Familles avec last_error non vide"
          />
          <StatCard
            label="Familles non enregistrées"
            value={urssafUnregisteredCount ?? 0}
            helper="Sans identifiant URSSAF"
          />
          <StatCard
            label="Runs dégradés (30 j)"
            value={degradedRunCount}
            helper="Statut partial ou failed"
          />
        </div>

        {recentRuns && recentRuns.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-gray-400">
              Derniers runs dégradés
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Période</th>
                  <th className="pb-2 pr-4 font-medium">Statut</th>
                  <th className="pb-2 pr-4 font-medium">Erreurs</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono">{run.period}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          run.status === "failed"
                            ? "rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                            : "rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                        }
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {run.errors_count ?? 0}
                    </td>
                    <td className="py-2 text-gray-500">
                      {new Date(run.started_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

