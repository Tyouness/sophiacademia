"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";

type InvoiceRow = {
  id: string;
  period: string;
  total: number;
  number: string | null;
  hours: number | null;
  pdf_url: string | null;
  created_at: string;
};

type ApiResponse = { data: InvoiceRow[] };

export default function FamilyInvoicesPage() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/family/invoices");
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
    hours: row.hours ?? "-",
    total: `${row.total.toFixed(2)} EUR`,
    created: new Date(row.created_at).toLocaleDateString("fr-FR"),
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
        <h2 className="text-lg font-semibold text-gray-900">Factures</h2>
        <p className="mt-1 text-sm text-gray-500">
          Retrouvez vos factures mensuelles.
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
            { key: "hours", label: "Heures" },
            { key: "total", label: "Total" },
            { key: "created", label: "Cree" },
            { key: "pdf", label: "PDF" },
          ]}
          rows={tableRows}
          emptyLabel="Aucune facture pour le moment."
        />
      )}
    </main>
  );
}
