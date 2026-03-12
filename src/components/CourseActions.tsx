"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";

type CourseActionsProps = {
  courseId: string;
  status: string;
  approvalStatus: string;
  hours: number;
  coursesCount: number;
  familyId: string;
  subject: string | null;
};

export default function CourseActions({
  courseId,
  status,
  approvalStatus,
  hours,
  coursesCount,
  familyId,
  subject,
}: CourseActionsProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    hours: String(hours),
    coursesCount: String(coursesCount),
    familyId,
    subject: subject ?? "",
    note: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  async function markPaid() {
    await fetch("/api/staff/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_paid", courseId }),
    });
    router.refresh();
  }

  async function submitCorrection() {
    setIsSaving(true);
    await fetch("/api/staff/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "correct",
        courseId,
        hours: Number(form.hours),
        coursesCount: Number(form.coursesCount),
        familyId: form.familyId,
        subject: form.subject || undefined,
        note: form.note || undefined,
      }),
    });
    setIsSaving(false);
    setIsOpen(false);
    router.refresh();
  }

  async function submitCancel() {
    await fetch("/api/staff/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", courseId, note: form.note || undefined }),
    });
    setIsOpen(false);
    router.refresh();
  }

  if (status === "paid") {
    return <span className="text-xs text-gray-400">Deja paye</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {approvalStatus === "family_confirmed" ? (
        <ConfirmDialog
          title="Marquer comme paye"
          description="Le statut passera a paye immediatement."
          triggerLabel="Marquer paye"
          confirmLabel="Confirmer"
          onConfirm={markPaid}
        />
      ) : (
        <span className="text-xs text-gray-400">En attente famille</span>
      )}
      <button
        type="button"
        className="rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600"
        onClick={() => setIsOpen(true)}
      >
        Modifier
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Corriger une declaration
                </h3>
                <p className="text-xs text-gray-500">Cours {courseId}</p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-gray-500"
                onClick={() => setIsOpen(false)}
              >
                Fermer
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <input
                name="familyId"
                placeholder="Family ID"
                value={form.familyId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, familyId: event.target.value }))
                }
                className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
              />
              <input
                name="subject"
                placeholder="Matiere"
                value={form.subject}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, subject: event.target.value }))
                }
                className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="hours"
                  type="number"
                  step="0.25"
                  min="0.5"
                  placeholder="Heures"
                  value={form.hours}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, hours: event.target.value }))
                  }
                  className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
                />
                <input
                  name="coursesCount"
                  type="number"
                  min="1"
                  placeholder="Seances"
                  value={form.coursesCount}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, coursesCount: event.target.value }))
                  }
                  className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
                />
              </div>
              <textarea
                name="note"
                placeholder="Note staff (optionnel)"
                value={form.note}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, note: event.target.value }))
                }
                className="w-full rounded-2xl border border-blue-100 px-4 py-2 text-sm"
                rows={3}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={submitCorrection}
                  className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
                  disabled={isSaving}
                >
                  {isSaving ? "Enregistrement..." : "Enregistrer"}
                </button>
                <ConfirmDialog
                  title="Annuler la declaration"
                  description="Le cours sera annule et ne sera pas paye."
                  triggerLabel="Annuler"
                  confirmLabel="Confirmer"
                  variant="danger"
                  onConfirm={submitCancel}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
