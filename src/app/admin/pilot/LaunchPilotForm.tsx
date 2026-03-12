"use client";

import { useState } from "react";

type ToastState = { type: "success" | "error"; message: string } | null;

export type LaunchPilotFormProps = {
  professorId:    string;
  professorName:  string | null;
  familyIds:      string[];
  /** true si le système est en état hold (prelive blocked) */
  preliveBlocked: boolean;
  /** true si un pilote est déjà running pour ce professeur + période par défaut */
  defaultPeriodHasActiveRun: boolean;
};

function getPreviousMonthKey(): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function LaunchPilotForm({
  professorId,
  professorName,
  familyIds,
  preliveBlocked,
  defaultPeriodHasActiveRun,
}: LaunchPilotFormProps) {
  const [period, setPeriod] = useState(getPreviousMonthKey());
  const [isLaunching, setIsLaunching] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [launchedRunId, setLaunchedRunId] = useState<string | null>(null);

  if (preliveBlocked) {
    return (
      <p className="text-xs text-red-700">
        <span className="font-semibold">Lancement impossible</span> —{" "}
        <a href="/admin/prelive" className="underline underline-offset-2 hover:text-red-900">
          corriger les blocages pré-live
        </a>
      </p>
    );
  }

  if (launchedRunId) {
    return (
      <p className="text-xs font-semibold text-emerald-700">
        ✓ Pilote lancé — run ID : <span className="font-mono">{launchedRunId.slice(-8)}</span>
      </p>
    );
  }

  async function handleLaunch() {
    if (!confirmed) {
      setToast({ type: "error", message: "Confirmez le lancement avant de continuer." });
      return;
    }

    setIsLaunching(true);
    setToast(null);

    try {
      const res = await fetch("/api/admin/pilot/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professorId,
          period,
          familyIds,
          professorName,
        }),
      });
      const data = await res.json().catch(() => null) as Record<string, unknown> | null;

      if (!res.ok) {
        if (res.status === 409) {
          if ((data?.error as string) === "global_pilot_running") {
            setToast({ type: "error", message: (data?.reason as string | undefined) ?? "Un pilote est déjà en cours globalement. Attendre sa clôture." });
          } else {
            setToast({ type: "error", message: "Un pilote est déjà en cours pour ce professeur / cette période." });
          }
        } else if (res.status === 423) {
          setToast({ type: "error", message: (data?.reason as string | undefined) ?? "Système verrouillé." });
        } else {
          setToast({ type: "error", message: (data?.error as string | undefined) ?? "Erreur serveur." });
        }
        return;
      }

      setLaunchedRunId(data?.runId as string);
      setConfirmed(false);
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Erreur réseau." });
    } finally {
      setIsLaunching(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-0.5">
          <label className="block text-xs font-medium text-gray-600">Période</label>
          <input
            type="month"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setConfirmed(false);
              setToast(null);
            }}
            className="rounded border border-gray-200 px-2.5 py-1 text-xs"
          />
        </div>
      </div>

      {defaultPeriodHasActiveRun && (
        <p className="text-xs text-amber-700">
          Un pilote existe déjà pour cette période — choisissez une autre période ou attendez la clôture.
        </p>
      )}

      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-gray-300"
        />
        Je confirme le lancement du pilote ({familyIds.length} famille
        {familyIds.length !== 1 ? "s" : ""})
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleLaunch}
          disabled={isLaunching || !confirmed}
          className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white disabled:opacity-50"
        >
          {isLaunching ? "Lancement…" : "Lancer ce pilote"}
        </button>
        {toast && (
          <span
            className={
              toast.type === "success"
                ? "text-xs font-semibold text-emerald-700"
                : "text-xs font-semibold text-rose-700"
            }
          >
            {toast.message}
          </span>
        )}
      </div>
    </div>
  );
}
