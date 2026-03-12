export interface DistanceProvider {
  getDrivingDistanceKm(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<{
    distanceKm: number;
    durationMinutes: number;
    source: "google_routes" | "haversine_fallback";
  }>;
}

export class GoogleRoutesDistanceProvider implements DistanceProvider {
  private getApiKey() {
    const key = process.env.GOOGLE_ROUTES_API_KEY;
    if (!key) {
      throw new Error("Missing GOOGLE_ROUTES_API_KEY");
    }
    return key;
  }

  async getDrivingDistanceKm(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<{ distanceKm: number; durationMinutes: number; source: "google_routes" }> {
    const apiKey = this.getApiKey();

    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: {
          location: { latLng: { latitude: from.lat, longitude: from.lng } },
        },
        destination: {
          location: { latLng: { latitude: to.lat, longitude: to.lng } },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        units: "METRIC",
      }),
    });

    if (!response.ok) {
      throw new Error(`Google Routes request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      routes?: Array<{
        distanceMeters?: number;
        duration?: string;
      }>;
    };

    const route = payload.routes?.[0];
    if (!route || typeof route.distanceMeters !== "number") {
      throw new Error("Google Routes returned no route");
    }

    const durationRaw = route.duration ? String(route.duration) : "0s";
    const durationSeconds = Number(durationRaw.replace("s", ""));

    return {
      distanceKm: route.distanceMeters / 1000,
      durationMinutes: durationSeconds / 60,
      source: "google_routes",
    };
  }
}

let providerSingleton: DistanceProvider | null = null;

/**
 * Fallback distance provider using the Haversine (great-circle) formula when
 * GOOGLE_ROUTES_API_KEY is not configured (e.g. local dev, CI).
 * A road-factor of 1.3 converts the crow-flies distance into an approximate
 * driving distance — standard practice for IK approximation in France.
 * Source is tagged 'haversine_fallback' so the distance can be later replaced
 * by a geocoded value if needed.
 */
export class HaversineDistanceProvider implements DistanceProvider {
  private static readonly ROAD_FACTOR = 1.3;
  private static readonly EARTH_RADIUS_KM = 6371;

  async getDrivingDistanceKm(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<{ distanceKm: number; durationMinutes: number; source: "haversine_fallback" }> {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(to.lat - from.lat);
    const dLng = toRad(to.lng - from.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
    const crowFliesKm = 2 * HaversineDistanceProvider.EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
    const distanceKm = crowFliesKm * HaversineDistanceProvider.ROAD_FACTOR;
    // Estimate duration at an average of 50 km/h driving speed.
    const durationMinutes = (distanceKm / 50) * 60;
    return { distanceKm, durationMinutes, source: "haversine_fallback" };
  }
}

export function getDistanceProvider(): DistanceProvider {
  if (!providerSingleton) {
    providerSingleton = process.env.GOOGLE_ROUTES_API_KEY
      ? new GoogleRoutesDistanceProvider()
      : new HaversineDistanceProvider();
  }
  return providerSingleton;
}
