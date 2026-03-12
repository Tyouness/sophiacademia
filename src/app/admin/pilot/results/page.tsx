import { runPilotValidation } from "@/lib/pilot/validation-runner";
import type {
  PilotValidationResult,
  PilotValidationVerdict,
  PilotArtifactCheck,
} from "@/lib/pilot/validation";
import Link from "next/link";

// ── Config UI ─────────────────────────────────────────────────────────────────

const VERDICT_CONFIG: Record<
  PilotValidationVerdict,
  { bg: string; border: string; badge: string; badgeText: string; dot: string }
> = {
  success: {
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    badge:
      "inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800",
    badgeText: "Réussi",
    dot: "h-2.5 w-2.5 rounded-full bg-emerald-500",
  },
  incomplete: {
    bg: "bg-amber-50/60",
    border: "border-amber-100",
    badge:
      "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800",
    badgeText: "Incomplet",
    dot: "h-2.5 w-2.5 rounded-full bg-amber-400",
  },
  failed: {
    bg: "bg-red-50/60",
    border: "border-red-100",
    badge:
      "inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800",
    badgeText: "Échec",
    dot: "h-2.5 w-2.5 rounded-full bg-red-500",
  },
};

const ARTIFACT_LABELS: Record<string, string> = {
  paid_courses: "Cours payés",
  payslip_exists: "Bulletin généré",
  payslip_number: "Numéro légal",
  payslip_lines: "Lignes bulletin",
  contribution_lines: "Cotisations",
  family_documents: "Docs famille",
  no_critical_anomalies: "Aucune anomalie",
};

// ── Composants ────────────────────────────────────────────────────────────────

function ArtifactDot({ artifact }: { artifact: PilotArtifactCheck }) {
  const color =
    artifact.status === "present"
      ? "bg-emerald-500"
      : artifact.status === "partial"
        ? "bg-amber-400"
        : "bg-red-400";
  return (
    <span
      title={`${ARTIFACT_LABELS[artifact.code] ?? artifact.code}${artifact.detail ? ` — ${artifact.detail}` : ""}`}
      className={`inline-block h-2.5 w-2.5 rounded-full ${color}`}
    />
  );
}

function MissingList({ artifacts }: { artifacts: PilotArtifactCheck[] }) {
  const notPresent = artifacts.filter((a) => a.status !== "present");
  if (notPresent.length === 0)
    return <span className="text-xs text-gray-400">—</span>;
  return (
    <ul className="space-y-0.5 text-xs text-gray-600">
      {notPresent.map((a) => (
        <li key={a.code} className="flex items-start gap-1">
          <span className="mt-0.5 text-amber-500">
            {a.status === "partial" ? "~" : "✗"}
          </span>
          <span>
            {ARTIFACT_LABELS[a.code] ?? a.code}
            {a.detail ? <span className="ml-1 text-gray-400">({a.detail})</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ResultRow({ result }: { result: PilotValidationResult }) {
  const cfg = VERDICT_CONFIG[result.verdict];
  return (
    <tr className={`border-b last:border-0 ${cfg.bg}`}>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <div className={`shrink-0 ${cfg.dot}`} />
          <span className="text-sm font-medium text-gray-800">
            {result.professorName ?? (
              <span className="text-gray-400">— non renseigné —</span>
            )}
          </span>
        </div>
      </td>
      <td className="py-3 pr-4 font-mono text-sm text-gray-600">
        {result.period}
      </td>
      <td className="py-3 pr-4">
        <span className={cfg.badge}>{cfg.badgeText}</span>
      </td>
      <td className="py-3 pr-4">
        <div className="flex flex-wrap gap-1.5">
          {result.artifacts.map((a) => (
            <ArtifactDot key={a.code} artifact={a} />
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {result.artifacts.filter((a) => a.status === "present").length}/7
        </p>
      </td>
      <td className="py-3 pr-4">
        <MissingList artifacts={result.artifacts} />
      </td>
      <td className="py-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/staff/professors/${result.professorId}`}
            className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
          >
            Dossier →
          </Link>
          <Link
            href="/admin/consistency"
            className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
          >
            Cohérence →
          </Link>
          <Link
            href="/admin/payslips"
            className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
          >
            Bulletins →
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PilotResultsPage() {
  const report = await runPilotValidation();

  return (
    <main className="space-y-6">
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Résultats du pilote
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Contrôle post-run des artefacts produits — par professeur et
              période. Basé sur les données persistées en base.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/pilot"
              className="text-sm text-indigo-600 underline underline-offset-2"
            >
              ← Retour éligibilité
            </Link>
            <p className="text-xs text-gray-400">
              Généré le{" "}
              {new Date(report.generatedAt).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* ── Aucune donnée ────────────────────────────────────────────────── */}
      {report.results.length === 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-500">
            Aucun cours payé trouvé sur les 12 derniers mois. Le pilote n'a
            pas encore été lancé.
          </p>
          <p className="mt-2">
            <Link
              href="/admin/pilot"
              className="text-sm text-indigo-600 underline underline-offset-2"
            >
              Voir l'éligibilité pilote →
            </Link>
          </p>
        </div>
      )}

      {/* ── Statistiques ─────────────────────────────────────────────────── */}
      {report.results.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">
                {report.successCount}
              </p>
              <p className="mt-1 text-xs font-medium text-emerald-600">
                Pilote(s) réussi(s)
              </p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">
                {report.incompleteCount}
              </p>
              <p className="mt-1 text-xs font-medium text-amber-600">
                Incomplet(s)
              </p>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center">
              <p className="text-2xl font-bold text-red-700">
                {report.failedCount}
              </p>
              <p className="mt-1 text-xs font-medium text-red-600">
                Échec(s)
              </p>
            </div>
          </div>

          {/* ── Légende artefacts ────────────────────────────────────────── */}
          <div className="rounded-xl bg-white p-5 shadow-md">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Légende des 7 artefacts (points colorés)
            </h3>
            <div className="flex flex-wrap gap-4 text-xs text-gray-600">
              {(
                [
                  "paid_courses",
                  "payslip_exists",
                  "payslip_number",
                  "payslip_lines",
                  "contribution_lines",
                  "family_documents",
                  "no_critical_anomalies",
                ] as const
              ).map((code, i) => (
                <span key={code} className="flex items-center gap-1.5">
                  <span className="font-mono text-gray-400">A{i + 1}</span>
                  {ARTIFACT_LABELS[code]}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-6 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Présent
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
                Partiel
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400" />
                Manquant
              </span>
            </div>
          </div>

          {/* ── Table des résultats ──────────────────────────────────────── */}
          <div className="rounded-xl bg-white p-6 shadow-md">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Contrôle artefacts — {report.results.length} évaluation(s)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 pr-4 font-medium">Professeur</th>
                    <th className="pb-2 pr-4 font-medium">Période</th>
                    <th className="pb-2 pr-4 font-medium">Verdict</th>
                    <th className="pb-2 pr-4 font-medium">
                      Artefacts (A1→A7)
                    </th>
                    <th className="pb-2 pr-4 font-medium">Manquants</th>
                    <th className="pb-2 font-medium">Investiguer</th>
                  </tr>
                </thead>
                <tbody>
                  {report.results.map((r) => (
                    <ResultRow
                      key={`${r.professorId}:${r.period}`}
                      result={r}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Signification des verdicts ──────────────────────────────── */}
          <div className="rounded-xl bg-white p-6 shadow-md">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Interprétation des verdicts
            </h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 shrink-0">
                  Réussi
                </span>
                <p className="text-gray-600">
                  Les 7 artefacts sont présents. Le run a produit un bulletin
                  complet avec numéro légal, des lignes de paie, des
                  cotisations, et un document famille pour chaque famille. Aucune
                  anomalie critique n'affecte le périmètre.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 shrink-0">
                  Incomplet
                </span>
                <p className="text-gray-600">
                  Le bulletin existe mais au moins un artefact est manquant ou
                  partiel. Exemples : numéro légal null, cotisations non
                  persistées, document famille manquant pour au moins une
                  famille, anomalie critique sur le périmètre.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 shrink-0">
                  Échec
                </span>
                <p className="text-gray-600">
                  Pas de bulletin généré pour des cours payés existants (le run
                  n'a pas été exécuté, ou a échoué fatalement), ou aucun cours
                  payé dans la période (périmètre absent).
                </p>
              </div>
            </div>
          </div>

          {/* ── Actions recommandées ─────────────────────────────────────── */}
          {(report.failedCount > 0 || report.incompleteCount > 0) && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-5">
              <h3 className="mb-3 text-sm font-semibold text-indigo-900">
                Actions recommandées
              </h3>
              <ul className="space-y-2 text-sm text-indigo-800">
                {report.failedCount > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">1.</span>
                    <span>
                      Pour les{" "}
                      <strong>{report.failedCount} échec(s)</strong> : vérifier
                      que le run mensuel a bien été lancé via{" "}
                      <Link
                        href="/admin/payroll"
                        className="underline underline-offset-2"
                      >
                        /admin/payroll
                      </Link>{" "}
                      pour la période concernée. Consulter l'historique des
                      runs.
                    </span>
                  </li>
                )}
                {report.incompleteCount > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">2.</span>
                    <span>
                      Pour les{" "}
                      <strong>{report.incompleteCount} incomplet(s)</strong> :
                      identifier l'artefact manquant dans la colonne
                      "Manquants", puis consulter{" "}
                      <Link
                        href="/admin/consistency"
                        className="underline underline-offset-2"
                      >
                        /admin/consistency
                      </Link>{" "}
                      pour les anomalies et{" "}
                      <Link
                        href="/admin/payslips"
                        className="underline underline-offset-2"
                      >
                        /admin/payslips
                      </Link>{" "}
                      pour l'état des bulletins.
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </>
      )}
    </main>
  );
}
