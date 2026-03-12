"use client";

import { useEffect, useMemo, useState } from "react";
import DataTable from "@/components/DataTable";

const statusLabels: Record<string, string> = {
  pending: "En attente",
  paid: "Soumis URSSAF",
  advance: "Acompte",
  paid_by_urssaf: "Paye URSSAF",
};

const approvalLabels: Record<string, string> = {
  family_pending: "Confirmation requise",
  family_confirmed: "Confirme",
  family_update_requested: "Modification demandee",
  staff_canceled: "Annule",
};

type CourseRow = {
  id: string;
  professor_id: string;
  child_id: string | null;
  subject: string | null;
  hours: number;
  courses_count: number;
  status: string;
  approval_status: string;
  family_response_deadline: string | null;
  family_update_note: string | null;
  paid_at: string | null;
  created_at: string;
  course_date?: string | null;
  distance_km: number | null;
  prof_hourly: number | null;
  prof_total: number | null;
  child?: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
};

type ApiResponse = { data: CourseRow[] };

export default function FamilyCoursesPage() {
  const [period, setPeriod] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CourseRow | null>(null);
  const [note, setNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (period) {
      params.set("period", period);
    }
    if (status) {
      params.set("status", status);
    }
    return params.toString();
  }, [period, status]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/family/courses?${query}`);
        if (!response.ok) {
          throw new Error("Failed to load");
        }
        const data = (await response.json()) as ApiResponse;
        if (!cancelled) {
          setRows(data.data ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erreur reseau");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [query]);

  async function respond(action: "accept" | "request_change") {
    if (!selected) {
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch("/api/family/courses/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selected.id,
          action,
          note: action === "request_change" ? note : undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Erreur");
      }
      setSelected(null);
      setNote("");
      const responseRefresh = await fetch(`/api/family/courses?${query}`);
      if (responseRefresh.ok) {
        const data = (await responseRefresh.json()) as ApiResponse;
        setRows(data.data ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur reseau");
    } finally {
      setActionLoading(false);
    }
  }

  const tableRows = rows.map((row) => {
    const child = Array.isArray(row.child) ? row.child[0] : row.child;
    const childName = child ? `${child.first_name ?? ""} ${child.last_name ?? ""}`.trim() : "-";
    return ({
    subject: row.subject ?? "-",
    child: childName,
    hours: row.hours,
    count: row.courses_count,
    status: statusLabels[row.status] ?? row.status,
    approval: approvalLabels[row.approval_status] ?? row.approval_status,
    created: new Date(row.course_date ?? row.created_at).toLocaleDateString("fr-FR"),
    paidAt: row.paid_at ? new Date(row.paid_at).toLocaleDateString("fr-FR") : "-",
    actions:
      row.approval_status === "family_pending" ? (
        <button
          type="button"
          className="rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600"
          onClick={() => setSelected(row)}
        >
          Repondre
        </button>
      ) : (
        <span className="text-xs text-gray-400">-</span>
      ),
  });});

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-gray-900">Cours</h2>
        <p className="mt-1 text-sm text-gray-500">
          Historique des cours declares et regles.
        </p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-md">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
            Periode
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="mt-2 rounded-full border border-blue-100 px-4 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
            Statut
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm"
            >
              <option value="">Tous</option>
              <option value="pending">En attente</option>
              <option value="paid">Paye</option>
              <option value="advance">Acompte</option>
              <option value="paid_by_urssaf">Paye URSSAF</option>
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-600">
          Chargement...
        </div>
      ) : (
        <DataTable
          columns={[
            { key: "subject", label: "Matiere" },
            { key: "child", label: "Enfant" },
            { key: "created", label: "Date" },
            { key: "hours", label: "Heures" },
            { key: "count", label: "Seances" },
            { key: "status", label: "Statut" },
            { key: "approval", label: "Validation" },
            { key: "paidAt", label: "Paye" },
            { key: "actions", label: "Actions" },
          ]}
          rows={tableRows}
          emptyLabel="Aucun cours pour cette periode."
        />
      )}

        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Confirmation du cours
                  </h3>
                  <p className="text-xs text-gray-500">
                    {selected.subject ?? "Cours"} · {selected.hours}h
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm font-semibold text-gray-500"
                  onClick={() => setSelected(null)}
                >
                  Fermer
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <p>
                  Merci de confirmer sous 48h. Vous pouvez demander une modification au
                  staff.
                </p>
                <textarea
                  name="note"
                  placeholder="Demande de modification (optionnel)"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="w-full rounded-2xl border border-blue-100 px-4 py-2 text-sm"
                  rows={3}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
                    onClick={() => respond("accept")}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Envoi..." : "Accepter"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-blue-200 px-4 py-2 text-xs font-semibold text-blue-600"
                    onClick={() => respond("request_change")}
                    disabled={actionLoading}
                  >
                    Demander modification
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </main>
  );
}
