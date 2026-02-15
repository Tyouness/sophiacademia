"use client";

import { useEffect, useMemo, useState } from "react";
import DataTable from "@/components/DataTable";

const statusLabels: Record<string, string> = {
  pending: "En attente",
  paid: "Paye",
  advance: "Acompte",
};

type CourseRow = {
  id: string;
  professor_id: string;
  subject: string | null;
  hours: number;
  courses_count: number;
  status: string;
  paid_at: string | null;
  created_at: string;
};

type ApiResponse = { data: CourseRow[] };

export default function FamilyCoursesPage() {
  const [period, setPeriod] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const tableRows = rows.map((row) => ({
    subject: row.subject ?? "-",
    hours: row.hours,
    count: row.courses_count,
    status: statusLabels[row.status] ?? row.status,
    created: new Date(row.created_at).toLocaleDateString("fr-FR"),
    paidAt: row.paid_at ? new Date(row.paid_at).toLocaleDateString("fr-FR") : "-",
  }));

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
            { key: "hours", label: "Heures" },
            { key: "count", label: "Seances" },
            { key: "status", label: "Statut" },
            { key: "created", label: "Declare" },
            { key: "paidAt", label: "Paye" },
          ]}
          rows={tableRows}
          emptyLabel="Aucun cours pour cette periode."
        />
      )}
    </main>
  );
}
