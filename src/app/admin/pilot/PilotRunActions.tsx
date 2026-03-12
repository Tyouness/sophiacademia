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
  const [isClosing, setIsClosing]         = useState(false);
  const [showAbandonForm, setShowAbandonForm] = useState(false);
  const [abandonNotes, setAbandonNotes]   = useState("");
  const [isAbandoning, setIsAbandoning]   = useState(false);
  const [toast, setToast]                 = useState<ActionToast>(null);
  const [closed, setClosed]               = useState(false);
  const [finalStatus, setFinalStatus]     = useState<string | null>(null);

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
    if (!window.confirm(
      `Évaluer et clôturer le pilote de ${professorName ?? "ce professeur"} (${period}) ?`,
    )) return;
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
    if (abandonNotes.trim().length < 10) {
      setToast({ type: "error", message: "Les notes de conclusion doivent contenir au moins 10 caractères." });
      return;
    }
    if (!window.confirm(
      `Abandonner le pilote de ${professorName ?? "ce professeur"} (${period}) ? Cette action est irréversible.`,
    )) return;
    setIsAbandoning(true);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/pilot/${runId}/abandon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: abandonNotes.trim() }),
      });
      const data = await res.json().catch(() => null) as Record<string, unknown> | null;
      if (!res.ok) {
        setToast({ type: "error", message: (data?.reason as string | undefined) ?? (data?.error as string | undefined) ?? "Erreur lors de l'abandon." });
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleClose}
          disabled={isClosing || isAbandoning || showAbandonForm}
          className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          {isClosing ? "Évaluation…" : "Évaluer & clôturer"}
        </button>
        <button
          type="button"
          onClick={() => { setShowAbandonForm((v) => !v); setToast(null); }}
          disabled={isClosing || isAbandoning}
          className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Abandonner
        </button>
        {toast && (
          <span className={toast.type === "success" ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>
            {toast.message}
          </span>
        )}
      </div>

      {showAbandonForm && (
        <div className="mt-2 space-y-2 rounded-lg border border-red-100 bg-red-50/50 p-3">
          <p className="text-xs font-medium text-red-800">
            Raison de l&apos;abandon <span className="text-red-500">*</span>
          </p>
          <textarea
            value={abandonNotes}
            onChange={(e) => setAbandonNotes(e.target.value)}
            placeholder="Décrivez la raison de l'abandon ou l'anomalie constatée (min. 10 caractères)…"
            rows={3}
            maxLength={1000}
            className="w-full rounded border border-red-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:border-red-400 focus:outline-none resize-y"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAbandon}
              disabled={isAbandoning || abandonNotes.trim().length < 10}
              className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isAbandoning ? "Abandon…" : "Confirmer l'abandon"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAbandonForm(false); setAbandonNotes(""); setToast(null); }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Annuler
            </button>
            <span className="ml-auto text-xs text-gray-400">{abandonNotes.length}/1000</span>
          </div>
        </div>
      )}
    </div>
  );
}
