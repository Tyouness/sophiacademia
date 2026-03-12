"use client";

import { useEffect, useMemo, useState } from "react";
import DataTable from "@/components/DataTable";

type CourseRow = {
  id: string;
  family_id: string;
  child_id: string | null;
  subject: string | null;
  hours: number;
  courses_count: number;
  status: string;
  approval_status: string;
  paid_at: string | null;
  created_at: string;
  course_date?: string | null;
  prof_hourly: number | null;
  prof_total: number | null;
  child?: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
  family?:
    | {
        full_name: string | null;
        addr1: string | null;
        addr2: string | null;
        postcode: string | null;
        city: string | null;
        country: string | null;
        lat: number | null;
        lng: number | null;
      }
    | {
        full_name: string | null;
        addr1: string | null;
        addr2: string | null;
        postcode: string | null;
        city: string | null;
        country: string | null;
        lat: number | null;
        lng: number | null;
      }[]
    | null;
};

type ApiResponse = { data: CourseRow[] };

type PlannedSessionSlot = {
  id: string;
  scheduled_at: string;
  duration_hours: number;
  status: string;
};

type RequestRow = {
  id: string;
  family_id: string;
  child_id: string | null;
  subject: string | null;
  status: string;
  planned_sessions?: PlannedSessionSlot[] | null;
  child?: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
  family?:
    | {
        full_name: string | null;
        addr1: string | null;
        addr2: string | null;
        postcode: string | null;
        city: string | null;
        country: string | null;
      }
    | {
        full_name: string | null;
        addr1: string | null;
        addr2: string | null;
        postcode: string | null;
        city: string | null;
        country: string | null;
      }[]
    | null;
};

type RequestResponse = { data: RequestRow[] };

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

function toLocalInput(value: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default function ProfessorCoursesPage() {
  const [period, setPeriod] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRequests, setActiveRequests] = useState<RequestRow[]>([]);
  const [activeLoading, setActiveLoading] = useState(true);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestRow | null>(null);
  const [declareHours, setDeclareHours] = useState("1");
  const [declareDate, setDeclareDate] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<{
    id: string;
    familyName: string;
    addressLine: string;
    lat: number;
    lng: number;
  } | null>(null);

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

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/professor/courses?${query}`);
      if (!response.ok) {
        throw new Error("Failed to load");
      }
      const data = (await response.json()) as ApiResponse;
      setRows(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur reseau");
    } finally {
      setLoading(false);
    }
  }

  async function loadActiveRequests() {
    setActiveLoading(true);
    setActiveError(null);
    try {
      const response = await fetch("/api/professor/requests");
      if (!response.ok) {
        throw new Error("Failed to load");
      }
      const data = (await response.json()) as RequestResponse;
      const approved = (data.data ?? []).filter((item) => item.status === "approved");
      setActiveRequests(approved);
    } catch (err) {
      setActiveError(err instanceof Error ? err.message : "Erreur reseau");
    } finally {
      setActiveLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [query]);

  useEffect(() => {
    loadActiveRequests();
  }, []);

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

  function openDeclare(request: RequestRow) {
    const firstScheduled = (request.planned_sessions ?? []).find(
      (ps) => ps.status === "scheduled",
    );
    const defaultDate = firstScheduled?.scheduled_at ?? new Date().toISOString();
    setSelectedRequest(request);
    setDeclareHours(String(firstScheduled?.duration_hours ?? 1));
    setDeclareDate(toLocalInput(defaultDate));
    setSubmitError(null);
  }

  async function handleDeclare() {
    if (!selectedRequest) {
      return;
    }
    const hours = Number(declareHours);
    if (!declareDate) {
      setSubmitError("Merci de renseigner la date du cours.");
      return;
    }
    if (!Number.isFinite(hours) || hours <= 0) {
      setSubmitError("Merci de renseigner le nombre d'heures.");
      return;
    }
    const parsedDate = new Date(declareDate);
    if (Number.isNaN(parsedDate.getTime())) {
      setSubmitError("Date invalide.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/professor/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyId: selectedRequest.family_id,
          subject: selectedRequest.subject,
          childId: selectedRequest.child_id ?? undefined,
          hours,
          coursesCount: 1,
          courseDate: parsedDate.toISOString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setSubmitError(data?.error ?? "Erreur");
        return;
      }

      await load();
      setSelectedRequest(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erreur reseau");
    } finally {
      setSubmitting(false);
    }
  }

  const tableRows = rows.map((row) => ({
    family: (() => {
      const family = Array.isArray(row.family) ? row.family[0] : row.family;
      return family?.full_name ?? row.family_id;
    })(),
    subject: row.subject ?? "-",
    hours: row.hours,
    count: row.courses_count,
    status: statusLabels[row.status] ?? row.status,
    approval: approvalLabels[row.approval_status] ?? row.approval_status,
    profPay: row.prof_total != null ? `${row.prof_total.toFixed(2)} EUR` : "-",
    created: new Date(row.course_date ?? row.created_at).toLocaleDateString("fr-FR"),
    paidAt: row.paid_at ? new Date(row.paid_at).toLocaleDateString("fr-FR") : "-",
    actions: (() => {
      const family = Array.isArray(row.family) ? row.family[0] : row.family;
      if (!family?.lat || !family?.lng) {
        return <span className="text-xs text-gray-400">-</span>;
      }
      const addressLine = [
        family.addr1,
        family.addr2,
        family.postcode,
        family.city,
        family.country,
      ]
        .filter((part) => Boolean(part && String(part).trim()))
        .join(", ");
      return (
        <button
          type="button"
          className="rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600"
          onClick={() =>
            setSelectedCourse({
              id: row.id,
              familyName: family.full_name ?? row.family_id,
              addressLine: addressLine || "Adresse indisponible",
              lat: Number(family.lat),
              lng: Number(family.lng),
            })
          }
        >
          Voir l'adresse
        </button>
      );
    })(),
  }));

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-gray-900">Cours actifs</h2>
        <p className="mt-1 text-sm text-gray-500">
          Les demandes approuvees apparaissent ici pour declarer chaque seance.
        </p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-md">
        {activeError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {activeError}
          </div>
        ) : null}
        {activeLoading ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : activeRequests.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun cours approuve pour le moment.</p>
        ) : (
          <div className="space-y-4">
            {activeRequests.map((request) => {
              const family = Array.isArray(request.family)
                ? request.family[0]
                : request.family;
              const addressLine = [
                family?.addr1,
                family?.addr2,
                family?.postcode,
                family?.city,
                family?.country,
              ]
                .filter((part) => Boolean(part && String(part).trim()))
                .join(", ");
              return (
                <div
                  key={request.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {family?.full_name ?? request.family_id}
                      </h3>
                      <p className="text-xs text-slate-600">
                        {request.subject ?? "Matiere"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {addressLine || "Adresse indisponible"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Planning:{" "}
                        {formatSchedule(
                          (request.planned_sessions ?? [])
                            .filter((ps) => ps.status === "scheduled")
                            .map((ps) => ps.scheduled_at),
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <button
                        type="button"
                        className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
                        onClick={() => openDeclare(request)}
                      >
                        Declarer un cours
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
            { key: "family", label: "Famille" },
            { key: "subject", label: "Matiere" },
            { key: "hours", label: "Heures" },
            { key: "count", label: "Seances" },
            { key: "status", label: "Statut" },
            { key: "approval", label: "Validation" },
            { key: "profPay", label: "Paiement prof" },
            { key: "created", label: "Declare" },
            { key: "paidAt", label: "Paye" },
            { key: "actions", label: "Navigation" },
          ]}
          rows={tableRows}
          emptyLabel="Aucun cours pour cette periode."
        />
      )}

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                {(() => {
                  const family = Array.isArray(selectedRequest.family)
                    ? selectedRequest.family[0]
                    : selectedRequest.family;
                  const familyName = family?.full_name ?? selectedRequest.family_id;
                  return (
                    <>
                      <h3 className="text-base font-semibold text-gray-900">
                        Declarer un cours
                      </h3>
                      <p className="text-xs text-gray-500">
                        {familyName}
                        {selectedRequest.subject ? ` · ${selectedRequest.subject}` : ""}
                      </p>
                    </>
                  );
                })()}
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-gray-500"
                onClick={() => setSelectedRequest(null)}
              >
                Fermer
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex flex-col text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                Date du cours
                <input
                  type="datetime-local"
                  value={declareDate}
                  onChange={(event) => setDeclareDate(event.target.value)}
                  className="mt-2 rounded-full border border-blue-100 px-4 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                Heures
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={declareHours}
                  onChange={(event) => setDeclareHours(event.target.value)}
                  className="mt-2 rounded-full border border-blue-100 px-4 py-2 text-sm"
                />
              </label>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Planning propose:{" "}
              {formatSchedule(
                (selectedRequest.planned_sessions ?? [])
                  .filter((ps) => ps.status === "scheduled")
                  .map((ps) => ps.scheduled_at),
              )}
            </p>

            {submitError ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {submitError}
              </div>
            ) : null}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
                onClick={handleDeclare}
                disabled={submitting}
              >
                {submitting ? "Envoi..." : "Declarer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Adresse de la famille</h3>
                <p className="text-xs text-gray-500">{selectedCourse.familyName}</p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-gray-500"
                onClick={() => setSelectedCourse(null)}
              >
                Fermer
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <p>{selectedCourse.addressLine}</p>
              <div className="flex flex-wrap gap-3 text-xs">
                <a
                  className="rounded-full border border-blue-200 px-3 py-1 font-semibold text-blue-600"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedCourse.lat},${selectedCourse.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ouvrir Google Maps
                </a>
                <a
                  className="rounded-full border border-blue-200 px-3 py-1 font-semibold text-blue-600"
                  href={`https://waze.com/ul?ll=${selectedCourse.lat},${selectedCourse.lng}&navigate=yes`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ouvrir Waze
                </a>
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-100">
                <iframe
                  title="Carte famille"
                  src={`https://www.google.com/maps?q=${selectedCourse.lat},${selectedCourse.lng}&z=15&output=embed`}
                  className="h-64 w-full"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
