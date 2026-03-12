import DataTable from "@/components/DataTable";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function StaffInvoicesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, number, family_id, issue_date, total_ttc, status, created_at, family:profiles!invoices_family_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (invoices ?? []).map((invoice) => ({
    id: <span className="font-mono text-xs">{invoice.id}</span>,
    number: invoice.number ?? "-",
    family: (Array.isArray(invoice.family) ? invoice.family[0] : invoice.family)?.full_name ?? invoice.family_id,
    issueDate: invoice.issue_date
      ? new Date(invoice.issue_date).toLocaleDateString("fr-FR")
      : "-",
    total: `${Number(invoice.total_ttc ?? 0).toFixed(2)} EUR`,
    status: invoice.status,
  }));

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-gray-900">Factures</h2>
        <p className="mt-1 text-sm text-gray-500">Suivi des factures seance famille.</p>
      </div>

      <DataTable
        columns={[
          { key: "id", label: "ID" },
          { key: "number", label: "Numero" },
          { key: "family", label: "Famille" },
          { key: "issueDate", label: "Emission" },
          { key: "total", label: "Total" },
          { key: "status", label: "Statut" },
        ]}
        rows={rows}
        emptyLabel="Aucune facture."
      />
    </main>
  );
}
