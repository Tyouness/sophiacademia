import crypto from "crypto";

export type GeoPoint = { lat: number; lng: number };

type GeocodeResult = {
  location: GeoPoint;
  formattedAddress?: string | null;
};

function requireServerKey() {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) {
    throw new Error("Missing GOOGLE_MAPS_SERVER_KEY");
  }
  return key;
}

export function buildAddressHash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function buildAddressLine(params: {
  addr1: string;
  addr2?: string | null;
  postcode: string;
  city: string;
  country: string;
}) {
  const parts = [
    params.addr1,
    params.addr2 ?? "",
    params.postcode,
    params.city,
    params.country,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return parts.join(", ");
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const key = requireServerKey();
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Geocode request failed");
  }

  const payload = (await response.json()) as {
    status: string;
    results?: Array<{
      formatted_address?: string;
      geometry?: { location?: GeoPoint };
    }>;
  };

  const location = payload.results?.[0]?.geometry?.location;
  if (payload.status !== "OK" || !location) {
    throw new Error("Geocode no results");
  }

  const result = payload.results?.[0];
  if (!result) {
    throw new Error("Geocode no results");
  }
  return {
    location,
    formattedAddress: result.formatted_address ?? null,
  };
}

