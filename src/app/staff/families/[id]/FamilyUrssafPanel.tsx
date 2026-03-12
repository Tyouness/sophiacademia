"use client";

import { useState } from "react";
import { checkRegisterPreconditions } from "@/lib/urssaf/registerPreconditions";
import type { EmployerReadinessStatus } from "@/lib/urssaf/registerPreconditions";

type ToastState = { type: "success" | "error"; message: string } | null;

export type FamilyUrssafPanelProps = {
  userId: string;
  /** Date de naissance du représentant (YYYY-MM-DD), si déjà renseignée */
  birthDate: string | null;
  /** true si un numéro fiscal (SPI) est déjà enregistré — la valeur chiffrée n'est jamais transmise */
  hasFiscalNumber: boolean;
  /** Statut du client URSSAF : 'pending' | 'registered' | null si aucune ligne */
  urssafStatus: string | null;
  /** Identifiant URSSAF (renvoyé par l'API URSSAF après enregistrement) */
  urssafCustomerId: string | null;
  /** Date de confirmation de l'enregistrement URSSAF */
  registeredAt: string | null;
  /** Dernière erreur URSSAF connue (API ou validation) */
  lastError: string | null;
  /** Statut de readiness employeur — gate le bouton d'enregistrement URSSAF */
  readinessStatus: EmployerReadinessStatus;
  /** true si le système est en état hold (blocages critiques pré-live actifs) */
  preliveBlocked?: boolean;
};

const URSSAF_STATUS_LABELS: Record<string, string> = {
  pending: "En attente d'enregistrement",
  registered: "Enregistré(e) chez URSSAF",
};

const REGISTER_ERROR_LABELS: Record<string, string> = {
  already_registered: "Cette famille est déjà enregistrée chez URSSAF.",
  missing_birth_date: "Date de naissance manquante dans le dossier.",
  missing_address: "Adresse postale manquante. Enregistrez l'adresse dans le dossier famille.",
  missing_representative: "Prénom ou nom du représentant manquant.",
  missing_legal_requirements: "Numéro fiscal ou consentements manquants.",
  dossier_not_ready: "Le dossier n'est pas encore complet pour l'activation URSSAF.",
  urssaf_api_failed: "L'API URSSAF a retourné une erreur. Réessayez ou contactez l'administrateur.",
};

function statusBadge(status: string | null) {
  if (!status) {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
        Client URSSAF non créé
      </span>
    );
  }
  const label = URSSAF_STATUS_LABELS[status] ?? status;
  const color =
    status === "registered"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-amber-100 text-amber-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
}

export default function FamilyUrssafPanel({
  userId,
  birthDate,
  hasFiscalNumber,
  urssafStatus,
  urssafCustomerId,
  registeredAt,
  lastError,
  readinessStatus,
  preliveBlocked = false,
}: FamilyUrssafPanelProps) {
  const [form, setForm] = useState({
    birthDate: birthDate ?? "",
    fiscalNumber: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [hasFiscal, setHasFiscal] = useState(hasFiscalNumber);

  // Registration state — updated optimistically after a successful register call.
  const [currentStatus, setCurrentStatus] = useState(urssafStatus);
  const [currentCustomerId, setCurrentCustomerId] = useState(urssafCustomerId);
  const [currentRegisteredAt, setCurrentRegisteredAt] = useState(registeredAt);
  const [currentLastError, setCurrentLastError] = useState(lastError);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerResult, setRegisterResult] = useState<ToastState>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<ToastState>(null);

  const precheck = checkRegisterPreconditions({
    readinessStatus,
    urssafStatus: currentStatus,
  });

  const isRelaunching = currentStatus === "pending" && precheck.canRegister;

  async function handleSave() {
    const hasUpdate = form.birthDate !== (birthDate ?? "") || form.fiscalNumber !== "";
    if (!hasUpdate) {
      setToast({ type: "error", message: "Aucune modification à enregistrer." });
      return;
    }

    setIsSaving(true);
    setToast(null);

    try {
      const body: Record<string, string> = { userId };
      if (form.birthDate && form.birthDate !== (birthDate ?? "")) {
        body.birthDate = form.birthDate;
      }
      if (form.fiscalNumber) {
        body.fiscalNumber = form.fiscalNumber;
      }

      const res = await fetch("/api/staff/users/update-urssaf-dossier", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setToast({ type: "error", message: data?.error ?? "Erreur serveur" });
        return;
      }

      if (data?.fiscalNumberUpdated) {
        setHasFiscal(true);
        setForm((prev) => ({ ...prev, fiscalNumber: "" }));
      }

      setToast({ type: "success", message: "Dossier URSSAF mis à jour." });
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Erreur réseau",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRegister() {
    setIsRegistering(true);
    setRegisterResult(null);

    try {
      const res = await fetch("/api/urssaf/register-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId: userId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const errLabel =
          REGISTER_ERROR_LABELS[data?.error as string] ?? data?.error ?? "Erreur serveur";
        setRegisterResult({ type: "error", message: errLabel });
        return;
      }

      setCurrentStatus(data?.data?.status ?? currentStatus);
      setCurrentCustomerId(data?.data?.urssaf_customer_id ?? currentCustomerId);
      setCurrentLastError(null);
      setRegisterResult({
        type: "success",
        message: "Enregistrement URSSAF effectué avec succès.",
      });
    } catch (err) {
      setRegisterResult({
        type: "error",
        message: err instanceof Error ? err.message : "Erreur réseau",
      });
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleSyncClient() {
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch("/api/urssaf/sync-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId: userId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const errCode = (data as { error?: string } | null)?.error;
        const errLabel =
          errCode === "system_locked"
            ? ((data as { reason?: string } | null)?.reason ?? "Système verrouillé — corriger les blocages pré-live avant de relancer.")
            : errCode === "urssaf_client_not_found"
              ? "Aucun client URSSAF trouvé pour cette famille."
              : errCode === "urssaf_customer_id_missing"
                ? "Client URSSAF sans ID : lancez d'abord l'enregistrement."
                : errCode ?? "Erreur lors de la vérification du statut.";
        setSyncResult({ type: "error", message: errLabel });
        return;
      }
      const result = data?.data as { previousStatus: string; newStatus: string; changed: boolean } | undefined;
      const newStatus = result?.newStatus ?? currentStatus ?? "";
      setCurrentStatus(newStatus);
      setCurrentLastError(null);
      if (newStatus === "registered" && !currentRegisteredAt) {
        setCurrentRegisteredAt(new Date().toISOString());
      }
      setSyncResult({
        type: "success",
        message: result?.changed
          ? `Statut mis à jour : ${result.previousStatus} → ${newStatus}`
          : `Statut inchangé : ${newStatus}`,
      });
    } catch (err) {
      setSyncResult({
        type: "error",
        message: err instanceof Error ? err.message : "Erreur réseau",
      });
    } finally {
      setIsSyncing(false);
    }
  }

  const canSyncClient = Boolean(currentCustomerId) && currentStatus !== "registered";

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">
        Données URSSAF / Avance Immédiate
      </h3>

      {/* URSSAF registration status (read-only, reactive) */}
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
        <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Statut enregistrement URSSAF
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {statusBadge(currentStatus)}
          {currentCustomerId && (
            <span className="font-mono text-xs text-slate-500">
              ID : {currentCustomerId}
            </span>
          )}
        </div>
        {currentRegisteredAt && (
          <p className="mt-2 text-xs text-slate-500">
            Enregistré le{" "}
            {new Date(currentRegisteredAt).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}
        {currentLastError && (
          <div className="mt-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <p className="font-semibold">Dernière erreur URSSAF :</p>
            <p className="mt-0.5 font-mono break-all">{currentLastError}</p>
          </div>
        )}
      </div>

      {/* Birth date */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Date de naissance du représentant
          <span className="ml-1 text-rose-500">*</span>
        </label>
        <input
          type="date"
          value={form.birthDate}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, birthDate: e.target.value }))
          }
          className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
        />
        <p className="text-xs text-gray-400">
          Requise pour l&apos;enregistrement URSSAF / Avance Immédiate.
        </p>
      </div>

      {/* Fiscal number (SPI) */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Numéro fiscal (SPI — 13 chiffres)
          <span className="ml-1 text-rose-500">*</span>
        </label>
        {hasFiscal && form.fiscalNumber === "" && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              ✓ Renseigné
            </span>
            <span className="text-xs text-gray-400">
              Saisir un nouveau numéro pour le remplacer
            </span>
          </div>
        )}
        <input
          type="text"
          value={form.fiscalNumber}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              fiscalNumber: e.target.value.replace(/\D/g, "").slice(0, 13),
            }))
          }
          placeholder={hasFiscal ? "• • • • • • • • • • • • •" : "ex. 1234567890123"}
          maxLength={13}
          className="w-full rounded-full border border-blue-100 px-4 py-2 font-mono text-sm"
        />
        <p className="text-xs text-gray-400">
          Numéro fiscal individuel (SPI) disponible sur l&apos;avis d&apos;imposition. Stocké de manière chiffrée.
        </p>
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

      {/* ── Enregistrement URSSAF / Avance Immédiate ──────────────────────────────── */}
      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Enregistrement URSSAF / Avance Immédiate
        </p>

        {precheck.blockerCode === "already_registered" ? (
          <p className="text-xs font-medium text-emerald-700">
            ✓ Cette famille est déjà enregistrée chez URSSAF.
            {currentCustomerId && (
              <span className="ml-2 font-mono text-slate-500">
                (ID : {currentCustomerId})
              </span>
            )}
          </p>
        ) : (
          <>
            {!precheck.canRegister && (
              <p className="mb-3 text-xs text-amber-700">
                {precheck.blockerLabel ??
                  "Le dossier n'est pas encore prêt pour l'activation URSSAF."}
                {" "}Complétez les champs manquants ci-dessus.
              </p>
            )}
            {isRelaunching && (
              <p className="mb-3 text-xs text-amber-700">
                Un enregistrement est déjà en attente (statut : pending). Vous pouvez relancer si nécessaire.
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRegister}
                disabled={!precheck.canRegister || isRegistering}
                title={precheck.blockerLabel ?? undefined}
                className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-white disabled:opacity-40"
              >
                {isRegistering
                  ? "Envoi en cours…"
                  : isRelaunching
                    ? "Relancer l'enregistrement URSSAF"
                    : "Enregistrer chez URSSAF"}
              </button>
              {registerResult && (
                <span
                  className={
                    registerResult.type === "success"
                      ? "text-xs font-semibold text-emerald-600"
                      : "text-xs font-semibold text-rose-600"
                  }
                >
                  {registerResult.message}
                </span>
              )}
            </div>
          </>
        )}

        {/* Sync-client button — visible once a customer_id exists and not yet registered */}
        {canSyncClient && (
          <div className="mt-3 border-t border-slate-200 pt-3">
            {preliveBlocked ? (
              <p className="text-xs text-red-700">
                <span className="font-semibold">Vérification désactivée</span> — blocages critiques actifs.{" "}
                <a href="/admin/prelive" className="underline underline-offset-2 hover:text-red-900">
                  Voir la checklist pré-live
                </a>
              </p>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSyncClient}
                  disabled={isSyncing}
                  className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {isSyncing ? "Vérification…" : "Vérifier le statut URSSAF"}
                </button>
                {syncResult && (
                  <span
                    className={
                      syncResult.type === "success"
                        ? "text-xs font-semibold text-emerald-600"
                        : "text-xs font-semibold text-rose-600"
                    }
                  >
                    {syncResult.message}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

