"use client";

import { useState } from "react";

type ToastState = { type: "success" | "error" | "warning"; message: string } | null;

type RunResult = {
  runId: string;
  period: string;
  status: string;
  professorsProcessed: number;
  payslipsCreated: number;
  familyDocsCreated: number;
  familyDocsFailed: number;
  contribErrors: number;
  errorsCount: number;
  errorDetails?: Array<{ professorId: string; message: string }>;
  durationMs: number;
};

function getPreviousMonthKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-based, so this is "previous" when month-1
  const date = new Date(Date.UTC(year, month - 1, 1));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function RunPayrollPanel({ blocked = false }: { blocked?: boolean }) {
  const [period, setPeriod] = useState(getPreviousMonthKey());
  const [isRunning, setIsRunning] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleRun() {
    if (!confirmed) {
      setToast({
        type: "error",
        message: "Veuillez cocher la case de confirmation avant de lancer le run.",
      });
      return;
    }

    setIsRunning(true);
    setToast(null);
    setLastResult(null);

    try {
      const res = await fetch(
        `/api/admin/payroll/run-monthly?period=${encodeURIComponent(period)}`,
        { method: "GET" },
      );
      const data = (await res.json().catch(() => null)) as RunResult | null;

      if (!res.ok || !data) {
        const errData = data as unknown as { error?: string; reason?: string } | null;
        setToast({
          type: "error",
          message: errData?.reason ?? errData?.error ?? "Erreur serveur",
        });
        return;
      }

      setLastResult(data);
      setConfirmed(false);

      if (data.status === "success") {
        setToast({ type: "success", message: `Run terminé — ${data.payslipsCreated} bulletin(s) généré(s).` });
      } else if (data.status === "partial") {
        setToast({
          type: "warning",
          message: `Run partiel — ${data.payslipsCreated} ok, ${data.errorsCount} erreur(s).`,
        });
      } else {
        setToast({ type: "error", message: `Run échoué — ${data.errorsCount} erreur(s).` });
      }
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Erreur réseau",
      });
    } finally {
      setIsRunning(false);
    }
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      success: "bg-emerald-100 text-emerald-800",
      partial: "bg-amber-100 text-amber-800",
      failed: "bg-rose-100 text-rose-800",
      running: "bg-blue-100 text-blue-800",
    };
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status] ?? "bg-gray-100 text-gray-800"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Run form */}
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h3 className="text-sm font-semibold text-gray-900">
          Lancer un run de paie mensuelle
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Le run est idempotent — relancer sur la même période met à jour les bulletins existants sans créer de doublons.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Période (YYYY-MM)
            </label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-full border border-blue-100 px-4 py-2 text-sm"
            />
          </div>
        </div>

        {blocked ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-semibold text-red-800">
              Run désactivé — blocages critiques actifs
            </p>
            <p className="mt-0.5 text-xs text-red-700">
              Corrigez les problèmes détectés dans la{" "}
              <a href="/admin/prelive" className="underline underline-offset-2 hover:text-red-900">
                checklist pré-live
              </a>{" "}
              avant de lancer un run.
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <label className="flex items-center gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Je confirme vouloir lancer le run de paie mensuelle pour la période{" "}
              <span className="font-semibold">{period}</span>
            </label>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleRun}
            disabled={blocked || isRunning || !confirmed}
            className="rounded-full bg-blue-600 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-white disabled:opacity-50"
          >
            {isRunning ? "Calcul en cours…" : blocked ? "Run verrouillé" : "Lancer le run"}
          </button>
          {toast && (
            <span
              className={
                toast.type === "success"
                  ? "text-xs font-semibold text-emerald-600"
                  : toast.type === "warning"
                    ? "text-xs font-semibold text-amber-600"
                    : "text-xs font-semibold text-rose-600"
              }
            >
              {toast.message}
            </span>
          )}
        </div>
      </div>

      {/* Last run result */}
      {lastResult && (
        <div className="rounded-xl bg-white p-6 shadow-md">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Résultat du dernier run
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Run ID</dt>
              <dd className="font-mono text-xs">{lastResult.runId}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Période</dt>
              <dd className="font-medium">{lastResult.period}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Statut</dt>
              <dd>{statusBadge(lastResult.status)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Professeurs traités</dt>
              <dd className="font-medium">{lastResult.professorsProcessed}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Bulletins générés</dt>
              <dd className="font-medium">{lastResult.payslipsCreated}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Docs famille créés</dt>
              <dd className="font-medium">{lastResult.familyDocsCreated}</dd>
            </div>
            {lastResult.familyDocsFailed > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Docs famille échoués</dt>
                <dd className="font-semibold text-amber-600">{lastResult.familyDocsFailed}</dd>
              </div>
            )}
            {lastResult.contribErrors > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Erreurs cotisations</dt>
                <dd className="font-semibold text-amber-600">{lastResult.contribErrors}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Erreurs totales</dt>
              <dd
                className={lastResult.errorsCount > 0 ? "font-semibold text-rose-600" : "font-medium"}
              >
                {lastResult.errorsCount}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Durée</dt>
              <dd className="font-medium">{lastResult.durationMs}ms</dd>
            </div>
          </dl>

          {lastResult.errorDetails && lastResult.errorDetails.length > 0 && (
            <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
              <p className="font-semibold">Détail des erreurs :</p>
              <ul className="mt-1 space-y-1">
                {lastResult.errorDetails.map((e, i) => (
                  <li key={i} className="font-mono">
                    <span className="text-rose-400">prof:</span> {e.professorId.slice(-8)}{" "}
                    — {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
