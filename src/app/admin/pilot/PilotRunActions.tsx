"use client";

import { useState } from "react";

type ActionToast = { type: "success" | "error"; message: string } | null;

export type PilotRunActionsProps = {
  runId:         string;
  professorName: string | null;
  period:        string;
};

export default function PilotRunActions({
  runId,
  professorName,
  period,
}: PilotRunActionsProps) {
  const [isClosing, setIsClosing]   = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const [toast, setToast]           = useState<ActionToast>(null);
  const [closed, setClosed]         = useState(false);
  const [finalStatus, setFinalStatus] = useState<string | null>(null);

  if (closed && finalStatus) {
    const STATUS_LABEL: Record<string, string> = {
      completed_success:    "Réussi ✓",
      completed_incomplete: "Incomplet ~",
      completed_failed:     "Échec ✗",
      abandoned:            "Abandonné",
    };
    return (
      <span className="text-xs font-semibold text-gray-600">
        {STATUS_LABEL[finalStatus] ?? finalStatus}
      </span>
    );
  }

  async function handleClose() {
    if (!window.confirm(`Évaluer et clôturer le pilote de ${professorName ?? "ce professeur"} (${period}) ?`)) return;
    setIsClosing(true);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/pilot/${runId}/close`, { method: "POST" });
      const data = await res.json().catch(() => null) as Record<string, unknown> | null;
      if (!res.ok) {
        setToast({ type: "error", message: (data?.error as string | undefined) ?? "Erreur lors de la clôture." });
        return;
      }
      setFinalStatus(data?.status as string);
      setClosed(true);
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Erreur réseau." });
    } finally {
      setIsClosing(false);
    }
  }

  async function handleAbandon() {
    if (!window.confirm(`Abandonner le pilote de ${professorName ?? "ce professeur"} (${period}) ? Cette action est irréversible.`)) return;
    setIsAbandoning(true);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/pilot/${runId}/abandon`, { method: "POST" });
      const data = await res.json().catch(() => null) as Record<string, unknown> | null;
      if (!res.ok) {
        setToast({ type: "error", message: (data?.error as string | undefined) ?? "Erreur lors de l'abandon." });
        return;
      }
      setFinalStatus("abandoned");
      setClosed(true);
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Erreur réseau." });
    } finally {
      setIsAbandoning(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleClose}
        disabled={isClosing || isAbandoning}
        className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
      >
        {isClosing ? "Évaluation…" : "Évaluer & clôturer"}
      </button>
      <button
        type="button"
        onClick={handleAbandon}
        disabled={isClosing || isAbandoning}
        className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {isAbandoning ? "Abandon…" : "Abandonner"}
      </button>
      {toast && (
        <span className={toast.type === "success" ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>
          {toast.message}
        </span>
      )}
    </div>
  );
}
