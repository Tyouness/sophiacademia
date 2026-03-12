import DataTable from "@/components/DataTable";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminPayslipsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: payslips } = await supabase
    .from("payslips")
    .select("id, number, professor_id, period, total_net, total_indemn_km, status, created_at, professor:profiles!payslips_professor_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (payslips ?? []).map((payslip) => ({
    id: <span className="font-mono text-xs">{payslip.id}</span>,
    number: payslip.number ?? "-",
    professor: (Array.isArray(payslip.professor) ? payslip.professor[0] : payslip.professor)?.full_name ?? payslip.professor_id,
    period: payslip.period,
    net: `${Number(payslip.total_net ?? 0).toFixed(2)} EUR`,
    indemn: `${Number(payslip.total_indemn_km ?? 0).toFixed(2)} EUR`,
    status: payslip.status,
  }));

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-gray-900">Bulletins</h2>
        <p className="mt-1 text-sm text-gray-500">Gestion des bulletins professeurs.</p>
      </div>

      <DataTable
        columns={[
          { key: "id", label: "ID" },
          { key: "number", label: "Numero" },
          { key: "professor", label: "Professeur" },
          { key: "period", label: "Periode" },
          { key: "net", label: "Total net" },
          { key: "indemn", label: "Indemn. km" },
          { key: "status", label: "Statut" },
        ]}
        rows={rows}
        emptyLabel="Aucun bulletin."
      />
    </main>
  );
}
