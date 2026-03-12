import RequestListTable from "@/components/RequestListTable";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminRequestsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: requests } = await supabase
    .from("requests")
    .select(
      "id, professor_id, family_id, subject, status, rejected_at, ended_at, end_reason, created_at, professor:profiles!requests_professor_id_fkey(full_name, email, phone, addr1, addr2, postcode, city, country, lat, lng), family:profiles!requests_family_id_fkey(full_name, email, phone, addr1, addr2, postcode, city, country, lat, lng)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  // Secondary query: load all planned_sessions for these requests in one round-trip.
  const requestIds = (requests ?? []).map((r) => r.id);
  type PlannedRow = { request_id: string; id: string; scheduled_at: string; duration_hours: number; status: string };
  const plannedByRequest: Record<string, PlannedRow[]> = {};
  if (requestIds.length > 0) {
    const { data: plannedSessions } = await supabase
      .from("planned_sessions")
      .select("id, request_id, scheduled_at, duration_hours, status")
      .in("request_id", requestIds)
      .order("scheduled_at", { ascending: true });
    for (const ps of plannedSessions ?? []) {
      const p = ps as PlannedRow;
      if (!plannedByRequest[p.request_id]) {
        plannedByRequest[p.request_id] = [];
      }
      plannedByRequest[p.request_id].push(p);
    }
  }

  const rows = (requests ?? []).map((request) => {
    const professor = Array.isArray(request.professor)
      ? request.professor[0]
      : request.professor;
    const family = Array.isArray(request.family) ? request.family[0] : request.family;

    return {
      id: request.id,
      professor: professor
        ? {
            id: request.professor_id,
            full_name: professor.full_name ?? null,
            email: professor.email ?? null,
            phone: professor.phone ?? null,
            addr1: professor.addr1 ?? null,
            addr2: professor.addr2 ?? null,
            postcode: professor.postcode ?? null,
            city: professor.city ?? null,
            country: professor.country ?? null,
            lat: professor.lat ?? null,
            lng: professor.lng ?? null,
          }
        : null,
      family: family
        ? {
            id: request.family_id,
            full_name: family.full_name ?? null,
            email: family.email ?? null,
            phone: family.phone ?? null,
            addr1: family.addr1 ?? null,
            addr2: family.addr2 ?? null,
            postcode: family.postcode ?? null,
            city: family.city ?? null,
            country: family.country ?? null,
            lat: family.lat ?? null,
            lng: family.lng ?? null,
          }
        : null,
      subject: request.subject ?? null,
      status: request.status,
      createdAt: request.created_at,
      plannedSessions: plannedByRequest[request.id] ?? null,
    };
  });

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-gray-900">Demandes</h2>
        <p className="mt-1 text-sm text-gray-500">
          Suivi global des options et validations.
        </p>
      </div>

      <RequestListTable
        requests={rows}
        showId
        actionUrl="/api/staff/requests"
      />
    </main>
  );
}
