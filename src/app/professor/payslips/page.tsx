"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";

type PayslipRow = {
  id: string;
  period: string;
  number: string | null;
  period_start: string | null;
  period_end: string | null;
  total_net: number | null;
  total_indemn_km: number | null;
  status: "pending" | "paid";
  pdf_url: string | null;
  created_at: string;
};

type ApiResponse = { data: PayslipRow[] };

export default function ProfessorPayslipsPage() {
  const [rows, setRows] = useState<PayslipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/professor/payslips");
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
  }, []);

  const tableRows = rows.map((row) => ({
    period: row.period,
    number: row.number ?? "-",
    range:
      row.period_start && row.period_end
        ? `${new Date(row.period_start).toLocaleDateString("fr-FR")} - ${new Date(row.period_end).toLocaleDateString("fr-FR")}`
        : "-",
    net: `${Number(row.total_net ?? 0).toFixed(2)} EUR`,
    indemn: `${Number(row.total_indemn_km ?? 0).toFixed(2)} EUR`,
    status: row.status,
    pdf: row.pdf_url ? (
      <a
        href={row.pdf_url}
        className="text-blue-600 underline"
        target="_blank"
        rel="noreferrer"
      >
        PDF
      </a>
    ) : (
      "-"
    ),
  }));

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-gray-900">Bulletins</h2>
        <p className="mt-1 text-sm text-gray-500">
          Historique des bulletins de paie.
        </p>
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
            { key: "period", label: "Periode" },
            { key: "number", label: "Numero" },
            { key: "range", label: "Du / Au" },
            { key: "net", label: "Total net" },
            { key: "indemn", label: "Indemn. km" },
            { key: "status", label: "Statut" },
            { key: "pdf", label: "PDF" },
          ]}
          rows={tableRows}
          emptyLabel="Aucun bulletin pour le moment."
        />
      )}
    </main>
  );
}
