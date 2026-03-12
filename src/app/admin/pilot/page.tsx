import { runPilotEligibilityChecks } from "@/lib/pilot/runner";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { PILOT_RUN_STATUS_LABELS, PILOT_RUN_STATUS_COLORS } from "@/lib/pilot/lifecycle";
import { rankEligibleCandidates } from "@/lib/pilot/scoring";
import type { PilotPairResult } from "@/lib/pilot/eligibility";
import LaunchPilotForm from "./LaunchPilotForm";
import PilotRunActions from "./PilotRunActions";
import PilotObservationsPanel from "./PilotObservationsPanel";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

type PilotRunRow = {
  id: string;
  professor_id: string;
  professor_name: string | null;
  period: string;
  family_ids: string[];
  status: string;
  launched_at: string;
  closed_at: string | null;
  notes: string | null;
};

// ── Composants UI ─────────────────────────────────────────────────────────────

function EligibleRow({ pair }: { pair: PilotPairResult }) {
  return (
    <tr className="border-b last:border-0 bg-emerald-50/40">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium text-gray-800">
            {pair.professorName ?? <span className="text-gray-400">—</span>}
          </span>
        </div>
      </td>
      <td className="py-3 pr-4 text-sm text-gray-700">
        {pair.familyName ?? <span className="text-gray-400">—</span>}
      </td>
      <td className="py-3 pr-4 text-sm text-gray-600">{pair.paidCoursesCount}</td>
      <td className="py-3 pr-4">
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
          Éligible
        </span>
      </td>
      <td className="py-3">
        <div className="flex gap-3">
          <Link
            href={`/staff/professors/${pair.professorId}`}
            className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
          >
            Dossier prof →
          </Link>
          <Link
            href={`/staff/families/${pair.familyId}`}
            className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
          >
            Dossier famille →
          </Link>
        </div>
      </td>
    </tr>
  );
}

function IneligibleRow({ pair }: { pair: PilotPairResult }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 shrink-0 rounded-full bg-gray-300" />
          <span className="text-sm text-gray-600">
            {pair.professorName ?? <span className="text-gray-400">—</span>}
          </span>
        </div>
      </td>
      <td className="py-3 pr-4 text-sm text-gray-500">
        {pair.familyName ?? <span className="text-gray-400">—</span>}
      </td>
      <td className="py-3 pr-4 text-sm text-gray-500">{pair.paidCoursesCount}</td>
      <td className="py-3 pr-4">
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          Non éligible
        </span>
      </td>
      <td className="py-3 text-xs text-gray-500">
        <ul className="space-y-0.5 list-disc list-inside">
          {pair.blockers.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PilotPage() {
  const supabaseAdmin = createAdminSupabaseClient();

  const [{ report, preliveBlocked, preliveBlockers }, { data: rawPilotRuns }] =
    await Promise.all([
      runPilotEligibilityChecks(),
      supabaseAdmin
        .from("pilot_runs")
        .select("id, professor_id, professor_name, period, family_ids, status, launched_at, closed_at, notes")
        .order("launched_at", { ascending: false })
        .limit(50),
    ]);

  const pilotRuns = (rawPilotRuns ?? []) as PilotRunRow[];
  const activePilots = pilotRuns.filter((r) => r.status === "running");
  const closedPilots = pilotRuns.filter((r) => r.status !== "running");

  // Alerte garde-fou global : plus d'1 pilote running (ne devrait pas arriver)
  const tooManyActive = activePilots.length > 1;

  // Set of "professorId:defaultPeriod" with an active run — used by launch form guard
  const activePilotSlots = new Set(activePilots.map((r) => r.professor_id));

  const eligible   = report.pairs.filter((p) => p.status === "eligible");
  const ineligible = report.pairs.filter((p) => p.status === "ineligible");
  // URSSAF-19 : classement par score (meilleur premier candidat en tête)
  const rankedCandidates = rankEligibleCandidates(eligible);

  return (
    <main className="space-y-6">
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Pilote restreint
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Périmètre : 1 à 3 paires (professeur, famille) — volet paie + documents SAP uniquement.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/pilot/results"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Voir les résultats →
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

      {/* ── Alerte : trop de pilotes actifs (anomalie) ─────────────────── */}
      {tooManyActive && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-800">
            ⚠ Anomalie : {activePilots.length} pilotes simultanément en cours
          </p>
          <p className="mt-1 text-xs text-orange-700">
            Un seul pilote devrait être actif à la fois. Clôturer ou abandonner
            les runs excédentaires avant tout nouveau lancement.
          </p>
        </div>
      )}

      {/* ── Alerte : trop de pilotes actifs (anomalie) ─────────────────── */}
      {tooManyActive && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-800">
            ⚠ Anomalie : {activePilots.length} pilotes simultanément en cours
          </p>
          <p className="mt-1 text-xs text-orange-700">
            Un seul pilote devrait être actif à la fois. Clôturer ou abandonner
            les runs excédentaires avant tout nouveau lancement.
          </p>
        </div>
      )}

      {/* ── Alerte pré-live bloqué ───────────────────────────────────────── */}
      {preliveBlocked && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <span className="text-lg font-bold text-red-600">✗</span>
            <div>
              <p className="font-semibold text-red-800">
                Système bloqué — aucun run ne peut être lancé
              </p>
              <ul className="mt-1 list-inside list-disc text-sm text-red-700">
                {preliveBlockers.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              <p className="mt-2">
                <Link
                  href="/admin/prelive"
                  className="text-sm font-semibold text-red-800 underline underline-offset-2"
                >
                  Voir la checklist pré-live →
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Mode opératoire ─────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          Mode opératoire — pilote restreint
        </h3>
        <ol className="space-y-3 text-sm text-gray-700">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              1
            </span>
            <span>
              <strong>Vérifier la checklist pré-live globale.</strong> La page{" "}
              <Link href="/admin/prelive" className="text-indigo-600 underline">
                /admin/prelive
              </Link>{" "}
              doit afficher un statut <em>ok</em> ou <em>warning</em>. Si le statut est{" "}
              <em>blocked</em>, stopper ici.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              2
            </span>
            <span>
              <strong>Choisir 1 à 3 paires éligibles</strong> dans la liste
              ci-dessous. Commencer par une seule paire pour le premier pilote.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              3
            </span>
            <span>
              <strong>Vérifier le dossier professeur :</strong> ouvrir{" "}
              <Link href="/staff/professors" className="text-indigo-600 underline">
                /staff/professors
              </Link>{" "}
              → confirmer le badge <em>Dossier exploitable</em> et l'absence de
              champs manquants.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              4
            </span>
            <span>
              <strong>Vérifier le dossier famille :</strong> ouvrir{" "}
              <Link href="/staff/families" className="text-indigo-600 underline">
                /staff/families
              </Link>{" "}
              → confirmer que le dossier est complet et que les consentements
              sont signés.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              5
            </span>
            <span>
              <strong>Lancer le run mensuel</strong> depuis{" "}
              <Link href="/admin/payroll" className="text-indigo-600 underline">
                /admin/payroll
              </Link>
              . Cocher la case de confirmation. Vérifier le statut{" "}
              <code>success</code> dans l'historique.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              6
            </span>
            <span>
              <strong>Contrôle post-run :</strong> vérifier dans{" "}
              <Link href="/admin/consistency" className="text-indigo-600 underline">
                /admin/consistency
              </Link>{" "}
              qu'aucune anomalie critique n'est apparue. Vérifier dans{" "}
              <Link href="/admin/payslips" className="text-indigo-600 underline">
                /admin/payslips
              </Link>{" "}
              que le bulletin du professeur est présent avec un numéro légal.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              7
            </span>
            <span>
              <strong>Valider ou abandonner le pilote.</strong> Si tout est
              vert → pilote réussi. Si une anomalie est détectée → noter
              l'erreur, ne pas relancer avant correction, revenir en étape 1.
            </span>
          </li>
        </ol>
      </div>

      {/* ── Points de contrôle post-pilote ──────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          Artefacts à contrôler après chaque run pilote
        </h3>
        <div className="grid gap-3 text-sm md:grid-cols-2">
          {[
            {
              label: "Bulletin professeur",
              check: "payslips.number non null, status=final",
              link: "/admin/payslips",
            },
            {
              label: "Lignes de bulletin",
              check: "payslip_lines couvre tous les cours paid de la période",
              link: "/admin/consistency",
            },
            {
              label: "Cotisations sociales",
              check: "payslip_contribution_lines présentes pour ce bulletin",
              link: "/admin/consistency",
            },
            {
              label: "Document famille SAP",
              check: "payslip_family_documents présent et PDF téléchargeable",
              link: "/admin/payslips",
            },
            {
              label: "Run mensuel",
              check: "payroll_runs.status = success ou partial (0 erreur)",
              link: "/admin/payroll",
            },
            {
              label: "Cohérence globale",
              check: "Aucune anomalie critique dans /admin/consistency",
              link: "/admin/consistency",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-3 rounded-lg border border-gray-100 p-3"
            >
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-gray-300" />
              <div>
                <p className="font-medium text-gray-800">{item.label}</p>
                <p className="mt-0.5 text-xs text-gray-500">{item.check}</p>
                <Link
                  href={item.link}
                  className="mt-1 block text-xs text-indigo-600 underline underline-offset-2"
                >
                  Vérifier →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pilotes en cours ─────────────────────────────────────────────── */}
      {activePilots.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-md">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Pilotes en cours ({activePilots.length})
          </h3>
          <div className="space-y-3">
            {activePilots.map((run) => (
              <div
                key={run.id}
                className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-gray-900">
                      {run.professor_name ?? <span className="text-gray-400">— professeur inconnu —</span>}
                      <span className="ml-2 font-normal text-gray-500">&mdash; {run.period}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {(run.family_ids as string[]).length} famille
                      {(run.family_ids as string[]).length !== 1 ? "s" : ""} &bull; lancé le{" "}
                      {new Date(run.launched_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                    <p className="font-mono text-xs text-gray-400">{run.id.slice(-12)}</p>
                  </div>
                  <PilotRunActions
                    runId={run.id}
                    professorName={run.professor_name}
                    period={run.period}
                  />
                </div>
                <PilotObservationsPanel
                  runId={run.id}
                  initialNotes={run.notes}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Historique pilotes clôturés ──────────────────────────────────── */}
      {closedPilots.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-md">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Historique des pilotes ({closedPilots.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Professeur</th>
                  <th className="pb-2 pr-4 font-medium">Période</th>
                  <th className="pb-2 pr-4 font-medium">Statut</th>
                  <th className="pb-2 font-medium">Clôturé le</th>
                </tr>
              </thead>
              <tbody>
                {closedPilots.map((run) => (
                  <tr key={run.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-sm text-gray-800">
                      {run.professor_name ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-2 pr-4 text-sm text-gray-700">{run.period}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        PILOT_RUN_STATUS_COLORS[run.status as keyof typeof PILOT_RUN_STATUS_COLORS] ?? "bg-gray-100 text-gray-600"
                      }`}>
                        {PILOT_RUN_STATUS_LABELS[run.status as keyof typeof PILOT_RUN_STATUS_LABELS] ?? run.status}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-gray-500">
                      {run.closed_at
                        ? new Date(run.closed_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Éligibilité pilote ───────────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Professeurs éligibles au pilote ({rankedCandidates.length})
          </h3>
          {rankedCandidates.length > 0 && (
            <span className="text-xs text-gray-500">
              Classés par score &mdash; &#x2605; = meilleur premier candidat terrain
            </span>
          )}
        </div>

        {rankedCandidates.length === 0 ? (
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
            Aucun professeur éligible pour l&apos;instant. Compléter les dossiers
            manquants puis relancer l&apos;analyse.
          </div>
        ) : (
          <div className="space-y-4">
            {rankedCandidates.map((ep) => (
              <div
                key={ep.professorId}
                className={`rounded-lg border px-4 py-4 ${
                  ep.isTopCandidate
                    ? "border-indigo-200 bg-indigo-50/40 ring-1 ring-indigo-200"
                    : "border-emerald-100 bg-emerald-50/40"
                }`}
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">
                        {ep.professorName ?? <span className="text-gray-400">— non renseigné —</span>}
                      </p>
                      {ep.isTopCandidate && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">
                          &#x2605; Meilleur premier candidat
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {ep.familyIds.length} famille{ep.familyIds.length !== 1 ? "s" : ""} &bull;{" "}
                      {ep.totalCourses} cours payé{ep.totalCourses !== 1 ? "s" : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400 italic">{ep.recommendation}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {ep.familyNames.map((name, i) => (
                        <Link
                          key={ep.familyIds[i]}
                          href={`/staff/families/${ep.familyIds[i]}`}
                          className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
                        >
                          {name ?? "Famille"} →
                        </Link>
                      ))}
                      <Link
                        href={`/staff/professors/${ep.professorId}`}
                        className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
                      >
                        Dossier prof →
                      </Link>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    Éligible
                  </span>
                </div>
                <LaunchPilotForm
                  professorId={ep.professorId}
                  professorName={ep.professorName}
                  familyIds={ep.familyIds}
                  preliveBlocked={preliveBlocked}
                  defaultPeriodHasActiveRun={activePilotSlots.has(ep.professorId)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Dossiers non éligibles ───────────────────────────────────────── */}
      {ineligible.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-md">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Dossiers non éligibles — raisons ({ineligible.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Professeur</th>
                  <th className="pb-2 pr-4 font-medium">Famille</th>
                  <th className="pb-2 pr-4 font-medium">Cours payés</th>
                  <th className="pb-2 pr-4 font-medium">Statut</th>
                  <th className="pb-2 font-medium">Raisons</th>
                </tr>
              </thead>
              <tbody>
                {ineligible.map((pair) => (
                  <IneligibleRow
                    key={`${pair.professorId}:${pair.familyId}`}
                    pair={pair}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Cas d'abandon du pilote ──────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Cas d'abandon du pilote
        </h3>
        <ul className="space-y-2 text-sm text-gray-600">
          {[
            "Anomalie critique apparue dans /admin/consistency après le run",
            "Run resté en statut « running » plus de 30 minutes (run bloqué)",
            "Bulletin généré sans numéro légal (payslips.number IS NULL)",
            "Document famille manquant pour une famille de la paire pilote",
            "Erreur de calcul des cotisations detectable via /admin/consistency",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-red-400">✗</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-gray-400">
          En cas d'abandon : ne pas relancer de run, documenter l'erreur, et
          revenir à la checklist pré-live avant toute nouvelle tentative.
        </p>
      </div>
    </main>
  );
}
