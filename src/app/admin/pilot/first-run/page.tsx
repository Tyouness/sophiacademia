/**
 * /admin/pilot/first-run — URSSAF-20
 *
 * Page dédiée au protocole du premier pilote terrain réel.
 * Server component : données live (go checklist, top candidat, période).
 *
 * Sections :
 *  1. Checklist "go immédiat" (live, colorée)
 *  2. Règle de sélection du candidat
 *  3. Règle de sélection de la période
 *  4. Protocole d'exécution pas-à-pas
 *  5. Matrice de conclusion
 */

import { runPilotEligibilityChecks } from "@/lib/pilot/runner";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { rankEligibleCandidates } from "@/lib/pilot/scoring";
import {
  buildFirstRunGoChecklist,
  type GoChecklistItem,
} from "@/lib/pilot/goGuard";
import {
  getRecommendedPeriod,
  validatePilotPeriod,
} from "@/lib/pilot/period";
import { runPreliveChecks } from "@/lib/prelive/runner";
import Link from "next/link";

// ── Composant checklist item ──────────────────────────────────────────────────

function GoItem({ item }: { item: GoChecklistItem }) {
  const icon = item.ok ? "✓" : item.blocking ? "✗" : "▲";
  const iconColor = item.ok
    ? "text-emerald-600"
    : item.blocking
      ? "text-red-600"
      : "text-amber-500";
  const bg = item.ok
    ? "bg-emerald-50 border-emerald-100"
    : item.blocking
      ? "bg-red-50 border-red-100"
      : "bg-amber-50 border-amber-100";

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${bg}`}>
      <span className={`mt-0.5 text-sm font-bold ${iconColor}`}>{icon}</span>
      <div>
        <p className={`text-sm font-medium ${item.ok ? "text-gray-800" : item.blocking ? "text-red-800" : "text-amber-800"}`}>
          {item.label}
        </p>
        {item.detail && (
          <p className="mt-0.5 text-xs text-gray-600">{item.detail}</p>
        )}
        {!item.blocking && !item.ok && (
          <p className="mt-0.5 text-xs text-amber-600 italic">Avertissement — non bloquant</p>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FirstRunPage() {
  const supabaseAdmin = createAdminSupabaseClient();
  const recommendedPeriod = getRecommendedPeriod();

  const [
    { report },
    prelive,
    { count: runningCount },
  ] = await Promise.all([
    runPilotEligibilityChecks(),
    runPreliveChecks(),
    supabaseAdmin
      .from("pilot_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "running"),
  ]);

  const eligible = report.pairs.filter((p) => p.status === "eligible");
  const ranked = rankEligibleCandidates(eligible);
  const top = ranked[0] ?? null;

  const periodCheck = validatePilotPeriod(recommendedPeriod);

  const goChecklist = buildFirstRunGoChecklist({
    preliveStatus: prelive.globalStatus,
    runningPilotCount: runningCount ?? 0,
    topCandidateEligible: top !== null,
    topCandidateFamilyCount: top?.familyIds.length ?? 0,
    topCandidateCourseCount: top?.totalCourses ?? 0,
    periodIsValid: periodCheck.valid,
    periodIsRecommended: periodCheck.isRecommended,
  });

  return (
    <main className="space-y-6">
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Protocole — premier pilote terrain réel
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Checklist go, sélection du candidat, période, exécution, conclusion.
            </p>
          </div>
          <Link
            href="/admin/pilot"
            className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            ← Retour pilotes
          </Link>
        </div>
      </div>

      {/* ── 1. Checklist "go immédiat" ─────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">
            1 — Checklist &quot;go immédiat&quot;
          </h3>
          {goChecklist.canGo ? (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              ✓ GO
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">
              ✗ HOLD — {goChecklist.blockingFailCount} blocage(s)
            </span>
          )}
          {goChecklist.warningCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              ▲ {goChecklist.warningCount} avertissement(s)
            </span>
          )}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {goChecklist.items.map((item, i) => (
            <GoItem key={i} item={item} />
          ))}
        </div>
        {!goChecklist.canGo && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <strong>Lancement bloqué.</strong> Résoudre les points marqués ✗ avant d&apos;appuyer sur &quot;Lancer le pilote&quot;.{" "}
            <Link href="/admin/prelive" className="underline underline-offset-2">
              Voir pré-live →
            </Link>
          </div>
        )}
      </div>

      {/* ── 2. Sélection du meilleur candidat ──────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          2 — Sélection du premier candidat
        </h3>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
            {top ? (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    ★ Candidat recommandé : {top.professorName ?? "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-600">
                    {top.familyIds.length} famille(s) &bull; {top.totalCourses} cours payés
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 italic">{top.recommendation}</p>
                </div>
                <Link
                  href="/admin/pilot"
                  className="shrink-0 text-xs text-indigo-600 underline underline-offset-2"
                >
                  Voir candidats →
                </Link>
              </div>
            ) : (
              <p className="text-amber-700">
                Aucun candidat éligible actuellement.{" "}
                <Link href="/admin/pilot" className="underline underline-offset-2">
                  Vérifier les dossiers →
                </Link>
              </p>
            )}
          </div>

          <div className="space-y-1.5 text-xs text-gray-600">
            <p className="font-semibold text-gray-800">Critères d&apos;acceptation :</p>
            <ul className="space-y-1 list-none">
              {[
                "1 seule famille (première priorité — périmètre le plus simple)",
                "3 à 10 cours payés dans la période (volume représentatif, maîtrisé)",
                "Dossier professeur payroll_ready (badges verts dans /staff/professors)",
                "Dossier famille complet + consentements signés (/staff/families)",
                "Aucune anomalie paid_course_without_payslip_line sur ce professeur",
                "Statut éligible confirmé dans le scoring /admin/pilot",
              ].map((c, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="mt-0.5 text-emerald-500">✓</span>
                  {c}
                </li>
              ))}
            </ul>
            <p className="mt-2 font-semibold text-gray-800">Ce qu&apos;on refuse pour ce premier test :</p>
            <ul className="space-y-1 list-none">
              {[
                "Professeur avec 2+ familles simultanées (trop de surface d'erreur)",
                "Volume > 20 cours (risque de run long ou partiel)",
                "Dossier avec consentement manquant ou ambigu",
                "Mois courant ou futur (non clos, données incomplètes)",
                "Pilote déjà en cours sur n'importe quelle paire",
              ].map((c, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="mt-0.5 text-red-400">✗</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── 3. Règle de période ─────────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          3 — Règle de sélection de la période
        </h3>
        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
            <span className="text-lg font-bold text-emerald-600">→</span>
            <div>
              <p className="font-semibold text-gray-900">
                Période recommandée : <code className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">{recommendedPeriod}</code> (M-1)
              </p>
              <p className="mt-0.5 text-xs text-gray-600">
                Dernier mois entièrement clos. Données stables, volume connu, aucun cours en attente.
              </p>
            </div>
          </div>
          <ul className="space-y-1 text-xs text-gray-600">
            <li className="flex items-start gap-1.5"><span className="text-emerald-500">✓</span> Mois M-1 : recommandé — clos, données stables</li>
            <li className="flex items-start gap-1.5"><span className="text-amber-500">▲</span> Mois M-2 à M-12 : accepté — vérifier que les données sont cohérentes</li>
            <li className="flex items-start gap-1.5"><span className="text-red-400">✗</span> Mois courant (M) : refusé — non clos, données incomplètes</li>
            <li className="flex items-start gap-1.5"><span className="text-red-400">✗</span> Mois &gt; M-12 : refusé — trop ancien, cohérence incertaine</li>
          </ul>
        </div>
      </div>

      {/* ── 4. Protocole d'exécution ─────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          4 — Protocole d&apos;exécution
        </h3>
        <ol className="space-y-3 text-sm text-gray-700">
          {[
            {
              n: 1,
              titre: "Vérifier cette checklist (page présente)",
              detail: "Tous les points bloquants doivent être ✓ avant de continuer.",
              link: null,
            },
            {
              n: 2,
              titre: "Vérifier la décision admin globale",
              detail: "Statut global = go ou attention. Jamais hold.",
              link: { label: "/admin/decision →", href: "/admin/decision" },
            },
            {
              n: 3,
              titre: "Vérifier le dossier du professeur",
              detail: "Badge payroll_ready visible, aucun champ manquant.",
              link: { label: "/staff/professors →", href: "/staff/professors" },
            },
            {
              n: 4,
              titre: "Vérifier le dossier de la famille",
              detail: "Complet, consentements signés, mandat SAP en place.",
              link: { label: "/staff/families →", href: "/staff/families" },
            },
            {
              n: 5,
              titre: "Ouvrir /admin/pilot et lancer le pilote",
              detail: `Sélectionner le candidat ★, confirmer la période ${recommendedPeriod}, cocher la confirmation, cliquer "Lancer".`,
              link: { label: "/admin/pilot →", href: "/admin/pilot" },
            },
            {
              n: 6,
              titre: "Exécuter le run mensuel",
              detail: "Depuis /admin/payroll : cocher la confirmation, lancer le run. Vérifier statut success dans l'historique.",
              link: { label: "/admin/payroll →", href: "/admin/payroll" },
            },
            {
              n: 7,
              titre: "Contrôle cohérence immédiat",
              detail: "Vérifier /admin/consistency : aucune anomalie critique nouvelle.",
              link: { label: "/admin/consistency →", href: "/admin/consistency" },
            },
            {
              n: 8,
              titre: "Contrôle bulletin",
              detail: "Vérifier /admin/payslips : bulletin du professeur présent, numéro légal non null, lignes présentes.",
              link: { label: "/admin/payslips →", href: "/admin/payslips" },
            },
            {
              n: 9,
              titre: "Consigner les observations terrain",
              detail: "Utiliser le panneau 'Observations terrain' sur le pilote actif dans /admin/pilot.",
              link: { label: "/admin/pilot →", href: "/admin/pilot" },
            },
            {
              n: 10,
              titre: "Clôturer le pilote",
              detail: "Cliquer 'Évaluer & clôturer' — le système dérive le statut automatiquement (réussi / incomplet / échoué).",
              link: null,
            },
            {
              n: 11,
              titre: "Consulter les résultats post-pilote",
              detail: "Vérifier les 7 artefacts dans /admin/pilot/results.",
              link: { label: "/admin/pilot/results →", href: "/admin/pilot/results" },
            },
            {
              n: 12,
              titre: "Consigner la conclusion",
              detail: "Utiliser la matrice de conclusion ci-dessous pour décider de la suite.",
              link: null,
            },
          ].map((step) => (
            <li key={step.n} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                {step.n}
              </span>
              <span>
                <strong>{step.titre}</strong>
                {" — "}
                {step.detail}
                {step.link && (
                  <>
                    {" "}
                    <Link href={step.link.href} className="text-indigo-600 underline underline-offset-2">
                      {step.link.label}
                    </Link>
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* ── 5. Matrice de conclusion ─────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          5 — Matrice de conclusion
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="pb-2 pr-4 font-medium">Verdict</th>
                <th className="pb-2 pr-4 font-medium">Statut pilote</th>
                <th className="pb-2 pr-4 font-medium">Conditions</th>
                <th className="pb-2 font-medium">Suite recommandée</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                {
                  verdict: "Test terrain validé",
                  badge: "bg-emerald-100 text-emerald-800",
                  statut: "completed_success",
                  conditions: "7/7 artefacts présents, aucune anomalie critique, observations cohérentes",
                  suite: "Élargir le périmètre pilote progressivement (1 professeur de plus). Consigner dans les notes.",
                },
                {
                  verdict: "Validé avec ajustements",
                  badge: "bg-emerald-100 text-emerald-800",
                  statut: "completed_success",
                  conditions: "7/7 artefacts mais observations terrain signalent une friction mineure (ex : lenteur, alerte non critique)",
                  suite: "Corriger le point mineur, relancer un second pilote sur la même paire pour confirmer.",
                },
                {
                  verdict: "Test terrain incomplet",
                  badge: "bg-amber-100 text-amber-800",
                  statut: "completed_incomplete",
                  conditions: "Bulletin présent mais ≥ 1 artefact manquant (cotisations, doc famille…)",
                  suite: "Identifier l'artefact manquant, corriger, relancer le run mensuel sur la même paire.",
                },
                {
                  verdict: "Test terrain échoué",
                  badge: "bg-red-100 text-red-800",
                  statut: "completed_failed",
                  conditions: "Pas de bulletin produit ou 0 cours payés dans la période",
                  suite: "Analyser la cause (run non déclenché ? erreur moteur ?), corriger, revenir à l'étape 1.",
                },
                {
                  verdict: "Test interrompu",
                  badge: "bg-gray-100 text-gray-700",
                  statut: "abandoned",
                  conditions: "Anomalie critique détectée pendant le run, run bloqué > 30 min, décision admin",
                  suite: "Documenter la raison dans les notes d'abandon (obligatoire). Ne pas relancer avant correction vérifiée.",
                },
              ].map((row, i) => (
                <tr key={i}>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.badge}`}>
                      {row.verdict}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-gray-500">{row.statut}</td>
                  <td className="py-3 pr-4 text-xs text-gray-600 max-w-xs">{row.conditions}</td>
                  <td className="py-3 text-xs text-gray-700">{row.suite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
