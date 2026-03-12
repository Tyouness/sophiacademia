"use client";

import { useState } from "react";

type ToastState = { type: "success" | "error"; message: string } | null;

export type FamilyDossierPanelProps = {
  userId: string;
  repFirst: string | null;
  repLast: string | null;
  repPhone: string | null;
  fiscalConsent: boolean;
  mandateConsent: boolean;
  legalNoticeAccepted: boolean;
};

export default function FamilyDossierPanel({
  userId,
  repFirst,
  repLast,
  repPhone,
  fiscalConsent,
  mandateConsent,
  legalNoticeAccepted,
}: FamilyDossierPanelProps) {
  const [form, setForm] = useState({
    repFirst: repFirst ?? "",
    repLast: repLast ?? "",
    repPhone: repPhone ?? "",
    fiscalConsent,
    mandateConsent,
    legalNoticeAccepted,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  async function handleSave() {
    setIsSaving(true);
    setToast(null);

    try {
      const res = await fetch("/api/staff/users/update-family-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          repFirst: form.repFirst || undefined,
          repLast: form.repLast || undefined,
          repPhone: form.repPhone || undefined,
          fiscalConsent: form.fiscalConsent,
          mandateConsent: form.mandateConsent,
          legalNoticeAccepted: form.legalNoticeAccepted,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setToast({ type: "error", message: data?.error ?? "Erreur serveur" });
        return;
      }
      setToast({ type: "success", message: "Dossier employeur enregistré." });
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Erreur réseau",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">
        Dossier employeur (famille)
      </h3>

      {/* Rep name */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            Prénom représentant
          </label>
          <input
            type="text"
            value={form.repFirst}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, repFirst: e.target.value }))
            }
            className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            Nom représentant
          </label>
          <input
            type="text"
            value={form.repLast}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, repLast: e.target.value }))
            }
            className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
          />
        </div>
      </div>

      {/* Phone */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Téléphone
        </label>
        <input
          type="tel"
          value={form.repPhone}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, repPhone: e.target.value }))
          }
          className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
        />
      </div>

      {/* Consents */}
      <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-semibold text-gray-700">Consentements</p>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.fiscalConsent}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, fiscalConsent: e.target.checked }))
            }
            className="h-4 w-4 rounded border-gray-300"
          />
          <span>
            Consentement fiscal (déclaration URSSAF via Avance Immédiate)
          </span>
        </label>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.mandateConsent}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, mandateConsent: e.target.checked }))
            }
            className="h-4 w-4 rounded border-gray-300"
          />
          <span>Consentement mandat SAP (délégation gestion employeur)</span>
        </label>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.legalNoticeAccepted}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                legalNoticeAccepted: e.target.checked,
              }))
            }
            className="h-4 w-4 rounded border-gray-300"
          />
          <span>Mentions légales acceptées</span>
        </label>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-full bg-blue-600 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-white disabled:opacity-60"
        >
          {isSaving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {toast && (
          <span
            className={
              toast.type === "success"
                ? "text-xs font-semibold text-emerald-600"
                : "text-xs font-semibold text-rose-600"
            }
          >
            {toast.message}
          </span>
        )}
      </div>
    </div>
  );
}
