"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable from "@/components/DataTable";

type ToastState = { type: "success" | "error"; message: string } | null;

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  disabled_at: string | null;
  deleted_at: string | null;
  username?: string | null;
  phone?: string | null;
  created_at?: string | null;
  addr1?: string | null;
  addr2?: string | null;
  postcode?: string | null;
  city?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type AddressState = {
  addr1: string;
  addr2: string;
  postcode: string;
  city: string;
  country: string;
};

const emptyAddress: AddressState = {
  addr1: "",
  addr2: "",
  postcode: "",
  city: "",
  country: "France",
};

type UserListTableProps = {
  mode: "admin" | "staff";
  users: UserRow[];
};

export default function UserListTable({ mode, users }: UserListTableProps) {
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [addressForm, setAddressForm] = useState<AddressState>(emptyAddress);
  const [addressToast, setAddressToast] = useState<ToastState>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  useEffect(() => {
    if (!selected) {
      setAddressForm(emptyAddress);
      setAddressToast(null);
      return;
    }

    setAddressForm({
      addr1: selected.addr1 ?? "",
      addr2: selected.addr2 ?? "",
      postcode: selected.postcode ?? "",
      city: selected.city ?? "",
      country: selected.country ?? "France",
    });
    setAddressToast(null);
  }, [selected]);

  async function handleAddressSave() {
    if (!selected) {
      return;
    }
    setIsSavingAddress(true);
    setAddressToast(null);

    const url =
      mode === "admin"
        ? "/api/admin/users/update-address"
        : "/api/staff/users/update-address";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.id, address: addressForm }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = data?.error ?? "internal_error";
        setAddressToast({ type: "error", message: `Erreur: ${error}` });
        return;
      }

      setSelected((prev) =>
        prev
          ? {
              ...prev,
              ...addressForm,
              lat: data?.data?.lat ?? prev.lat,
              lng: data?.data?.lng ?? prev.lng,
            }
          : prev,
      );
      setAddressToast({ type: "success", message: "Adresse mise a jour." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      setAddressToast({ type: "error", message: `Erreur reseau: ${message}` });
    } finally {
      setIsSavingAddress(false);
    }
  }

  const rows = useMemo(() => {
    return users.map((profile) => {
      const isDisabled = Boolean(profile.disabled_at);
      const isDeleted = Boolean(profile.deleted_at);
      const status = isDeleted ? "supprime" : isDisabled ? "desactive" : "actif";
      const displayName = profile.full_name ?? "-";

      const actions = (
        <div className="flex flex-wrap gap-2">
          <form
            action={
              mode === "admin" ? "/api/admin/users/disable" : "/api/staff/users/disable"
            }
            method="post"
          >
            <input type="hidden" name="userId" value={profile.id} />
            <input
              type="hidden"
              name="disabled"
              value={isDisabled ? "false" : "true"}
            />
            <button
              type="submit"
              className="rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600"
              disabled={isDeleted}
            >
              {isDisabled ? "Activer" : "Desactiver"}
            </button>
          </form>
          <form
            action={
              mode === "admin" ? "/api/admin/users/delete" : "/api/staff/users/delete"
            }
            method="post"
            onSubmit={(event) => {
              if (!window.confirm("Etes-vous sur de vouloir supprimer cet utilisateur ?")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="userId" value={profile.id} />
            <button
              type="submit"
              className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
              disabled={isDeleted}
            >
              Supprimer
            </button>
          </form>
          {mode === "admin" && (
            <form action="/api/admin/set-role" method="post" className="flex">
              <input type="hidden" name="userId" value={profile.id} />
              <select
                name="role"
                className="rounded-l-full border border-blue-100 bg-white px-2 py-1 text-xs"
                defaultValue={profile.role ?? "family"}
                disabled={isDeleted}
              >
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="family">Famille</option>
                <option value="professor">Professeur</option>
              </select>
              <button
                type="submit"
                className="rounded-r-full border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600"
                disabled={isDeleted}
              >
                MAJ
              </button>
            </form>
          )}
        </div>
      );

      return {
        id: <span className="font-mono text-xs">{profile.id}</span>,
        user: (
          <button
            type="button"
            className="text-left text-sm font-semibold text-blue-600"
            onClick={() => setSelected(profile)}
          >
            {displayName}
          </button>
        ),
        email: profile.email ?? "-",
        role: profile.role ?? "-",
        status,
        actions,
      };
    });
  }, [mode, users]);

  const columns = useMemo(() => {
    const base = [
      { key: "user", label: "Nom" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
      { key: "status", label: "Statut" },
      { key: "actions", label: "Actions" },
    ];

    if (mode === "admin") {
      return [{ key: "id", label: "ID" }, ...base];
    }

    return base;
  }, [mode]);

  return (
    <div className="space-y-6">
      <DataTable columns={columns} rows={rows} emptyLabel="Aucun utilisateur." />
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Details utilisateur</h3>
                <p className="text-xs text-gray-500">{selected.full_name ?? "-"}</p>
              </div>
              <div className="flex items-center gap-3">
                {(selected.role === "professor" || selected.role === "family") && (
                  <Link
                    href={`/staff/${selected.role === "professor" ? "professors" : "families"}/${selected.id}`}
                    className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100"
                    onClick={() => setSelected(null)}
                  >
                    Voir le dossier
                  </Link>
                )}
                <button
                  type="button"
                  className="text-sm font-semibold text-gray-500"
                  onClick={() => setSelected(null)}
                >
                  Fermer
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-gray-700">
              <p>
                <span className="font-semibold">Email:</span> {selected.email ?? "-"}
              </p>
              <p>
                <span className="font-semibold">Telephone:</span> {selected.phone ?? "-"}
              </p>
              <p>
                <span className="font-semibold">Role:</span> {selected.role ?? "-"}
              </p>
              <p>
                <span className="font-semibold">Username:</span> {selected.username ?? "-"}
              </p>
              <p>
                <span className="font-semibold">ID:</span> {selected.id}
              </p>
              <p>
                <span className="font-semibold">Cree le:</span> {selected.created_at ?? "-"}
              </p>
            </div>

            {selected.role === "family" || selected.role === "professor" ? (
              <div className="mt-6 space-y-3 border-t border-slate-100 pt-4">
                <h4 className="text-sm font-semibold text-gray-900">Adresse</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    name="addr1"
                    placeholder="Adresse"
                    required
                    value={addressForm.addr1}
                    onChange={(event) =>
                      setAddressForm((prev) => ({ ...prev, addr1: event.target.value }))
                    }
                    className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
                  />
                  <input
                    name="addr2"
                    placeholder="Complement"
                    value={addressForm.addr2}
                    onChange={(event) =>
                      setAddressForm((prev) => ({ ...prev, addr2: event.target.value }))
                    }
                    className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
                  />
                  <input
                    name="postcode"
                    placeholder="Code postal"
                    required
                    value={addressForm.postcode}
                    onChange={(event) =>
                      setAddressForm((prev) => ({ ...prev, postcode: event.target.value }))
                    }
                    className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
                  />
                  <input
                    name="city"
                    placeholder="Ville"
                    required
                    value={addressForm.city}
                    onChange={(event) =>
                      setAddressForm((prev) => ({ ...prev, city: event.target.value }))
                    }
                    className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
                  />
                  <input
                    name="country"
                    placeholder="Pays"
                    required
                    value={addressForm.country}
                    onChange={(event) =>
                      setAddressForm((prev) => ({ ...prev, country: event.target.value }))
                    }
                    className="w-full rounded-full border border-blue-100 px-4 py-2 text-sm"
                  />
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {selected.lat != null && selected.lng != null
                    ? `Coordonnees: ${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}`
                    : "Coordonnees indisponibles. Enregistrez l'adresse."}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAddressSave}
                    className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
                    disabled={isSavingAddress}
                  >
                    {isSavingAddress ? "Enregistrement..." : "Enregistrer"}
                  </button>
                  {addressToast && (
                    <span
                      className={
                        addressToast.type === "success"
                          ? "text-xs font-semibold text-emerald-600"
                          : "text-xs font-semibold text-rose-600"
                      }
                    >
                      {addressToast.message}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Adresse modifiable uniquement pour les familles et professeurs.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
