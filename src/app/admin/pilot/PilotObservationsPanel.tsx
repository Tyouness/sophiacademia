"use client";

/**
 * PilotObservationsPanel — URSSAF-19
 *
 * Panneau d'observations terrain pour un pilote en cours.
 * Permet à l'admin de consigner ce qu'il observe pendant l'exécution.
 * Appelle PATCH /api/admin/pilot/[id]/notes.
 */

import { useState } from "react";

type Props = {
  runId: string;
  initialNotes: string | null;
};

export default function PilotObservationsPanel({
  runId,
  initialNotes,
}: Props) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch(`/api/admin/pilot/${runId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.reason ?? "Erreur lors de la sauvegarde.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-blue-100 pt-3">
      <p className="text-xs font-medium text-gray-600">
        Observations terrain
      </p>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        placeholder="Notez ici ce que vous observez pendant le pilote : artefacts créés, anomalies, comportements inattendus…"
        rows={3}
        maxLength={2000}
        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 placeholder-gray-400 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-y"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Sauvegarde…" : "Sauvegarder"}
        </button>
        {saved && (
          <span className="text-xs font-medium text-emerald-600">
            ✓ Observations sauvegardées
          </span>
        )}
        {error && (
          <span className="text-xs text-red-600">{error}</span>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {notes.length}/2000
        </span>
      </div>
    </div>
  );
}
