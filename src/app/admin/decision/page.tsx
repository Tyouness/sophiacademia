import { runPreliveChecks } from "@/lib/prelive/runner";
import { runPilotEligibilityChecks } from "@/lib/pilot/runner";
import { runPilotValidation } from "@/lib/pilot/validation-runner";
import {
  computeDecisionSynthesis,
  type DecisionVerdict,
  type DecisionPriority,
  type DecisionSynthesis,
} from "@/lib/decision/synthesis";
import Link from "next/link";

// ── Config UI ─────────────────────────────────────────────────────────────────

const VERDICT_CONFIG: Record<
  DecisionVerdict,
  {
    bg: string;
    border: string;
    icon: string;
    title: string;
    subtitle: string;
    titleColor: string;
  }
> = {
  go: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: "✓",
    titleColor: "text-emerald-800",
    title: "Prêt à avancer",
    subtitle:
      "Aucun blocage critique. Au moins un dossier pilote est éligible. Le lancement d'un premier run pilote encadré est possible.",
  },
  attention: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "⚠",
    titleColor: "text-amber-800",
    title: "Avancer avec prudence",
    subtitle:
      "Pas de blocage absolu, mais des points nécessitent attention avant un pilote sérieux. Consulter les priorités ci-dessous.",
  },
  hold: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "✗",
    titleColor: "text-red-800",
    title: "Système bloqué — ne pas lancer de pilote",
    subtitle:
      "Des critères bloquants empêchent un usage fiable du système. Résoudre les blocages avant tout run.",
  },
};

// ── Composants ────────────────────────────────────────────────────────────────

function VerdictBanner({ synthesis }: { synthesis: DecisionSynthesis }) {
  const cfg = VERDICT_CONFIG[synthesis.verdict];
  return (
    <div className={`rounded-xl border p-6 ${cfg.border} ${cfg.bg}`}>
      <div className="flex items-start gap-4">
        <span
          className={`text-3xl font-bold leading-none ${cfg.titleColor}`}
        >
          {cfg.icon}
        </span>
        <div className="flex-1">
          <p className={`text-lg font-semibold ${cfg.titleColor}`}>
            {cfg.title}
          </p>
          <p className="mt-1 text-sm text-gray-600">{cfg.subtitle}</p>
        </div>
        {/* Compteurs synthétiques */}
        <div className="flex shrink-0 flex-wrap gap-4 text-center">
          <div>
            <p
              className={`text-2xl font-bold ${synthesis.blockingCount > 0 ? "text-red-700" : "text-emerald-600"}`}
            >
              {synthesis.blockingCount}
            </p>
            <p className="text-xs text-gray-500">blocage(s)</p>
          </div>
          <div>
            <p
              className={`text-2xl font-bold ${synthesis.warningCount > 0 ? "text-amber-600" : "text-emerald-600"}`}
            >
              {synthesis.warningCount}
            </p>
            <p className="text-xs text-gray-500">surveillance</p>
          </div>
          <div>
            <p
              className={`text-2xl font-bold ${synthesis.eligiblePilotCount > 0 ? "text-emerald-600" : "text-gray-400"}`}
            >
              {synthesis.eligiblePilotCount}
            </p>
            <p className="text-xs text-gray-500">éligible(s)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriorityList({ priorities }: { priorities: DecisionPriority[] }) {
  if (priorities.length === 0) {
    return (
      <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        Aucune action prioritaire identifiée.
      </p>
    );
  }

  const blocking = priorities.filter((p) => p.blocking);
  const watching = priorities.filter((p) => !p.blocking);

  return (
    <div className="space-y-3">
      {blocking.length > 0 && (
        <div className="rounded-lg border border-red-100 bg-red-50/70 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">
            Blocages critiques — à résoudre en priorité
          </p>
          <ul className="space-y-2">
            {blocking.map((p) => (
              <li key={p.rank} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 font-bold text-red-500">✗</span>
                <span className="flex-1 text-gray-700">{p.label}</span>
                <Link
                  href={p.href}
                  className="shrink-0 text-xs text-red-700 underline underline-offset-2 hover:text-red-900"
                >
                  Corriger →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {watching.length > 0 && (
        <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
            Actions / points de surveillance
          </p>
          <ul className="space-y-2">
            {watching.map((p) => (
              <li key={p.rank} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 text-amber-500">→</span>
                <span className="flex-1 text-gray-700">{p.label}</span>
                <Link
                  href={p.href}
                  className="shrink-0 text-xs text-amber-700 underline underline-offset-2 hover:text-amber-900"
                >
                  Voir →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DecisionPage() {
  // Appels en parallèle — chacun ré-utilise runConsistencyChecks() en interne
  const [prelive, eligibility, validation] = await Promise.all([
    runPreliveChecks(),
    runPilotEligibilityChecks(),
    runPilotValidation(),
  ]);

  const synthesis = computeDecisionSynthesis({ prelive, eligibility, validation });

  return (
    <main className="space-y-6">
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Tableau de bord de décision
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Synthèse des signaux — peut-on avancer vers un pilote encadré ?
            </p>
          </div>
          <p className="text-xs text-gray-400">
            Généré le{" "}
            {new Date(synthesis.generatedAt).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      {/* ── 1. Verdict global ────────────────────────────────────────────── */}
      <VerdictBanner synthesis={synthesis} />

      {/* ── 2. Actions prioritaires ──────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          Actions prioritaires
        </h3>
        <PriorityList priorities={synthesis.priorities} />
      </div>

      {/* ── 3. Éligibilité pilote ────────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Dossiers pilotes éligibles
          </h3>
          <Link
            href="/admin/pilot"
            className="text-xs text-indigo-600 underline underline-offset-2"
          >
            Voir l'éligibilité complète →
          </Link>
        </div>
        {synthesis.eligiblePilotCount === 0 ? (
          <p className="text-sm text-gray-500">
            Aucun dossier pilote éligible pour l'instant. Compléter les dossiers
            professeur/famille.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-base font-bold text-emerald-700">
                {synthesis.eligiblePilotCount}
              </span>
              <p className="text-sm text-gray-700">
                paire(s) professeur/famille éligible(s) au pilote restreint.
              </p>
            </div>
            <p className="text-xs text-gray-500">
              Un pilote implique : 1 professeur, 1 à 3 familles, 1 période, volet
              paie + documents SAP uniquement.
            </p>
          </div>
        )}
      </div>

      {/* ── 4. Résultats pilotes récents ─────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Résultats pilotes récents
          </h3>
          <Link
            href="/admin/pilot/results"
            className="text-xs text-indigo-600 underline underline-offset-2"
          >
            Voir tous les résultats →
          </Link>
        </div>

        {synthesis.pilotSuccessCount + synthesis.pilotIncompleteCount + synthesis.pilotFailedCount ===
        0 ? (
          <p className="text-sm text-gray-500">
            Aucun run pilote trouvé sur les 12 derniers mois.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div
              className={`rounded-lg p-3 text-center ${synthesis.pilotSuccessCount > 0 ? "border border-emerald-100 bg-emerald-50" : "border border-gray-100 bg-gray-50"}`}
            >
              <p
                className={`text-2xl font-bold ${synthesis.pilotSuccessCount > 0 ? "text-emerald-700" : "text-gray-400"}`}
              >
                {synthesis.pilotSuccessCount}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">Réussi(s)</p>
            </div>
            <div
              className={`rounded-lg p-3 text-center ${synthesis.pilotIncompleteCount > 0 ? "border border-amber-100 bg-amber-50" : "border border-gray-100 bg-gray-50"}`}
            >
              <p
                className={`text-2xl font-bold ${synthesis.pilotIncompleteCount > 0 ? "text-amber-700" : "text-gray-400"}`}
              >
                {synthesis.pilotIncompleteCount}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">Incomplet(s)</p>
            </div>
            <div
              className={`rounded-lg p-3 text-center ${synthesis.pilotFailedCount > 0 ? "border border-red-100 bg-red-50" : "border border-gray-100 bg-gray-50"}`}
            >
              <p
                className={`text-2xl font-bold ${synthesis.pilotFailedCount > 0 ? "text-red-700" : "text-gray-400"}`}
              >
                {synthesis.pilotFailedCount}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">Échec(s)</p>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Navigation vers les pages détaillées ──────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          Pages de diagnostic et d'action
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            {
              href: "/admin/prelive",
              label: "Checklist pré-live",
              desc: "6 critères go/no-go — blocages et surveillance",
              statusDot:
                prelive.globalStatus === "ok"
                  ? "bg-emerald-500"
                  : prelive.globalStatus === "warning"
                    ? "bg-amber-400"
                    : "bg-red-500",
              statusText:
                prelive.globalStatus === "ok"
                  ? "OK"
                  : prelive.globalStatus === "warning"
                    ? `${prelive.warningCount} warning(s)`
                    : `${prelive.blockingCount} bloquant(s)`,
            },
            {
              href: "/admin/consistency",
              label: "Cohérence inter-tables",
              desc: "Anomalies critiques, importantes, secondaires",
              statusDot:
                prelive.blockingCount > 0 ? "bg-red-500" : "bg-emerald-500",
              statusText:
                prelive.blockingCount > 0
                  ? "Anomalies critiques"
                  : "Aucune anomalie critique",
            },
            {
              href: "/admin/pilot",
              label: "Éligibilité pilote",
              desc: "Mode opératoire et dossiers éligibles",
              statusDot:
                synthesis.eligiblePilotCount > 0
                  ? "bg-emerald-500"
                  : "bg-gray-300",
              statusText:
                synthesis.eligiblePilotCount > 0
                  ? `${synthesis.eligiblePilotCount} éligible(s)`
                  : "0 éligible",
            },
            {
              href: "/admin/pilot/results",
              label: "Résultats pilotes",
              desc: "Verdict post-run — artefacts présents / manquants",
              statusDot:
                synthesis.pilotSuccessCount > 0
                  ? "bg-emerald-500"
                  : synthesis.pilotIncompleteCount > 0
                    ? "bg-amber-400"
                    : "bg-gray-300",
              statusText:
                synthesis.pilotSuccessCount > 0
                  ? `${synthesis.pilotSuccessCount} réussi(s)`
                  : synthesis.pilotIncompleteCount > 0
                    ? `${synthesis.pilotIncompleteCount} incomplet(s)`
                    : "Aucun run",
            },
            {
              href: "/admin/payroll",
              label: "Paie mensuelle",
              desc: "Lancer ou consulter les runs",
              statusDot: eligibility.preliveBlocked ? "bg-red-500" : "bg-emerald-500",
              statusText: eligibility.preliveBlocked ? "Run bloqué" : "Prêt",
            },
            {
              href: "/admin/audit",
              label: "Audit",
              desc: "Historique des actions admin",
              statusDot: "bg-gray-300",
              statusText: "—",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-start gap-3 rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
            >
              <div className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.statusDot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                <p className="mt-0.5 truncate text-xs text-gray-500">{item.desc}</p>
              </div>
              <span className="shrink-0 text-xs text-gray-400">{item.statusText}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
