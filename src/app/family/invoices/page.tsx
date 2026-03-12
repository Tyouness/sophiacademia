"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";

type InvoiceRow = {
  id: string;
  issue_date: string | null;
  period_start: string | null;
  period_end: string | null;
  total_ttc: number;
  status: "draft" | "issued" | "paid" | "cancelled";
  number: string | null;
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
    number: row.number ?? "-",
    issueDate: row.issue_date
      ? new Date(row.issue_date).toLocaleDateString("fr-FR")
      : new Date(row.created_at).toLocaleDateString("fr-FR"),
    period: row.period_start
      ? `${new Date(row.period_start).toLocaleDateString("fr-FR")}${
          row.period_end ? ` - ${new Date(row.period_end).toLocaleDateString("fr-FR")}` : ""
        }`
      : "-",
    status: row.status,
    total: `${Number(row.total_ttc ?? 0).toFixed(2)} EUR`,
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
          Retrouvez vos factures de seances.
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
            { key: "number", label: "Numero" },
            { key: "issueDate", label: "Emission" },
            { key: "period", label: "Periode" },
            { key: "status", label: "Statut" },
            { key: "total", label: "Total" },
            { key: "pdf", label: "PDF" },
          ]}
          rows={tableRows}
          emptyLabel="Aucune facture pour le moment."
        />
      )}
    </main>
  );
}
