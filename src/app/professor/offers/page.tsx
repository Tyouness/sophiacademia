"use client";

import { useEffect, useRef, useState } from "react";

type ToastState = { type: "success" | "error"; message: string } | null;

type Offer = {
  offerKey: string;
  familyId: string;
  repFirst: string | null;
  repLast: string | null;
  level: string | null;
  subject: string | null;
  subjects: string[] | null;
  children: Array<{
    firstName: string | null;
    lastName: string | null;
    level: string | null;
    subjects: string[];
  }>;
  freq: string | null;
  periods: string[] | null;
  duration: number | null;
  startDate: string | null;
  address: {
    postcode: string | null;
    city: string | null;
    country: string | null;
  };
  distance_km_oneway: number | null;
  pricing: {
    netProfTotalEst: number;
    netSalarialEst: number;
    ikFinal: number;
    forfaitFraisProPerSession: number;
  } | null;
  approx: {
    center: { lat: number; lng: number };
    radius_m: number;
  };
  request_status: string | null;
};

type OffersResponse = {
  data: Offer[];
  meta?: { origin?: { lat: number; lng: number } };
};

const FALLBACK_CENTER = { lat: 48.8566, lng: 2.3522 };

export default function ProfessorOffersPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlayRef = useRef<any[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState("init");
  const [toast, setToast] = useState<ToastState>(null);
  const [isRequesting, setIsRequesting] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadOffers() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/professor/offers");
        const data = (await response.json().catch(() => null)) as
          | OffersResponse
          | { error?: string }
          | null;
        if (!response.ok) {
          const error = data && "error" in data ? data.error ?? "internal_error" : "internal_error";
          const message =
            error === "missing_profile"
              ? "Merci de remplir votre profil (adresse) avant de consulter les offres."
              : `Erreur: ${error}`;
          throw new Error(message);
        }
        if (isMounted) {
          const payload = data && "data" in data ? data : null;
          setOffers(payload?.data ?? []);
          setOrigin(payload?.meta?.origin ?? null);
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

    loadOffers();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY;
    if (!key) {
      setMapError("missing_google_maps_key");
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    if ((window as any).google?.maps?.Map) {
      console.info("[offers-map] google.maps.Map already available");
      setIsMapReady(true);
      setMapStatus("script-loaded");
      return;
    }

    const existingScript = document.querySelector(
      'script[src^="https://maps.googleapis.com/maps/api/js"]',
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        console.info("[offers-map] existing script loaded");
        if ((window as any).google?.maps?.Map) {
          setIsMapReady(true);
          setMapStatus("script-loaded");
        } else {
          console.warn("[offers-map] maps not ready after script load");
          setMapError("maps_not_ready");
          setMapStatus("error: maps_not_ready");
        }
      });
      const retry = window.setInterval(() => {
        if ((window as any).google?.maps?.Map) {
          window.clearInterval(retry);
          setMapError(null);
          setIsMapReady(true);
          setMapStatus("script-loaded");
        }
      }, 300);
      window.setTimeout(() => window.clearInterval(retry), 5000);
      return;
    }

    const script = document.createElement("script");
    (window as any).__initMaps = () => {
      console.info("[offers-map] callback __initMaps fired");
      if ((window as any).google?.maps?.Map) {
        setIsMapReady(true);
        setMapStatus("script-loaded");
      } else {
        console.warn("[offers-map] maps not ready in callback");
        const retry = window.setInterval(() => {
          if ((window as any).google?.maps?.Map) {
            window.clearInterval(retry);
            setMapError(null);
            setIsMapReady(true);
            setMapStatus("script-loaded");
          }
        }, 300);
        window.setTimeout(() => {
          window.clearInterval(retry);
          setMapError("maps_not_ready");
          setMapStatus("error: maps_not_ready");
        }, 3000);
      }
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly&loading=async&callback=__initMaps`;
    script.async = true;
    script.onerror = () => {
      console.error("[offers-map] script failed to load");
      setMapError("failed_to_load_maps");
      setMapStatus("error: failed_to_load_maps");
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!isMapReady || !mapRef.current) {
      return;
    }

    const google = (window as any).google;
    if (!google?.maps?.Map) {
      console.warn("[offers-map] google.maps.Map not available in init");
      setMapError("maps_not_ready");
      setMapStatus("error: maps_not_ready");
      return;
    }

    // Defer one paint frame — Google Maps uses IntersectionObserver internally
    // and calls .observe() on its own elements before they are attached to the
    // document if the Map constructor runs synchronously during a React commit.
    // requestAnimationFrame lets the browser fully paint the container first.
    let rafId: number;
    let timeout: number;

    rafId = requestAnimationFrame(() => {
      const container = mapRef.current;
      if (!(container instanceof Element) || !container.isConnected) {
        console.warn("[offers-map] container not in DOM after rAF — skipping");
        return;
      }

      const center = origin ?? FALLBACK_CENTER;
      const map =
        mapInstanceRef.current ??
        new google.maps.Map(container, {
          center,
          zoom: 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

      setMapStatus("map-created");
      console.info("[offers-map] map created", center);

      mapInstanceRef.current = map;
      overlayRef.current.forEach((overlay) => overlay.setMap(null));
      overlayRef.current = [];

      const bounds = new google.maps.LatLngBounds();
      bounds.extend(center);

      if (origin) {
        overlayRef.current.push(
          new google.maps.Marker({
            position: origin,
            map,
            label: "P",
          }),
        );
      }

      const seenFamilies = new Set<string>();
      offers.forEach((offer) => {
        if (seenFamilies.has(offer.familyId)) {
          return;
        }
        seenFamilies.add(offer.familyId);
        const position = offer.approx.center;
        bounds.extend(position);
        const circle = new google.maps.Circle({
          center: position,
          radius: offer.approx.radius_m,
          strokeColor: "#2563eb",
          strokeOpacity: 0.7,
          strokeWeight: 2,
          fillColor: "#93c5fd",
          fillOpacity: 0.25,
          map,
        });
        overlayRef.current.push(circle);
      });

      if (offers.length > 0) {
        map.fitBounds(bounds);
      } else {
        map.setCenter(center);
        map.setZoom(11);
      }

      google.maps.event.addListenerOnce(map, "tilesloaded", () => {
        console.info("[offers-map] tiles loaded");
        setMapStatus("tiles-loaded");
      });

      timeout = window.setTimeout(() => {
        console.warn("[offers-map] tiles not loaded in time");
        setMapStatus((current) =>
          current === "tiles-loaded" ? current : "error: tiles not loaded",
        );
      }, 6000);
    });

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeout);
    };
  }, [isMapReady, offers, origin]);

  async function handleRequest(offer: Offer) {
    if (!offer.subject) {
      setToast({ type: "error", message: "Aucune matiere renseignee." });
      return;
    }

    if (offer.request_status && offer.request_status !== "detached") {
      setToast({ type: "error", message: "Demande deja en cours." });
      return;
    }

    setIsRequesting(offer.offerKey);
    setToast(null);
    try {
      const response = await fetch("/api/professor/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyId: offer.familyId,
          subject: offer.subject,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = data?.error ?? "internal_error";
        const message =
          error === "missing_professor_location"
            ? "Ajoutez votre adresse avant de demander."
            : error === "missing_family_location"
              ? "La famille doit renseigner son adresse."
              : `Erreur: ${error}`;
        setToast({ type: "error", message });
        return;
      }

      setToast({ type: "success", message: "Demande envoyee." });
      setOffers((prev) =>
        prev.map((item) =>
          item.offerKey === offer.offerKey
            ? { ...item, request_status: "pending" }
            : item,
        ),
      );
      setSelectedOffer((prev) =>
        prev && prev.offerKey === offer.offerKey
          ? { ...prev, request_status: "pending" }
          : prev,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      setToast({ type: "error", message: `Erreur reseau: ${message}` });
    } finally {
      setIsRequesting(null);
    }
  }

  function formatDistance(distance: number | null) {
    if (distance == null) {
      return "Distance indisponible";
    }
    return `${distance.toFixed(1)} km`;
  }

  function formatMoney(value: number | null | undefined) {
    if (value == null) {
      return "-";
    }
    return `${value.toFixed(2)} EUR`;
  }

  function formatFreq(value: string | null) {
    if (!value) {
      return "Frequence a definir";
    }
    return value === "biweekly" ? "Chaque 2 semaines" : "Chaque semaine";
  }

  function formatPeriods(periods: string[] | null) {
    if (!periods || periods.length === 0) {
      return "Aucune periode specifique";
    }
    return periods
      .map((item) => (item === "vacations" ? "Vacances" : "Weekends"))
      .join(", ");
  }

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Offres</h2>
          <p className="mt-1 text-sm text-gray-500">
            Decouvrez les familles disponibles autour de vous.
          </p>
        </div>

        {mapError && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Maps indisponible: {mapError}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_3fr]">
          <div className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-gray-500">Chargement...</p>
            ) : offers.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune offre pour le moment.</p>
            ) : (
              offers.map((offer) => (
                <div
                  key={offer.offerKey}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {offer.repFirst || offer.repLast
                          ? `${offer.repFirst ?? ""} ${offer.repLast ?? ""}`.trim()
                          : "Famille"}
                      </h3>
                      <p className="text-xs text-slate-600">
                        Zone approximative (rayon 300 m)
                      </p>
                      <p className="text-xs text-slate-600">
                        {(offer.address.postcode ?? "").trim()} {(offer.address.city ?? "").trim()}
                      </p>
                      <p className="text-xs text-slate-600">
                        {offer.level ?? "Niveau a preciser"} · {offer.duration ?? 1}h
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">{formatDistance(offer.distance_km_oneway)}</p>
                      <p className="text-sm font-semibold text-slate-900">
                        Net prof estime: {formatMoney(offer.pricing?.netProfTotalEst ?? null)}
                      </p>
                      <p className="text-xs text-slate-500">
                        IK: {formatMoney(offer.pricing?.ikFinal ?? null)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-white px-3 py-1">
                      {offer.subject ?? offer.subjects?.[0] ?? "Matiere"}
                    </span>
                    {offer.freq && (
                      <span className="rounded-full bg-white px-3 py-1">
                        {formatFreq(offer.freq)}
                      </span>
                    )}
                    <span className="rounded-full bg-white px-3 py-1">
                      {formatPeriods(offer.periods)}
                    </span>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
                      onClick={() => setSelectedOffer(offer)}
                    >
                      Afficher les details
                    </button>
                  </div>
                </div>
              ))
            )}
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              <h4 className="text-sm font-semibold text-slate-900">Details</h4>
              {!selectedOffer ? (
                <p className="mt-2 text-xs text-slate-500">
                  Selectionne une offre pour voir les details complets.
                </p>
              ) : (
                <div className="mt-3 space-y-3 text-xs text-slate-600">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {selectedOffer.repFirst || selectedOffer.repLast
                        ? `${selectedOffer.repFirst ?? ""} ${selectedOffer.repLast ?? ""}`.trim()
                        : "Famille"}
                    </p>
                    <p>
                      Zone approximative (rayon 300 m)
                    </p>
                    <p>
                      {(selectedOffer.address.postcode ?? "").trim()} {(
                        selectedOffer.address.city ?? ""
                      ).trim()}
                    </p>
                  </div>
                  <div>
                    <p>Niveau: {selectedOffer.level ?? "-"}</p>
                    <p>Matiere: {selectedOffer.subject ?? "-"}</p>
                    <p>Duree: {selectedOffer.duration ?? 1}h</p>
                    <p>Frequence: {formatFreq(selectedOffer.freq)}</p>
                    <p>Periodes: {formatPeriods(selectedOffer.periods)}</p>
                  </div>
                  <div>
                    <p>Distance: {formatDistance(selectedOffer.distance_km_oneway)}</p>
                    <p>Net prof total estime: {formatMoney(selectedOffer.pricing?.netProfTotalEst ?? null)}</p>
                    <p>Net salarial estime: {formatMoney(selectedOffer.pricing?.netSalarialEst ?? null)}</p>
                    <p>IK prof: {formatMoney(selectedOffer.pricing?.ikFinal ?? null)}</p>
                    <p>Forfait frais pro: {formatMoney(selectedOffer.pricing?.forfaitFraisProPerSession ?? null)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Enfants</p>
                    {selectedOffer.children.length === 0 ? (
                      <p>Aucun detail enfant.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedOffer.children.map((child, index) => (
                          <div key={`child-${index}`} className="rounded-lg border border-slate-100 p-2">
                            <p>
                              {child.firstName ?? "Enfant"} {child.lastName ?? ""} · {child.level ?? "-"}
                            </p>
                            <p>Matieres: {child.subjects.join(", ") || "-"}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className={
                      selectedOffer.request_status &&
                      selectedOffer.request_status !== "detached"
                        ? "rounded-full bg-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
                        : "rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
                    }
                    onClick={() => handleRequest(selectedOffer)}
                    disabled={
                      isRequesting === selectedOffer.offerKey ||
                      (selectedOffer.request_status != null &&
                        selectedOffer.request_status !== "detached")
                    }
                    title={
                      selectedOffer.request_status &&
                        selectedOffer.request_status !== "detached"
                        ? "Demande deja envoyee"
                        : undefined
                    }
                  >
                    {selectedOffer.request_status &&
                      selectedOffer.request_status !== "detached"
                      ? "Demande envoyee"
                      : isRequesting === selectedOffer.offerKey
                        ? "Envoi..."
                        : "Demander"}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            {!origin && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Votre adresse n'est pas encore geocodee. La carte affiche un centre par defaut.
              </div>
            )}
            {mapStatus.startsWith("error") && (
              <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                Carte indisponible: {mapStatus}.
              </div>
            )}
            <div
              ref={mapRef}
              className="h-[420px] min-h-[420px] w-full rounded-lg"
              style={{ height: 420 }}
            />
          </div>
        </div>

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
