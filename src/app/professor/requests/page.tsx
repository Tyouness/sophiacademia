"use client";

import { useEffect, useState } from "react";

type ToastState = { type: "success" | "error"; message: string } | null;

type PlannedSessionSlot = {
  id: string;
  scheduled_at: string;
  duration_hours: number;
  status: string;
};

type RequestRow = {
  id: string;
  family_id: string;
  child_id: string | null;
  subject: string | null;
  status: string;
  planned_sessions?: PlannedSessionSlot[] | null;
  child?: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
  family?:
    | {
        full_name: string | null;
        phone: string | null;
        addr1: string | null;
        addr2: string | null;
        postcode: string | null;
        city: string | null;
        country: string | null;
      }
    | {
        full_name: string | null;
        phone: string | null;
        addr1: string | null;
        addr2: string | null;
        postcode: string | null;
        city: string | null;
        country: string | null;
      }[]
    | null;
};

type ApiResponse = { data: RequestRow[] };

type Draft = {
  weeklySessions: string;
  sessionHours: string;
  weeklySchedule: string[];
};

const statusLabels: Record<string, string> = {
  coords_sent: "Coordonnees envoyees",
  approved: "Approuve",
};

function toLocalInput(value: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toLocalSchedule(values: string[] | null, fallback: string | null) {
  const fromArray = Array.isArray(values) ? values.map((item) => toLocalInput(item)) : [];
  if (fromArray.length > 0) {
    return fromArray;
  }
  const fallbackValue = toLocalInput(fallback);
  return fallbackValue ? [fallbackValue] : [];
}

export default function ProfessorRequestsPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setToast(null);
    try {
      const response = await fetch("/api/professor/requests");
      if (!response.ok) {
        throw new Error("Failed to load");
      }
      const data = (await response.json()) as ApiResponse;
      const nextRows = data.data ?? [];
      setRows(nextRows);
      const nextDrafts: Record<string, Draft> = {};
      nextRows.forEach((row) => {
        const activePlanned = (row.planned_sessions ?? []).filter(
          (ps) => ps.status === "scheduled",
        );
        const sessionsCount = activePlanned.length > 0 ? activePlanned.length : 1;
        const weeklySchedule = activePlanned.map((ps) => toLocalInput(ps.scheduled_at));
        const sessionHours = String(activePlanned[0]?.duration_hours ?? 1);
        const normalizedSchedule = weeklySchedule.slice(0, sessionsCount);
        while (normalizedSchedule.length < sessionsCount) {
          normalizedSchedule.push("");
        }
        nextDrafts[row.id] = {
          weeklySessions: String(sessionsCount),
          sessionHours,
          weeklySchedule: normalizedSchedule,
        };
      });
      setDrafts(nextDrafts);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur reseau";
      setToast({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  function updateWeeklySessions(id: string, value: string) {
    const count = Math.max(1, Math.min(7, Number(value)));
    if (!Number.isFinite(count)) {
      updateDraft(id, { weeklySessions: value });
      return;
    }
    setDrafts((prev) => {
      const current = prev[id];
      const schedule = current?.weeklySchedule ?? [];
      const nextSchedule = schedule.slice(0, count);
      while (nextSchedule.length < count) {
        nextSchedule.push("");
      }
      return {
        ...prev,
        [id]: {
          ...current,
          weeklySessions: String(count),
          weeklySchedule: nextSchedule,
        },
      };
    });
  }

  async function handleSave(row: RequestRow) {
    const draft = drafts[row.id];
    const weeklySessions = Number(draft.weeklySessions);
    const sessionHours = Number(draft.sessionHours);
    if (!draft?.weeklySchedule?.length) {
      setToast({ type: "error", message: "Merci de renseigner les dates des cours." });
      return;
    }
    if (!Number.isFinite(weeklySessions) || !Number.isFinite(sessionHours)) {
      setToast({ type: "error", message: "Merci de renseigner la cadence." });
      return;
    }
    if (weeklySessions !== draft.weeklySchedule.length) {
      setToast({ type: "error", message: "Merci de renseigner toutes les dates." });
      return;
    }
    const scheduleIso = draft.weeklySchedule.map((value) => {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }
      return parsed.toISOString();
    });
    if (scheduleIso.some((value) => !value)) {
      setToast({ type: "error", message: "Date invalide." });
      return;
    }

    setSavingId(row.id);
    setToast(null);
    try {
      const response = await fetch("/api/professor/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: row.id,
          weeklySchedule: scheduleIso,
          weeklySessions,
          sessionHours,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Erreur");
      }

      setRows((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                planned_sessions: (scheduleIso as string[]).map((ts) => ({
                  id: "",
                  scheduled_at: ts,
                  duration_hours: sessionHours,
                  status: "scheduled" as const,
                })),
              }
            : item,
        ),
      );
      setToast({ type: "success", message: "Planning enregistre." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur reseau";
      setToast({ type: "error", message });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-gray-900">Planifier le premier cours</h2>
        <p className="mt-1 text-sm text-gray-500">
          Renseignez la date et la cadence des cours apres reception des coordonnees.
        </p>
      </div>

      {toast ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune demande en attente de planning.</p>
        ) : (
          rows.map((row) => {
            const family = Array.isArray(row.family) ? row.family[0] : row.family;
            const addressLine = [
              family?.addr1,
              family?.addr2,
              family?.postcode,
              family?.city,
              family?.country,
            ]
              .filter((part) => Boolean(part && String(part).trim()))
              .join(", ");
            const draft = drafts[row.id];

            return (
              <div key={row.id} className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {family?.full_name ?? row.family_id}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      {row.subject ?? "Matiere"} · {statusLabels[row.status] ?? row.status}
                      {(() => { const ch = Array.isArray(row.child) ? row.child[0] : row.child; return ch ? ` · ${ch.first_name ?? ""} ${ch.last_name ?? ""}`.trim() : null; })()}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {family?.phone ? `Telephone: ${family.phone}` : "Telephone indisponible"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {addressLine || "Adresse indisponible"}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500">
                    <span className="rounded-full bg-slate-50 px-3 py-1">
                      {draft?.weeklySessions ?? "1"} cours / semaine
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="flex flex-col text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Cours / semaine
                    <input
                      type="number"
                      min="1"
                      max="7"
                      value={draft?.weeklySessions ?? "1"}
                      onChange={(event) => updateWeeklySessions(row.id, event.target.value)}
                      className="mt-2 rounded-full border border-blue-100 px-4 py-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Duree (heures)
                    <input
                      type="number"
                      min="0.5"
                      max="6"
                      step="0.5"
                      value={draft?.sessionHours ?? "1"}
                      onChange={(event) => updateDraft(row.id, { sessionHours: event.target.value })}
                      className="mt-2 rounded-full border border-blue-100 px-4 py-2 text-sm"
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {(draft?.weeklySchedule ?? []).map((value, index) => (
                    <label
                      key={`${row.id}-slot-${index}`}
                      className="flex flex-col text-xs font-semibold uppercase tracking-[0.2em] text-gray-500"
                    >
                      Date cours {index + 1}
                      <input
                        type="datetime-local"
                        value={value}
                        onChange={(event) => {
                          const next = [...(draft?.weeklySchedule ?? [])];
                          next[index] = event.target.value;
                          updateDraft(row.id, { weeklySchedule: next });
                        }}
                        className="mt-2 rounded-full border border-blue-100 px-4 py-2 text-sm"
                      />
                    </label>
                  ))}
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Cette cadence sera appliquee pour les semaines suivantes.
                </p>

                <div className="mt-4">
                  <button
                    type="button"
                    className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
                    onClick={() => handleSave(row)}
                    disabled={savingId === row.id}
                  >
                    {savingId === row.id ? "Envoi..." : "Enregistrer"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
