"use client";

import { useState } from "react";

type ToastState = { type: "success" | "error"; message: string } | null;

export type ProfessorDossierPanelProps = {
  userId: string;
  /** Current birth_date from profiles (YYYY-MM-DD) */
  birthDate: string | null;
  /** Whether nir_encrypted is set in DB — never expose raw encrypted value */
  hasNir: boolean;
  /** Whether iban_encrypted is set in DB — never expose raw encrypted value */
  hasIban: boolean;
  bic: string | null;
  grossHourlyOverride: number | null;
};

export default function ProfessorDossierPanel({
  userId,
  birthDate,
  hasNir,
  hasIban,
  bic,
  grossHourlyOverride,
}: ProfessorDossierPanelProps) {
  const [form, setForm] = useState({
    nir: "",
    iban: "",
    bic: bic ?? "",
    grossHourlyOverride: grossHourlyOverride != null ? String(grossHourlyOverride) : "",
    birthDate: birthDate ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  function patch<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setIsSaving(true);
    setToast(null);

    const payload: Record<string, unknown> = { userId };

    if (form.nir.trim()) payload.nir = form.nir.trim().replace(/\s+/g, "");
    if (form.iban.trim()) payload.iban = form.iban.trim();
    if (form.bic.trim()) payload.bic = form.bic.trim().toUpperCase();
    if (form.birthDate) payload.birthDate = form.birthDate;
    if (form.grossHourlyOverride !== "") {
      const parsed = parseFloat(form.grossHourlyOverride);
      if (!isNaN(parsed)) payload.grossHourlyOverride = parsed;
    }

    try {
      const res = await fetch("/api/staff/users/update-social", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setToast({ type: "error", message: data?.error ?? "Erreur serveur" });
        return;
      }
      setToast({ type: "success", message: "Données sociales enregistrées." });
      // Clear sensitive fields after save
      setForm((prev) => ({ ...prev, nir: "", iban: "" }));
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
        Données sociales
      </h3>

      {/* NIR */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          NIR (numéro sécurité sociale)
          {hasNir && (
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              renseigné
            </span>
          )}
        </label>
        <input
          type="text"
          placeholder={hasNir ? "Laisser vide pour conserver" : "15 chiffres sans espaces"}
          value={form.nir}
          onChange={(e) => patch("nir", e.target.value)}
          maxLength={15}
          className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
        />
      </div>

      {/* IBAN */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          IBAN
          {hasIban && (
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              renseigné
            </span>
          )}
        </label>
        <input
          type="text"
          placeholder={hasIban ? "Laisser vide pour conserver" : "FR76 3000..."}
          value={form.iban}
          onChange={(e) => patch("iban", e.target.value)}
          className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
        />
      </div>

      {/* BIC */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">BIC / SWIFT</label>
        <input
          type="text"
          placeholder="BNPAFRPP"
          value={form.bic}
          onChange={(e) => patch("bic", e.target.value)}
          maxLength={11}
          className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
        />
      </div>

      {/* Date de naissance */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Date de naissance
        </label>
        <input
          type="date"
          value={form.birthDate}
          onChange={(e) => patch("birthDate", e.target.value)}
          className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
        />
      </div>

      {/* Taux horaire brut */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Taux horaire brut (€/h)
          <span className="ml-1 text-gray-400 font-normal">
            — laisser vide pour utiliser le taux par défaut (15,00 €)
          </span>
        </label>
        <input
          type="number"
          min="0"
          max="500"
          step="0.01"
          placeholder="15.00"
          value={form.grossHourlyOverride}
          onChange={(e) => patch("grossHourlyOverride", e.target.value)}
          className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
        />
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
