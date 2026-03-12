import { runConsistencyChecks } from "@/lib/consistency/runner";
import type { AnomalySeverity, Anomaly } from "@/lib/consistency/checks";

// ── Helpers UI ────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  AnomalySeverity,
  { label: string; badge: string; section: string; dot: string }
> = {
  critique: {
    label: "Critique",
    badge:
      "inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800",
    section: "border-l-4 border-red-400 bg-red-50",
    dot: "h-2 w-2 rounded-full bg-red-500",
  },
  important: {
    label: "Important",
    badge:
      "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800",
    section: "border-l-4 border-amber-400 bg-amber-50",
    dot: "h-2 w-2 rounded-full bg-amber-500",
  },
  secondaire: {
    label: "Secondaire",
    badge:
      "inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700",
    section: "border-l-4 border-blue-300 bg-blue-50",
    dot: "h-2 w-2 rounded-full bg-blue-400",
  },
};

function SeverityBadge({ severity }: { severity: AnomalySeverity }) {
  const cfg = SEVERITY_CONFIG[severity];
  return <span className={cfg.badge}>{cfg.label}</span>;
}

function EntityLink({ type, id }: { type: Anomaly["entityType"]; id: string }) {
  const links: Partial<Record<Anomaly["entityType"], string>> = {
    payslip: `/admin/payslips`,
    urssaf_client: `/admin/families`,
    payroll_run: `/admin/payroll`,
    course: `/admin/courses`,
  };
  const href = links[type];
  const shortId = id.slice(0, 8) + "…";
  if (href) {
    return (
      <a
        href={`${href}?highlight=${id}`}
        className="font-mono text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
      >
        {shortId}
      </a>
    );
  }
  return <span className="font-mono text-xs text-gray-500">{shortId}</span>;
}

function AnomalyTable({ anomalies }: { anomalies: Anomaly[] }) {
  if (anomalies.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-gray-500">
            <th className="pb-2 pr-4 font-medium">Sévérité</th>
            <th className="pb-2 pr-4 font-medium">Anomalie</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 pr-4 font-medium">ID</th>
            <th className="pb-2 font-medium">Contexte</th>
          </tr>
        </thead>
        <tbody>
          {anomalies.map((a, i) => (
            <tr key={`${a.code}-${a.entityId}-${i}`} className="border-b last:border-0">
              <td className="py-2 pr-4">
                <SeverityBadge severity={a.severity} />
              </td>
              <td className="py-2 pr-4 text-gray-800">{a.label}</td>
              <td className="py-2 pr-4 font-mono text-xs text-gray-500">
                {a.entityType}
              </td>
              <td className="py-2 pr-4">
                <EntityLink type={a.entityType} id={a.entityId} />
              </td>
              <td className="py-2 text-xs text-gray-500">{a.detail ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ConsistencyPage() {
  const report = await runConsistencyChecks();

  const critiques = report.anomalies.filter((a) => a.severity === "critique");
  const importants = report.anomalies.filter((a) => a.severity === "important");
  const secondaires = report.anomalies.filter((a) => a.severity === "secondaire");

  const allClear = report.totalAnomalies === 0;

  return (
    <main className="space-y-6">
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Contrôle de cohérence
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Détection des incohérences inter-tables — fenêtre 12 mois.
            </p>
          </div>
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

      {/* ── Résumé ──────────────────────────────────────────────────────── */}
      {allClear ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="font-semibold text-emerald-800">
            ✓ Aucune anomalie détectée
          </p>
          <p className="mt-1 text-sm text-emerald-700">
            Toutes les vérifications sont passées sur la fenêtre analysée.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-5 shadow-md">
            <p className="text-xs font-medium uppercase tracking-widest text-red-500">
              Critique
            </p>
            <p className="mt-3 text-4xl font-semibold text-gray-900">
              {report.bySeverity.critique}
            </p>
            <p className="mt-1 text-xs text-gray-500">anomalie(s)</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-md">
            <p className="text-xs font-medium uppercase tracking-widest text-amber-500">
              Important
            </p>
            <p className="mt-3 text-4xl font-semibold text-gray-900">
              {report.bySeverity.important}
            </p>
            <p className="mt-1 text-xs text-gray-500">anomalie(s)</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-md">
            <p className="text-xs font-medium uppercase tracking-widest text-blue-500">
              Secondaire
            </p>
            <p className="mt-3 text-4xl font-semibold text-gray-900">
              {report.bySeverity.secondaire}
            </p>
            <p className="mt-1 text-xs text-gray-500">anomalie(s)</p>
          </div>
        </div>
      )}

      {/* ── Section Critique ────────────────────────────────────────────── */}
      {critiques.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center gap-3">
            <div className={SEVERITY_CONFIG.critique.dot} />
            <h3 className="text-sm font-semibold text-gray-900">
              Anomalies critiques ({critiques.length})
            </h3>
            <span className="text-xs text-gray-400">
              — remettent en cause l'usage réel
            </span>
          </div>
          <AnomalyTable anomalies={critiques} />
        </div>
      )}

      {/* ── Section Important ────────────────────────────────────────────── */}
      {importants.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center gap-3">
            <div className={SEVERITY_CONFIG.important.dot} />
            <h3 className="text-sm font-semibold text-gray-900">
              Anomalies importantes ({importants.length})
            </h3>
            <span className="text-xs text-gray-400">
              — à corriger avant montée en charge
            </span>
          </div>
          <AnomalyTable anomalies={importants} />
        </div>
      )}

      {/* ── Section Secondaire ──────────────────────────────────────────── */}
      {secondaires.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center gap-3">
            <div className={SEVERITY_CONFIG.secondaire.dot} />
            <h3 className="text-sm font-semibold text-gray-900">
              Anomalies secondaires ({secondaires.length})
            </h3>
            <span className="text-xs text-gray-400">
              — nettoyage ou amélioration
            </span>
          </div>
          <AnomalyTable anomalies={secondaires} />
        </div>
      )}

      {/* ── Légende ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Contrôles actifs
        </h3>
        <div className="grid gap-2 text-xs text-gray-600 md:grid-cols-2">
          <div className="flex items-start gap-2">
            <div className={`mt-0.5 ${SEVERITY_CONFIG.critique.dot} shrink-0`} />
            <span>
              <strong>paid_course_without_payslip_line</strong> — cours{" "}
              <code>paid</code> absent de payslip_lines
            </span>
          </div>
          <div className="flex items-start gap-2">
            <div className={`mt-0.5 ${SEVERITY_CONFIG.critique.dot} shrink-0`} />
            <span>
              <strong>payslip_without_contributions</strong> — bulletin sans
              cotisations sociales persistées
            </span>
          </div>
          <div className="flex items-start gap-2">
            <div
              className={`mt-0.5 ${SEVERITY_CONFIG.important.dot} shrink-0`}
            />
            <span>
              <strong>payslip_without_family_document</strong> — bulletin SAP
              sans document famille
            </span>
          </div>
          <div className="flex items-start gap-2">
            <div
              className={`mt-0.5 ${SEVERITY_CONFIG.important.dot} shrink-0`}
            />
            <span>
              <strong>urssaf_registered_without_date</strong> — client URSSAF{" "}
              <code>registered</code> sans <code>registered_at</code>
            </span>
          </div>
          <div className="flex items-start gap-2">
            <div
              className={`mt-0.5 ${SEVERITY_CONFIG.secondaire.dot} shrink-0`}
            />
            <span>
              <strong>payroll_run_stuck_running</strong> — run bloqué en{" "}
              <code>running</code> {`> 30 min`}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <div
              className={`mt-0.5 ${SEVERITY_CONFIG.secondaire.dot} shrink-0`}
            />
            <span>
              <strong>payslip_missing_number</strong> — bulletin sans numéro
              légal
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
