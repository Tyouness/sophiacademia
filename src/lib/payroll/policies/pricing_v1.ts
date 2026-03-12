export const pricingV1 = {
  version: "pricing_v1",
  caps: [
    { maxKm: 10, cap: 23 },
    { maxKm: 20, cap: 25 },
    { maxKm: 30, cap: 30 },
    { maxKm: Number.POSITIVE_INFINITY, cap: 38 },
  ],
  clientPriceLow: 45,
  clientPriceHigh: 50,
};

export function getCapPerHour(distanceKmOneWay: number) {
  const km = Math.max(0, distanceKmOneWay);
  for (const step of pricingV1.caps) {
    if (km <= step.maxKm) {
      return step.cap;
    }
  }
  return pricingV1.caps[pricingV1.caps.length - 1].cap;
}

export function getClientPriceForLevel(level?: string | null) {
  if (!level) {
    return pricingV1.clientPriceHigh;
  }
  const s = level.toLowerCase();
  const isLower = /(\b6e\b|\b5e\b|\b4e\b|\b3e\b|six|cinq|quatre|trois|college|coll[eè]ge|primaire)/i.test(
    s,
  );
  return isLower ? pricingV1.clientPriceLow : pricingV1.clientPriceHigh;
}
