import { runPreliveChecks } from "@/lib/prelive/runner";
import type { PreliveCriterion, PreliveGlobalStatus } from "@/lib/prelive/checks";
import Link from "next/link";

// ── Configuration UI ──────────────────────────────────────────────────────────

const GLOBAL_CONFIG: Record<
  PreliveGlobalStatus,
  { border: string; bg: string; icon: string; title: string; subtitle: string }
> = {
  ok: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    icon: "✓",
    title: "Système prêt",
    subtitle:
      "Tous les critères pré-live sont verts. Le système est exploitable sérieusement.",
  },
  warning: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    icon: "⚠",
    title: "Points de surveillance",
    subtitle:
      "Aucun blocage critique, mais certains points méritent attention avant montée en charge.",
  },
  blocked: {
    border: "border-red-200",
    bg: "bg-red-50",
    icon: "✗",
    title: "Système bloqué",
    subtitle:
      "Des critères critiques ne sont pas remplis. Le système ne doit pas être utilisé en conditions réelles.",
  },
};

const CRITERION_CONFIG: Record<
  "ok" | "blocked" | "warning",
  { dot: string; badge: string; badgeText: string; row: string }
> = {
  ok: {
    dot: "h-2.5 w-2.5 rounded-full bg-emerald-500",
    badge:
      "inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800",
    badgeText: "OK",
    row: "",
  },
  blocked: {
    dot: "h-2.5 w-2.5 rounded-full bg-red-500",
    badge:
      "inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800",
    badgeText: "BLOQUÉ",
    row: "bg-red-50",
  },
  warning: {
    dot: "h-2.5 w-2.5 rounded-full bg-amber-400",
    badge:
      "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800",
    badgeText: "ATTENTION",
    row: "bg-amber-50",
  },
};

// ── Composants ────────────────────────────────────────────────────────────────

function CriterionRow({ criterion }: { criterion: PreliveCriterion }) {
  const cfg = CRITERION_CONFIG[criterion.status];
  return (
    <tr className={`border-b last:border-0 ${cfg.row}`}>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <div className={`shrink-0 ${cfg.dot}`} />
          <span className="text-sm text-gray-800">{criterion.label}</span>
        </div>
      </td>
      <td className="py-3 pr-4">
        <span className={cfg.badge}>{cfg.badgeText}</span>
      </td>
      <td className="py-3 pr-4">
        <span className="text-xs text-gray-500">
          {criterion.blocking ? "Bloquant" : "Surveillance"}
        </span>
      </td>
      <td className="py-3 pr-4 text-xs text-gray-600">
        {criterion.detail ?? <span className="text-gray-400">—</span>}
      </td>
      <td className="py-3">
        {criterion.actionLink && criterion.actionLabel ? (
          <Link
            href={criterion.actionLink}
            className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
          >
            {criterion.actionLabel} →
          </Link>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PrelivePage() {
  const summary = await runPreliveChecks();
  const gcfg = GLOBAL_CONFIG[summary.globalStatus];

  const blocking = summary.criteria.filter((c) => c.blocking);
  const watching = summary.criteria.filter((c) => !c.blocking);

  return (
    <main className="space-y-6">
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Checklist pré-live
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Go / no-go interne — critères minimums avant usage réel du système URSSAF / paie.
            </p>
          </div>
          <p className="text-xs text-gray-400">
            Généré le{" "}
            {new Date(summary.generatedAt).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      {/* ── Statut global ────────────────────────────────────────────────── */}
      <div
        className={`rounded-xl border p-6 ${gcfg.border} ${gcfg.bg}`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`text-2xl font-bold ${
              summary.globalStatus === "ok"
                ? "text-emerald-700"
                : summary.globalStatus === "warning"
                  ? "text-amber-700"
                  : "text-red-700"
            }`}
          >
            {gcfg.icon}
          </span>
          <div>
            <p
              className={`font-semibold ${
                summary.globalStatus === "ok"
                  ? "text-emerald-800"
                  : summary.globalStatus === "warning"
                    ? "text-amber-800"
                    : "text-red-800"
              }`}
            >
              {gcfg.title}
            </p>
            <p
              className={`mt-0.5 text-sm ${
                summary.globalStatus === "ok"
                  ? "text-emerald-700"
                  : summary.globalStatus === "warning"
                    ? "text-amber-700"
                    : "text-red-700"
              }`}
            >
              {gcfg.subtitle}
            </p>
          </div>
        </div>

        {/* Compteurs résumés */}
        {(summary.blockingCount > 0 || summary.warningCount > 0) && (
          <div className="mt-4 flex flex-wrap gap-4 border-t border-current/10 pt-4">
            {summary.blockingCount > 0 && (
              <div className="text-sm text-red-800">
                <span className="font-semibold">{summary.blockingCount}</span>{" "}
                critère(s) bloquant(s)
              </div>
            )}
            {summary.warningCount > 0 && (
              <div className="text-sm text-amber-800">
                <span className="font-semibold">{summary.warningCount}</span>{" "}
                point(s) de surveillance
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Critères bloquants ────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          Critères bloquants (3)
        </h3>
        <p className="mb-4 text-xs text-gray-500">
          Si un seul de ces critères est rouge, le système ne doit pas être utilisé en conditions réelles.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="pb-2 pr-4 font-medium">Critère</th>
                <th className="pb-2 pr-4 font-medium">Statut</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Détail</th>
                <th className="pb-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {blocking.map((c) => (
                <CriterionRow key={c.code} criterion={c} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Points de surveillance ────────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          Points de surveillance (3)
        </h3>
        <p className="mb-4 text-xs text-gray-500">
          Ne bloquent pas le système mais doivent être résolus avant montée en charge sérieuse.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="pb-2 pr-4 font-medium">Critère</th>
                <th className="pb-2 pr-4 font-medium">Statut</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Détail</th>
                <th className="pb-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {watching.map((c) => (
                <CriterionRow key={c.code} criterion={c} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Légende ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Sources des critères
        </h3>
        <div className="grid gap-2 text-xs text-gray-600 md:grid-cols-2">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
            <span>
              <strong>Anomalies critiques</strong> — depuis{" "}
              <Link href="/admin/consistency" className="text-indigo-600 underline">
                /admin/consistency
              </Link>
            </span>
          </div>
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
            <span>
              <strong>Runs bloqués</strong> — payroll_run en statut{" "}
              <code>running</code> depuis {`>`} 30 min
            </span>
          </div>
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
            <span>
              <strong>Professeurs incomplets</strong> — dossier payroll
              incomplet avec cours payés (URSSAF-12)
            </span>
          </div>
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
            <span>
              <strong>Anomalies importantes</strong> — bulletins sans
              documents famille, etc.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
            <span>
              <strong>Runs récents en échec</strong> — status{" "}
              <code>failed</code> ou <code>partial</code> (30 derniers jours)
            </span>
          </div>
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
            <span>
              <strong>Familles URSSAF incomplètes</strong> — client actif avec
              dossier employeur incomplet
            </span>
          </div>
        </div>
      </div>
      {/* ── Carte pilote restreint ─────────────────────────────────────── */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-900">
              Prêt pour le pilote ?
            </p>
            <p className="mt-0.5 text-xs text-indigo-700">
              Consultez la page dédiée pour vérifier l'éligibilité des paires
              (professeur, famille) et le mode opératoire du pilote restreint.
            </p>
          </div>
          <Link
            href="/admin/pilot"
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Voir l'éligibilité →
          </Link>
        </div>
      </div>
    </main>
  );
}
