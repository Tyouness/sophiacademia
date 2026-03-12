import DataTable from "@/components/DataTable";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminAuditPage() {
  const supabase = await createServerSupabaseClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select(
      "id, actor_id, action, entity, entity_id, payload, target_user_id, role_set, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (logs ?? []).map((log) => ({
    action: log.action,
    actor: (
      <span className="font-mono text-xs text-gray-600">
        {log.actor_id ?? "-"}
      </span>
    ),
    entity: log.entity ?? "-",
    entityId: (
      <span className="font-mono text-xs text-gray-600">
        {log.entity_id ?? log.target_user_id ?? "-"}
      </span>
    ),
    details: log.role_set ?? JSON.stringify(log.payload ?? {}),
    date: log.created_at,
  }));

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-gray-900">Audit</h2>
        <p className="mt-1 text-sm text-gray-500">
          Historique recent des actions administratives.
        </p>
      </div>

      <DataTable
        columns={[
          { key: "action", label: "Action" },
          { key: "actor", label: "Acteur" },
          { key: "entity", label: "Entite" },
          { key: "entityId", label: "Cible" },
          { key: "details", label: "Details" },
          { key: "date", label: "Date" },
        ]}
        rows={rows}
        emptyLabel="Aucun evenement."
      />
    </main>
  );
}
