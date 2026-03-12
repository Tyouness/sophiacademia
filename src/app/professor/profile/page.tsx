"use client";

import { useEffect, useState } from "react";

type ToastState = { type: "success" | "error"; message: string } | null;

type ProfileState = {
  firstName: string;
  lastName: string;
  phone: string;
  carHp: string;
  address: {
    addr1: string;
    addr2: string;
    postcode: string;
    city: string;
    country: string;
  };
  lat: number | null;
  lng: number | null;
};

const emptyState: ProfileState = {
  firstName: "",
  lastName: "",
  phone: "",
  carHp: "",
  address: {
    addr1: "",
    addr2: "",
    postcode: "",
    city: "",
    country: "France",
  },
  lat: null,
  lng: null,
};

export default function ProfessorProfilePage() {
  const [profile, setProfile] = useState<ProfileState>(emptyState);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/professor/profile");
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Veuillez vous reconnecter.");
          }
          if (response.status === 403) {
            throw new Error(
              "Acces reserve aux professeurs. Verifiez votre role.",
            );
          }
          const error = data?.error ?? "failed_to_load";
          throw new Error(String(error));
        }
        if (isMounted) {
          setProfile({
            ...emptyState,
            ...data.data,
            carHp: data.data?.carHp != null ? String(data.data.carHp) : "",
            address: { ...emptyState.address, ...data.data.address },
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown";
        if (isMounted) {
          setToast({ type: "error", message: `Erreur: ${message}` });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Profil professeur</h2>
          <p className="mt-1 text-sm text-gray-500">
            Ce profil est gere par l'administration. Contactez un admin ou un staff
            pour toute modification.
          </p>
        </div>

        {isLoading ? (
          <p className="mt-6 text-sm text-gray-500">Chargement...</p>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">Prenom</p>
                <p className="text-sm text-slate-800">{profile.firstName || "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">Nom</p>
                <p className="text-sm text-slate-800">{profile.lastName || "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">Telephone</p>
                <p className="text-sm text-slate-800">{profile.phone || "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">Chevaux fiscaux</p>
                <p className="text-sm text-slate-800">{profile.carHp || "-"}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">Adresse</p>
                <p className="text-sm text-slate-800">{profile.address.addr1 || "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">Complement</p>
                <p className="text-sm text-slate-800">{profile.address.addr2 || "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">Code postal</p>
                <p className="text-sm text-slate-800">{profile.address.postcode || "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">Ville</p>
                <p className="text-sm text-slate-800">{profile.address.city || "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">Pays</p>
                <p className="text-sm text-slate-800">{profile.address.country || "-"}</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {profile.lat && profile.lng
                ? `Coordonnees: ${profile.lat.toFixed(5)}, ${profile.lng.toFixed(5)}`
                : "Coordonnees indisponibles. Contactez le staff pour geocoder."}
            </div>
          </div>
        )}

        {toast && (
          <div
            className={
              toast.type === "success"
                ? "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                : "mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            }
            role="status"
          >
            {toast.message}
          </div>
        )}
      </div>
    </main>
  );
}
