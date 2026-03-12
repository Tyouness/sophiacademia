"use client";

import { useMemo, useState } from "react";
import DataTable from "@/components/DataTable";
import RequestActions from "@/components/RequestActions";

type Person = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  addr1: string | null;
  addr2: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
};

type PlannedSessionSlot = {
  id: string;
  scheduled_at: string;
  duration_hours: number;
  status: string;
};

type RequestRow = {
  id: string;
  professor: Person | null;
  family: Person | null;
  subject: string | null;
  status: string;
  createdAt: string;
  // planned_sessions is the source of truth for planning display.
  // Populated from the planned_sessions table by the server pages.
  plannedSessions: PlannedSessionSlot[] | null;
};

type RequestListTableProps = {
  requests: RequestRow[];
  showId?: boolean;
  actionUrl?: string;
};

export default function RequestListTable({
  requests,
  showId = false,
  actionUrl,
}: RequestListTableProps) {
  const [selected, setSelected] = useState<Person | null>(null);
  const [selectedPlanning, setSelectedPlanning] = useState<RequestRow | null>(null);

  function formatSchedule(schedule: string[] | null) {
    if (!schedule || schedule.length === 0) {
      return "-";
    }
    return schedule
      .map((item) => {
        const date = new Date(item);
        if (Number.isNaN(date.getTime())) {
          return item;
        }
        return date.toLocaleString("fr-FR");
      })
      .join(" | ");
  }

  const rows = useMemo(() => {
    return requests.map((request) => {
      const professorName = request.professor?.full_name ?? request.professor?.email ?? "-";
      const familyName = request.family?.full_name ?? request.family?.email ?? "-";

      return {
        id: <span className="font-mono text-xs">{request.id}</span>,
        professor: request.professor ? (
          <button
            type="button"
            className="text-left text-sm font-semibold text-blue-600"
            onClick={() => setSelected(request.professor)}
          >
            {professorName}
          </button>
        ) : (
          professorName
        ),
        family: request.family ? (
          <button
            type="button"
            className="text-left text-sm font-semibold text-blue-600"
            onClick={() => setSelected(request.family)}
          >
            {familyName}
          </button>
        ) : (
          familyName
        ),
        subject: request.subject ?? "-",
        status: request.status,
        createdAt: request.createdAt,
        planning: (() => {
          const scheduled = (request.plannedSessions ?? []).filter(
            (ps) => ps.status === "scheduled",
          );
          if (scheduled.length === 0) {
            return <span className="text-xs text-gray-400">-</span>;
          }
          return (
            <button
              type="button"
              className="text-left text-sm font-semibold text-blue-600"
              onClick={() => setSelectedPlanning(request)}
            >
              {`${scheduled.length} / sem. - ${formatSchedule(scheduled.map((ps) => ps.scheduled_at))}`}
            </button>
          );
        })(),
        actions: (
          <RequestActions
            requestId={request.id}
            status={request.status}
            actionUrl={actionUrl}
          />
        ),
      };
    });
  }, [requests, actionUrl]);

  const columns = useMemo(() => {
    const base = [
      { key: "professor", label: "Professeur" },
      { key: "family", label: "Famille" },
      { key: "subject", label: "Matiere" },
      { key: "planning", label: "Planning" },
      { key: "status", label: "Statut" },
      { key: "createdAt", label: "Date" },
      { key: "actions", label: "Actions" },
    ];

    if (showId) {
      return [{ key: "id", label: "ID" }, ...base];
    }

    return base;
  }, [showId]);

  return (
    <div className="space-y-6">
      <DataTable columns={columns} rows={rows} emptyLabel="Aucune demande." />
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Details</h3>
                <p className="text-xs text-gray-500">{selected.full_name ?? "-"}</p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-gray-500"
                onClick={() => setSelected(null)}
              >
                Fermer
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-gray-700">
              <p>
                <span className="font-semibold">Email:</span> {selected.email ?? "-"}
              </p>
              <p>
                <span className="font-semibold">Telephone:</span> {selected.phone ?? "-"}
              </p>
              <p>
                <span className="font-semibold">Adresse:</span>
                {" "}
                {[selected.addr1, selected.addr2, selected.postcode, selected.city, selected.country]
                  .filter((part) => Boolean(part && String(part).trim()))
                  .join(", ") || "-"}
              </p>
              <p>
                <span className="font-semibold">Coordonnees:</span>
                {" "}
                {selected.lat != null && selected.lng != null
                  ? `${Number(selected.lat).toFixed(5)}, ${Number(selected.lng).toFixed(5)}`
                  : "-"}
              </p>
            </div>
          </div>
        </div>
      )}
      {selectedPlanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Planning professeur</h3>
                <p className="text-xs text-gray-500">
                  {selectedPlanning.family?.full_name ?? "Famille"}
                  {selectedPlanning.subject ? ` · ${selectedPlanning.subject}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-gray-500"
                onClick={() => setSelectedPlanning(null)}
              >
                Fermer
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-gray-700">
              <p>
                <span className="font-semibold">Professeur:</span>{" "}
                {selectedPlanning.professor?.full_name ?? selectedPlanning.professor?.email ?? "-"}
              </p>
              <p>
                <span className="font-semibold">Famille:</span>{" "}
                {selectedPlanning.family?.full_name ?? selectedPlanning.family?.email ?? "-"}
              </p>
              {(() => {
                const scheduled = (selectedPlanning.plannedSessions ?? []).filter(
                  (ps) => ps.status === "scheduled",
                );
                return (
                  <>
                    <p>
                      <span className="font-semibold">Cours / semaine:</span>{" "}
                      {scheduled.length > 0 ? scheduled.length : "-"}
                    </p>
                    <p>
                      <span className="font-semibold">Duree:</span>{" "}
                      {scheduled[0] != null ? `${scheduled[0].duration_hours} h` : "-"}
                    </p>
                    <div>
                      <p className="font-semibold">Dates choisies:</p>
                      <div className="mt-1 space-y-1">
                        {scheduled.length > 0
                          ? scheduled.map((ps, index) => {
                              const date = new Date(ps.scheduled_at);
                              const label = Number.isNaN(date.getTime())
                                ? ps.scheduled_at
                                : date.toLocaleString("fr-FR");
                              return (
                                <p key={`${selectedPlanning.id}-${index}`} className="text-sm">
                                  {label}
                                </p>
                              );
                            })
                          : <span>-</span>}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
