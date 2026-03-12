import { getRecentPayrollRuns } from "@/lib/payroll/runMonthly";
import RunPayrollPanel from "./RunPayrollPanel";
import { runPreliveChecks } from "@/lib/prelive/runner";
import Link from "next/link";

export default async function AdminPayrollPage() {
  const [recentRuns, preliveSummary] = await Promise.all([
    getRecentPayrollRuns(30),
    runPreliveChecks(),
  ]);

  // Soft lock : indique s'il y a des blocages critiques connus avant le run
  const hasBlockingIssues = preliveSummary.globalStatus === "blocked";
  const statusBadgeClass = (status: string) => {
    const map: Record<string, string> = {
      success: "bg-emerald-100 text-emerald-800",
      partial: "bg-amber-100 text-amber-800",
      failed: "bg-rose-100 text-rose-800",
      running: "bg-blue-100 text-blue-800",
    };
    return map[status] ?? "bg-gray-100 text-gray-800";
  };

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-gray-900">Paie mensuelle</h2>
        <p className="mt-1 text-sm text-gray-500">
          Déclenchement et suivi des runs de génération des bulletins et documents famille.
        </p>
      </div>

      {/* Warning pré-live si blocages critiques */}
      {hasBlockingIssues && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <span className="text-lg font-bold text-red-600">✗</span>
            <div>
              <p className="font-semibold text-red-800">
                Blocages critiques détectés — lancer un run dans cet état est risqué
              </p>
              <p className="mt-1 text-sm text-red-700">
                {preliveSummary.criteria
                  .filter((c) => c.blocking && c.status === "blocked")
                  .map((c) => c.detail)
                  .filter(Boolean)
                  .join(" • ")}
              </p>
              <p className="mt-2">
                <Link
                  href="/admin/prelive"
                  className="text-sm font-semibold text-red-800 underline underline-offset-2 hover:text-red-900"
                >
                  Voir la checklist pré-live →
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Run form */}
      <RunPayrollPanel blocked={hasBlockingIssues} />

      {/* Run history */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          Historique des runs ({recentRuns.length})
        </h3>

        {recentRuns.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun run enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-widest text-gray-400">
                  <th className="pb-2 pr-4">Période</th>
                  <th className="pb-2 pr-4">Statut</th>
                  <th className="pb-2 pr-4">Profs</th>
                  <th className="pb-2 pr-4">Bulletins</th>
                  <th className="pb-2 pr-4">Docs famille</th>
                  <th className="pb-2 pr-4">Erreurs</th>
                  <th className="pb-2 pr-4">Démarré le</th>
                  <th className="pb-2">Durée</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => {
                  const started = new Date(run.started_at);
                  const finished = run.finished_at
                    ? new Date(run.finished_at)
                    : null;
                  const durationMs = finished
                    ? finished.getTime() - started.getTime()
                    : null;

                  return (
                    <tr
                      key={run.id}
                      className="border-b border-slate-50 align-top"
                    >
                      <td className="py-2 pr-4 font-medium">{run.period}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(run.status)}`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{run.professors_processed}</td>
                      <td className="py-2 pr-4">{run.payslips_created}</td>
                      <td className="py-2 pr-4">
                        {run.family_docs_created > 0 || run.family_docs_failed > 0 ? (
                          <span>
                            {run.family_docs_created} ok
                            {run.family_docs_failed > 0 && (
                              <span className="ml-1 text-rose-600">
                                / {run.family_docs_failed} KO
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {run.errors_count > 0 ? (
                          <span className="font-semibold text-rose-600">
                            {run.errors_count}
                          </span>
                        ) : (
                          <span className="text-emerald-600">0</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-xs text-gray-500">
                        {started.toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2 text-xs text-gray-500">
                        {durationMs != null ? `${durationMs}ms` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
